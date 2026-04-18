import type {
  TokenResponse,
  Course,
  ChatMap,
  TeachingMode,
  TeachingTone,
  Material,
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

  signup: (full_name: string, username: string, password: string, role: string) =>
    request<{ message: string }>("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ full_name, username, password, role }),
    }),
};

export const courses = {
  getAll: () => request<Record<string, Course>>("/courses/"),

  getMine: () => request<Record<string, Course>>("/courses/mine"),

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
    }>;
  },

  getByCourse: (course_id: string) =>
    request<Record<string, Lesson>>(`/lessons/course/${course_id}`),

  getAllByCourse: (course_id: string) =>
    request<Record<string, Lesson>>(`/lessons/course/${course_id}/all`),

  getOne: (lesson_id: string) =>
    request<Lesson>(`/lessons/${lesson_id}`),

  previewStream: (lesson_id: string) =>
    streamRequest(`/lessons/${lesson_id}/preview`, {}),

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
      {
        method: "PATCH",
      }
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

  create: (opts: {
    course_id?: string;
    lesson_id?: string;
    title?: string;
    mode?: TeachingMode;
    tone?: TeachingTone;
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

  sendStream: (chat_id: string, content: string) =>
    streamRequest(`/chats/${chat_id}/messages`, { content, stream: true }),

  regenerateStream: (chat_id: string) =>
    streamRequest(`/chats/${chat_id}/regenerate`, {}),
};