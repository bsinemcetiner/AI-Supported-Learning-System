import type {
  TokenResponse,
  Course,
  ChatMap,
  TeachingMode,
  TeachingTone,
  Material,
  NotificationItem,
} from "../types";

const BASE = "http://127.0.0.1:8011/api";

export type Lesson = {
  lesson_id: string;
  course_id: string;
  teacher_username: string;
  week_title: string;
  original_filename: string;
  stored_path: string;
  file_hash: string;
  uploaded_at: string;
  teacher_feedback_history: string[];
  custom_prompt: string;
  preview_question: string;
  draft_explanation: string;
  approved_explanation: string;
  last_generated_at: string | null;
  approved_at: string | null;
  is_published: boolean;
};

export type Section = {
  section_index: number;
  title: string;
  page_start: number;
  page_end: number;
  text_preview: string;
  summary: string;
  draft: string;
  approved: boolean;
};

export const token = {
  get: () => localStorage.getItem("token"),
  set: (t: string) => localStorage.setItem("token", t),
  clear: () => localStorage.removeItem("token"),
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  const isFormData = options.body instanceof FormData;
  if (!isFormData && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const t = token.get();
  if (t) headers["Authorization"] = `Bearer ${t}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Unknown error");
  }

  return res.json() as Promise<T>;
}

export async function* streamRequest(
  path: string,
  body: object = {}
): AsyncGenerator<string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const t = token.get();
  if (t) headers["Authorization"] = `Bearer ${t}`;

  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    const err = await res.text().catch(() => "Stream failed");
    throw new Error(err || "Stream failed");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;

      try {
        const json = JSON.parse(line.slice(6));
        if (json.delta) yield json.delta;
        if (json.done) return;
      } catch {
        // ignore malformed stream lines
      }
    }
  }
}

export const auth = {
  login: (username: string, password: string) =>
    request<TokenResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  sendOtp: (email: string) =>
    request<{ message: string; role: string }>("/auth/send-otp", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  verifyOtp: (email: string, otp: string) =>
    request<{ message: string }>("/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ email, otp }),
    }),

  signup: (
    full_name: string,
    username: string,
    password: string,
    role: string,
    email: string
  ) =>
    request<{ message: string }>("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ full_name, username, password, role, email }),
    }),
};

export const courses = {
  getAll: () => request<Record<string, Course>>("/courses/"),

  getMine: () => request<Record<string, Course>>("/courses/mine"),

  getAssigned: () => request<Record<string, Course>>("/courses/assigned"),

  enroll: (course_id: string) =>
    request<{ message: string; course_id: string }>(`/courses/${course_id}/enroll`, {
      method: "POST",
    }),

  unenroll: (course_id: string) =>
    request<{ message: string; course_id: string }>(`/courses/${course_id}/unenroll`, {
      method: "DELETE",
    }),

  create: (course_name: string) =>
    request<{ course_id: string }>("/courses/", {
      method: "POST",
      body: JSON.stringify({ course_name }),
    }),

  uploadMaterial: async (course_id: string, file: File) => {
    const form = new FormData();
    form.append("file", file);

    const headers: Record<string, string> = {};
    const t = token.get();
    if (t) headers["Authorization"] = `Bearer ${t}`;

    const res = await fetch(`${BASE}/courses/${course_id}/materials`, {
      method: "POST",
      headers,
      body: form,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail ?? "Upload failed");
    }

    return res.json();
  },

  deleteMaterial: (course_id: string, file_hash: string) =>
    request<{ message: string }>(`/courses/${course_id}/materials/${file_hash}`, {
      method: "DELETE",
    }),

  getMaterials: (course_id: string) =>
    request<Material[]>(`/courses/${course_id}/materials`),
};

export const lessons = {
  upload: async (course_id: string, week_title: string, file: File) => {
    const form = new FormData();
    form.append("file", file);

    const headers: Record<string, string> = {};
    const t = token.get();
    if (t) headers["Authorization"] = `Bearer ${t}`;

    const qs = new URLSearchParams({ course_id, week_title }).toString();

    const res = await fetch(`${BASE}/lessons/upload?${qs}`, {
      method: "POST",
      headers,
      body: form,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail ?? "Lesson upload failed");
    }

    return res.json() as Promise<{
      lesson_id: string;
      week_title: string;
      filename: string;
      message: string;
      page_count: number;
      section_count: number;
    }>;
  },

  getByCourse: (course_id: string) =>
    request<Record<string, Lesson>>(`/lessons/course/${course_id}`),

  getAllByCourse: (course_id: string) =>
    request<Record<string, Lesson>>(`/lessons/course/${course_id}/all`),

  getOne: (lesson_id: string) =>
    request<Lesson>(`/lessons/${lesson_id}`),

  getSections: (lesson_id: string) =>
    request<{ sections: Section[]; total: number }>(`/lessons/${lesson_id}/sections`),

  generateSectionStream: (lesson_id: string, section_index: number) =>
    streamRequest(`/lessons/${lesson_id}/sections/${section_index}/generate`, {}),

  approveSection: (lesson_id: string, section_index: number) =>
    request<{ message: string; section_index: number; lesson_id: string }>(
      `/lessons/${lesson_id}/sections/${section_index}/approve`,
      { method: "PATCH" }
    ),

  unapproveSection: (lesson_id: string, section_index: number) =>
    request<{ message: string; section_index: number }>(
      `/lessons/${lesson_id}/sections/${section_index}/unapprove`,
      { method: "PATCH" }
    ),

  publishSections: (lesson_id: string) =>
    request<{ message: string; lesson_id: string; section_count: number }>(
      `/lessons/${lesson_id}/publish-sections`,
      { method: "PATCH" }
    ),

  saveFeedback: (lesson_id: string, feedback: string, custom_prompt?: string) =>
    request<{ message: string; lesson_id: string }>(`/lessons/${lesson_id}/feedback`, {
      method: "POST",
      body: JSON.stringify({ feedback, custom_prompt }),
    }),

  updatePreviewQuestion: (lesson_id: string, preview_question: string) =>
    request<{ message: string }>(`/lessons/${lesson_id}/preview-question`, {
      method: "PATCH",
      body: JSON.stringify({ preview_question }),
    }),

  setPublished: (lesson_id: string, is_published: boolean) =>
    request<{ message: string; is_published: boolean }>(`/lessons/${lesson_id}/publish`, {
      method: "PATCH",
      body: JSON.stringify({ is_published }),
    }),

  approve: (lesson_id: string) =>
    request<{ message: string; lesson_id: string; is_published: boolean }>(
      `/lessons/${lesson_id}/approve`,
      { method: "PATCH" }
    ),

  startChat: (lesson_id: string, mode: TeachingMode, tone: TeachingTone) =>
    request<{ chat_id: string; lesson_id: string; week_title: string }>(
      `/lessons/${lesson_id}/chat`,
      {
        method: "POST",
        body: JSON.stringify({ mode, tone }),
      }
    ),
};

export const chats = {
  getAll: () => request<ChatMap>("/chats/"),

  getStreak: () => request<{ streak: number }>("/chats/streak"),

  create: (opts: {
  course_id?: string;
  lesson_id?: string;
  section_index?: number | null;
  title?: string;
  mode?: TeachingMode;
  tone?: TeachingTone;
  starter_message?: string;
}) =>
    request<{ chat_id: string }>("/chats/", {
      method: "POST",
      body: JSON.stringify(opts),
    }),

  delete: (chat_id: string) =>
    request<{ message: string }>(`/chats/${chat_id}`, { method: "DELETE" }),

  rename: (chat_id: string, title: string) =>
    request<{ message: string }>(`/chats/${chat_id}/rename`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    }),

  updateSettings: (
    chat_id: string,
    opts: { mode?: TeachingMode; tone?: TeachingTone }
  ) =>
    request<{ message: string }>(`/chats/${chat_id}/settings`, {
      method: "PATCH",
      body: JSON.stringify(opts),
    }),

  sendStream: (chat_id: string, content: string) =>
    streamRequest(`/chats/${chat_id}/messages`, { content, stream: true }),

  regenerateStream: (chat_id: string) =>
    streamRequest(`/chats/${chat_id}/regenerate`, {}),
};

// ===== ADMIN =====
const ADMIN_TOKEN_KEY = "admin_token";

export const adminLogin = async (username: string, password: string) => {
  const res = await fetch(`${BASE}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error("Invalid username or password");
  const data = await res.json();
  localStorage.setItem(ADMIN_TOKEN_KEY, data.access_token);
  return data;
};

export const adminLogout = () => localStorage.removeItem(ADMIN_TOKEN_KEY);

export const getAdminToken = () => localStorage.getItem(ADMIN_TOKEN_KEY);

const adminHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getAdminToken()}`,
});

export const fetchAllStudents = async () => {
  const res = await fetch(`${BASE}/admin/students`, { headers: adminHeaders() });
  if (!res.ok) throw new Error("Could not fetch students");
  return res.json();
};

export const fetchAllTeachers = async () => {
  const res = await fetch(`${BASE}/admin/teachers`, { headers: adminHeaders() });
  if (!res.ok) throw new Error("Could not fetch teachers");
  return res.json();
};

export const fetchAllCourses = async () => {
  const res = await fetch(`${BASE}/admin/courses`, { headers: adminHeaders() });
  if (!res.ok) throw new Error("Could not fetch courses");
  return res.json();
};

export const fetchStudentCourses = async (studentId: number) => {
  const res = await fetch(`${BASE}/admin/students/${studentId}/courses`, {
    headers: adminHeaders(),
  });
  if (!res.ok) throw new Error("Could not fetch student courses");
  return res.json();
};

export const assignCourse = async (studentId: number, courseId: number) => {
  const res = await fetch(`${BASE}/admin/assign`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({ student_id: studentId, course_id: courseId }),
  });
  if (!res.ok) throw new Error("Assignment failed");
  return res.json();
};

export const removeCourse = async (studentId: number, courseId: number) => {
  const res = await fetch(`${BASE}/admin/remove`, {
    method: "DELETE",
    headers: adminHeaders(),
    body: JSON.stringify({ student_id: studentId, course_id: courseId }),
  });
  if (!res.ok) throw new Error("Remove failed");
  return res.json();
};

export const settings = {
  getMe: () =>
    request<{
      full_name: string;
      username: string;
      email?: string | null;
      role: string;
    }>("/settings/me"),

  updateProfile: (full_name: string) =>
    request<{ message: string }>("/settings/profile", {
      method: "PATCH",
      body: JSON.stringify({ full_name }),
    }),

  changePassword: (current_password: string, new_password: string) =>
    request<{ message: string }>("/settings/password", {
      method: "PATCH",
      body: JSON.stringify({ current_password, new_password }),
    }),
};

export const notifications = {
  getAll: () =>
    request<NotificationItem[]>("/notifications/"),

    markAllRead: () =>
      request<{ ok: boolean }>("/notifications/read-all", {
        method: "PATCH",
     }),

  markOneRead: (notification_id: string) =>
    request<{ message: string }>(`/notifications/${notification_id}/read`, {
      method: "PATCH",
    }),
};
