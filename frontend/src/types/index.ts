// ── Auth ──────────────────────────────────────────────────────────────────────
export interface User {
  username: string;
  full_name: string;
  role: "student" | "teacher";
}

export interface AuthState {
  user: User | null;
  token: string | null;
}

// ── Course ────────────────────────────────────────────────────────────────────
export interface Material {
  original_filename: string;
  stored_path: string;
  file_hash: string;
  uploaded_at: string;
}

export interface Course {
  course_id: string;
  course_name: string;
  teacher_username: string;
  materials: Material[];
  created_at?: string;
}

// ── Chat ──────────────────────────────────────────────────────────────────────
export type Role = "user" | "assistant" | "system";
export type TeachingMode = "direct" | "hint_first" | "socratic" | "quiz_me";
export type TeachingTone =
  | "Professional Tutor"
  | "Friendly Mentor"
  | "Simplified Explainer"
  | "Encouraging Coach"
  | "Funny YouTuber"
  | "Deep Scientist"
  | "Simplified (for kids)";

export interface Message {
  role: Role;
  content: string;
}

export interface Chat {
  title: string;
  messages: Message[];
  course_id: string | null;
  lesson_id?: string | null;
  section_index?: number | null;
  mode: TeachingMode;
  tone: TeachingTone;
  uploaded_sources: string[];
  pdf_context?: string;
  created_at?: string;
}

export type ChatMap = Record<string, Chat>;

// ── API responses ─────────────────────────────────────────────────────────────
export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface ApiError {
  detail: string;
}

// ── Notifications ─────────────────────────────────────────────────────────────
export interface NotificationItem {
  id: string;
  title?: string;
  message: string;
  type?: string;
  is_read: boolean;
  created_at?: string;
}