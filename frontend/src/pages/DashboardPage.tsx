import { useEffect, useState } from "react";
import { courses as coursesApi, lessons as lessonsApi, chats as chatsApi } from "../services/api";
import type { Course, TeachingMode, TeachingTone } from "../types";
import type { Lesson, Section } from "../services/api";

interface DashboardPageProps {
  onOpenChat: (chatId: string, courseId?: string) => void;
  teachingMode: TeachingMode;
  teachingTone: TeachingTone;
  selectedCourseId: string | null;
  onSelectedCourseChange: (courseId: string | null) => void;
  dashView?: string;
  onDashViewChange?: (v: string) => void;
  username?: string;
}

type CourseTab = "lessons" | "materials";

const COLORS = [
  { from: "#3b82f6", to: "#06b6d4" },
  { from: "#8b5cf6", to: "#ec4899" },
  { from: "#10b981", to: "#14b8a6" },
  { from: "#f97316", to: "#ef4444" },
  { from: "#f97316", to: "#ec4899" },
  { from: "#6366f1", to: "#8b5cf6" },
];

const EMOJIS: Record<string, string> = {
  linux: "🐧", shell: "🐧", unix: "🐧",
  math: "📐", algebra: "📐", calculus: "📐",
  music: "🎵", design: "💡", digital: "💡",
  python: "🐍", java: "💻", code: "💻", data: "🧮",
};

function getCourseColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

function getCourseEmoji(name: string) {
  const n = name.toLowerCase();
  for (const [key, emoji] of Object.entries(EMOJIS)) if (n.includes(key)) return emoji;
  return "📚";
}

export default function DashboardPage({
  onOpenChat, teachingMode, teachingTone,
  selectedCourseId, onSelectedCourseChange,
  dashView = "dashboard", onDashViewChange, username = "",
}: DashboardPageProps) {
  const [courseMap, setCourseMap] = useState<Record<string, Course>>({});
  const [allCourses, setAllCourses] = useState<Record<string, Course>>({});
  const [lessonsMap, setLessonsMap] = useState<Record<string, Record<string, Lesson>>>({});
  const [activeTab, setActiveTab] = useState<CourseTab>("lessons");
  const [loading, setLoading] = useState(true);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [lessonLoading, setLessonLoading] = useState(false);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Section view state
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);

  useEffect(() => {
    coursesApi.getAssigned().then(setCourseMap).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedCourseId) return;
    setActiveTab("lessons");
    if (lessonsMap[selectedCourseId]) return;
    setLessonLoading(true);
    lessonsApi.getByCourse(selectedCourseId)
      .then((data) => setLessonsMap((prev) => ({ ...prev, [selectedCourseId]: data })))
      .catch((e) => setError(e.message))
      .finally(() => setLessonLoading(false));
  }, [selectedCourseId]);

  async function loadAllCourses() {
    if (Object.keys(allCourses).length > 0) return;
    setBrowseLoading(true);
    try { setAllCourses(await coursesApi.getAll()); }
    catch (e: any) { setError(e.message); }
    finally { setBrowseLoading(false); }
  }

  async function handleEnroll(courseId: string) {
    setEnrollingId(courseId);
    try { await coursesApi.enroll(courseId); setCourseMap(await coursesApi.getAssigned()); }
    catch (e: any) { setError(e.message); }
    finally { setEnrollingId(null); }
  }

  async function handleUnenroll(courseId: string) {
    setEnrollingId(courseId);
    try {
      await coursesApi.unenroll(courseId);
      setCourseMap(await coursesApi.getAssigned());
      if (selectedCourseId === courseId) onSelectedCourseChange(null);
    } catch (e: any) { setError(e.message); }
    finally { setEnrollingId(null); }
  }

  async function openCourse(courseId: string) {
    onSelectedCourseChange(courseId);
    setActiveTab("lessons");
    if (lessonsMap[courseId]) return;
    setLessonLoading(true);
    try { setLessonsMap((prev) => ({ ...prev, [courseId]: {} })); const data = await lessonsApi.getByCourse(courseId); setLessonsMap((prev) => ({ ...prev, [courseId]: data })); }
    catch (e: any) { setError(e.message); }
    finally { setLessonLoading(false); }
  }

  async function openLesson(lesson: Lesson) {
    setSelectedLesson(lesson);
    setSections([]);
    setSectionsLoading(true);
    try {
      const data = await lessonsApi.getSections(lesson.lesson_id);
      setSections(data.sections);
    } catch (e: any) { setError(e.message); }
    finally { setSectionsLoading(false); }
  }

  async function startSectionChat(lesson: Lesson, sectionIndex: number) {
    try {
      const data = await lessonsApi.startChat(lesson.lesson_id, teachingMode, teachingTone);
      sessionStorage.setItem("starter_message", data.starter_message || "");
      onOpenChat(data.chat_id, selectedCourseId ?? undefined);
    } catch (e: any) { setError(e.message); }
  }

  async function startLessonChat(lessonId: string) {
    try {
      const data = await lessonsApi.startChat(lessonId, teachingMode, teachingTone);
      sessionStorage.setItem("starter_message", data.starter_message || "");
      onOpenChat(data.chat_id, selectedCourseId ?? undefined);
    } catch (e: any) { setError(e.message); }
  }

  async function startMaterialsChat(courseId: string) {
    try {
      const { chat_id } = await chatsApi.create({ course_id: courseId, title: courseMap[courseId]?.course_name ?? "Course Chat", mode: teachingMode, tone: teachingTone });
      onOpenChat(chat_id, selectedCourseId ?? undefined);
    } catch (e: any) { setError(e.message); }
  }

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: "2.5rem" }}>📚</div>
      <p style={{ color: "#64748b" }}>Loading your courses…</p>
    </div>
  );

  // ── Section List View ──
  if (selectedLesson && selectedCourseId) {
    const color = getCourseColor(selectedLesson.week_title);
    return (
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

        {/* Back */}
        <button onClick={() => setSelectedLesson(null)}
          style={{ display: "flex", alignItems: "center", gap: 8, color: "#64748b", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "0.9rem", fontWeight: 500, marginBottom: "1.5rem", padding: 0 }}
          onMouseEnter={(e) => e.currentTarget.style.color = "#0f172a"}
          onMouseLeave={(e) => e.currentTarget.style.color = "#64748b"}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Back to Course
        </button>

        {/* Lesson header */}
        <div style={{ background: "#fff", borderRadius: 20, border: "1px solid #e2e8f0", padding: "1.5rem", marginBottom: "1.5rem", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: `linear-gradient(135deg, ${color.from}, ${color.to})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 4px 14px rgba(0,0,0,0.15)" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <div>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#0f172a", margin: "0 0 4px", letterSpacing: "-0.01em" }}>{selectedLesson.week_title}</h2>
              <p style={{ fontSize: "0.8rem", color: "#94a3b8", margin: 0 }}>📄 {selectedLesson.original_filename}</p>
            </div>
          </div>
        </div>

        {/* Sections */}
        {sectionsLoading ? (
          <div style={{ textAlign: "center", padding: "3rem", color: "#94a3b8" }}>
            <div style={{ fontSize: "2rem", marginBottom: 12 }}>⏳</div>
            <p>Loading sections…</p>
          </div>
        ) : sections.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem", background: "#fff", borderRadius: 20, border: "1px solid #e2e8f0", color: "#94a3b8" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>📭</div>
            <p style={{ fontWeight: 600, color: "#374151" }}>No sections published yet</p>
            <p style={{ fontSize: "0.85rem" }}>Your teacher hasn't published this lesson's sections yet.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ fontSize: "0.82rem", color: "#94a3b8", fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {sections.length} Section{sections.length !== 1 ? "s" : ""} — Click any to start chatting
            </p>
            {sections.map((section, idx) => (
              <div key={idx}
                onClick={() => startSectionChat(selectedLesson, idx)}
                style={{ background: "#fff", borderRadius: 18, border: "2px solid #e2e8f0", padding: "1.1rem 1.25rem", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", transition: "all 0.15s", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#fdba74"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(249,115,22,0.1)"; e.currentTarget.style.transform = "translateX(4px)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)"; e.currentTarget.style.transform = "translateX(0)"; }}>
                {/* Section number */}
                <div style={{ width: 44, height: 44, borderRadius: 14, background: "linear-gradient(135deg, #f97316, #ec4899)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 4px 12px rgba(249,115,22,0.25)" }}>
                  <span style={{ color: "#fff", fontWeight: 800, fontSize: "0.9rem" }}>{idx + 1}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: "1rem", color: "#0f172a", margin: "0 0 4px" }}>{section.title}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: 500 }}>p.{section.page_start}–{section.page_end}</span>
                    {section.summary && (
                      <span style={{ fontSize: "0.75rem", color: "#64748b" }}>{section.summary.length > 60 ? section.summary.slice(0, 60) + "…" : section.summary}</span>
                    )}
                  </div>
                </div>
                {/* Chat icon */}
                <div style={{ width: 38, height: 38, borderRadius: 12, background: "#fff7ed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                </div>
              </div>
            ))}

            {/* Chat with full lesson */}
            <div style={{ marginTop: 8, background: "linear-gradient(135deg, #fff7ed, #fdf2f8)", borderRadius: 18, border: "2px solid #fed7aa", padding: "1.1rem 1.25rem", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", transition: "all 0.15s" }}
              onClick={() => startLessonChat(selectedLesson.lesson_id)}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(249,115,22,0.15)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: "linear-gradient(135deg, #f97316, #ec4899)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 4px 12px rgba(249,115,22,0.3)" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 700, fontSize: "0.95rem", color: "#9a3412", margin: "0 0 2px" }}>💬 Chat with full lesson</p>
                <p style={{ fontSize: "0.78rem", color: "#c2410c", margin: 0 }}>Ask anything about the entire lesson at once</p>
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Course Detail ──
  if (selectedCourseId) {
    const course = courseMap[selectedCourseId];
    const lessonList = Object.values(lessonsMap[selectedCourseId] ?? {});
    const materials = course?.materials ?? [];
    const color = getCourseColor(course?.course_name ?? "");
    const emoji = getCourseEmoji(course?.course_name ?? "");
    const progress = lessonList.length > 0 ? Math.round((lessonList.filter((_, i) => i < 2).length / lessonList.length) * 100) : 0;

    return (
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}<button onClick={() => setError("")} style={{ marginLeft: 8, background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>✕</button></div>}

        {/* Back */}
        <button onClick={() => onSelectedCourseChange(null)}
          style={{ display: "flex", alignItems: "center", gap: 8, color: "#64748b", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "0.9rem", fontWeight: 500, marginBottom: "1.5rem", transition: "color 0.15s", padding: 0 }}
          onMouseEnter={(e) => e.currentTarget.style.color = "#0f172a"}
          onMouseLeave={(e) => e.currentTarget.style.color = "#64748b"}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Back to Dashboard
        </button>

        {/* Course header card */}
        <div style={{ background: "#fff", borderRadius: 24, boxShadow: "0 4px 24px rgba(0,0,0,0.08)", border: "1px solid #e2e8f0", overflow: "hidden", marginBottom: "1.5rem" }}>
          <div style={{ height: 128, background: `linear-gradient(135deg, ${color.from}, ${color.to})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "5rem", position: "relative" }}>
            <div style={{ position: "absolute", top: -20, right: -20, width: 100, height: 100, background: "rgba(255,255,255,0.1)", borderRadius: "50%" }} />
            {emoji}
          </div>
          <div style={{ padding: "1.5rem" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.25rem", gap: 16 }}>
              <div>
                <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "#0f172a", margin: "0 0 6px", letterSpacing: "-0.02em" }}>{course?.course_name}</h1>
                <p style={{ fontSize: "0.88rem", color: "#64748b", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
                  {course?.teacher_username}
                </p>
              </div>
              <button onClick={() => handleUnenroll(selectedCourseId)} disabled={enrollingId === selectedCourseId}
                style={{ padding: "8px 16px", background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", fontSize: "0.82rem", fontWeight: 600, whiteSpace: "nowrap" }}>
                {enrollingId === selectedCourseId ? "Leaving…" : "Leave Course"}
              </button>
            </div>

            {/* Progress */}
            <div style={{ background: "linear-gradient(135deg, #f8fafc, #f1f5f9)", borderRadius: 16, padding: "1.1rem 1.25rem", border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>Your Progress</span>
                <span style={{ fontSize: "1.4rem", fontWeight: 800, background: "linear-gradient(135deg, #f97316, #ec4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{progress}%</span>
              </div>
              <div style={{ height: 10, background: "#fff", borderRadius: 99, overflow: "hidden", boxShadow: "inset 0 1px 3px rgba(0,0,0,0.1)", marginBottom: 12 }}>
                <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(135deg, #f97316, #ec4899)", borderRadius: 99, transition: "width 0.8s ease" }} />
              </div>
              <div style={{ display: "flex", gap: 20, fontSize: "0.82rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#374151" }}>
                  <div style={{ width: 8, height: 8, background: "#10b981", borderRadius: "50%" }} />
                  <span style={{ fontWeight: 600 }}>{Math.min(2, lessonList.length)}</span>
                  <span style={{ color: "#64748b" }}>completed</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#374151" }}>
                  <div style={{ width: 8, height: 8, background: "#3b82f6", borderRadius: "50%" }} />
                  <span style={{ fontWeight: 600 }}>{lessonList.length}</span>
                  <span style={{ color: "#64748b" }}>total lessons</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: "1.5rem", background: "#fff", borderRadius: 18, padding: 8, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: "1px solid #e2e8f0" }}>
          {[{ key: "lessons", label: "📚 Lessons" }, { key: "materials", label: "📄 Materials" }].map((t) => (
            <button key={t.key} onClick={() => setActiveTab(t.key as CourseTab)}
              style={{ flex: 1, padding: "10px", borderRadius: 12, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "0.9rem", fontWeight: 600, transition: "all 0.15s", background: activeTab === t.key ? "linear-gradient(135deg, #f97316, #ec4899)" : "transparent", color: activeTab === t.key ? "#fff" : "#64748b", boxShadow: activeTab === t.key ? "0 4px 12px rgba(249,115,22,0.3)" : "none" }}>
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === "lessons" && (
          <>
                {lessonLoading ? <p style={{ color: "#64748b" }}>Loading…</p> : lessonList.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "3rem", color: "#94a3b8" }}>
                    <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>📭</div>
                    <p style={{ fontWeight: 600, color: "#374151" }}>No lessons yet</p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {lessonList.map((lesson, idx) => (
                      <div key={lesson.lesson_id}
                        onClick={() => openLesson(lesson)}
                        style={{ background: "#fff", borderRadius: 18, border: "2px solid #e2e8f0", padding: "1.1rem 1.25rem", display: "flex", alignItems: "center", gap: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.04)", cursor: "pointer", transition: "all 0.15s" }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#fdba74"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(249,115,22,0.1)"; e.currentTarget.style.transform = "translateX(4px)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)"; e.currentTarget.style.transform = "translateX(0)"; }}>
                        <div style={{ width: 52, height: 52, borderRadius: 16, background: "linear-gradient(135deg, #f97316, #ec4899)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 4px 12px rgba(249,115,22,0.25)" }}>
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontWeight: 700, fontSize: "1rem", color: "#0f172a", margin: "0 0 4px" }}>{lesson.week_title}</p>
                          <p style={{ fontSize: "0.78rem", color: "#94a3b8", margin: 0 }}>📄 {lesson.original_filename}</p>
                        </div>
                        <div style={{ width: 38, height: 38, borderRadius: 12, background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
          </>
        )}

        {activeTab === "materials" && (
          <>
            {materials.length === 0 ? (
              <div style={{ textAlign: "center", padding: "3rem", color: "#94a3b8" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>📂</div>
                <p style={{ fontWeight: 600, color: "#374151" }}>No materials yet</p>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                  {materials.map((m) => (
                    <div key={m.file_hash} style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: "0.85rem 1.1rem", display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: "#fff7ed", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}>📄</div>
                      <span style={{ fontSize: "0.88rem", color: "#374151", fontWeight: 500 }}>{m.original_filename}</span>
                    </div>
                  ))}
                </div>
                {/* Chat with materials */}
                <div style={{ background: "#fff", borderRadius: 18, border: "2px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                  <div style={{ background: "linear-gradient(135deg, #fff7ed, #fdf2f8)", padding: "1.25rem 1.5rem", borderBottom: "2px solid #fed7aa" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
                      <div style={{ width: 44, height: 44, background: "linear-gradient(135deg, #f97316, #ec4899)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(249,115,22,0.3)" }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                      </div>
                      <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#9a3412", margin: 0 }}>Chat with all materials</h3>
                    </div>
                    <p style={{ fontSize: "0.82rem", color: "#c2410c", margin: 0 }}>Ask questions about your uploaded course documents and get instant answers.</p>
                  </div>
                  <div style={{ padding: "1.25rem 1.5rem" }}>
                    <button onClick={() => startMaterialsChat(selectedCourseId)}
                      style={{ width: "100%", padding: "13px", background: "linear-gradient(135deg, #f97316, #ec4899)", color: "#fff", border: "none", borderRadius: 14, fontSize: "0.9rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 14px rgba(249,115,22,0.3)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                      Start Chat Session
                    </button>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    );
  }

  // ── Main Dashboard ──
  const enrolledList = Object.entries(courseMap);
  const enrolledIds = new Set(Object.keys(courseMap));
  const totalCompleted = enrolledList.reduce((a) => a + 2, 0);

  if (dashView === "browse") {
    if (Object.keys(allCourses).length === 0 && !browseLoading) loadAllCourses();
    return (
      <div>
        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}
        <div style={{ marginBottom: "2rem" }}>
          <h1 style={{ fontSize: "2.2rem", fontWeight: 800, color: "#0f172a", margin: "0 0 8px", letterSpacing: "-0.02em" }}>Browse All Courses</h1>
          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </div>
            <input type="text" placeholder="Search for courses…"
              style={{ width: "100%", paddingLeft: 48, paddingRight: 16, paddingTop: 14, paddingBottom: 14, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 18, fontSize: "0.95rem", fontFamily: "inherit", outline: "none", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", boxSizing: "border-box" }} />
          </div>
        </div>
        {browseLoading ? <p style={{ color: "#64748b", textAlign: "center", padding: "3rem" }}>Loading…</p> : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {Object.entries(allCourses).map(([id, course]) => {
              const isEnrolled = enrolledIds.has(id);
              const color = getCourseColor(course.course_name);
              const emoji = getCourseEmoji(course.course_name);
              return (
                <div key={id} onClick={() => isEnrolled && openCourse(id)}
                  style={{ background: "#fff", borderRadius: 20, border: "1px solid #e2e8f0", overflow: "hidden", cursor: isEnrolled ? "pointer" : "default", transition: "all 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-6px)"; e.currentTarget.style.boxShadow = "0 12px 32px rgba(0,0,0,0.1)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)"; }}>
                  <div style={{ height: 120, background: `linear-gradient(135deg, ${color.from}, ${color.to})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "3.5rem", position: "relative" }}>
                    <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, background: "rgba(255,255,255,0.1)", borderRadius: "50%" }} />
                    {isEnrolled && <div style={{ position: "absolute", top: 10, right: 10, width: 26, height: 26, borderRadius: "50%", background: "#10b981", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>}
                    {emoji}
                  </div>
                  <div style={{ padding: "1rem 1.1rem" }}>
                    <p style={{ fontWeight: 700, fontSize: "0.95rem", color: "#0f172a", marginBottom: 4 }}>{course.course_name}</p>
                    <p style={{ fontSize: "0.78rem", color: "#64748b", marginBottom: 14, display: "flex", alignItems: "center", gap: 5 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/></svg>
                      {course.teacher_username}
                    </p>
                    {isEnrolled ? (
                      <button onClick={(e) => { e.stopPropagation(); openCourse(id); }}
                        style={{ width: "100%", padding: "10px", background: "linear-gradient(135deg, #f97316, #ec4899)", color: "#fff", border: "none", borderRadius: 12, fontSize: "0.88rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                        Go to Course →
                      </button>
                    ) : (
                      <button onClick={(e) => { e.stopPropagation(); handleEnroll(id); }} disabled={enrollingId === id}
                        style={{ width: "100%", padding: "10px", background: enrollingId === id ? "#e5e7eb" : "#0f172a", color: enrollingId === id ? "#9ca3af" : "#fff", border: "none", borderRadius: 12, fontSize: "0.88rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                        {enrollingId === id ? "Enrolling…" : "Enroll Now"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Dashboard view
  return (
    <div>
      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}<button onClick={() => setError("")} style={{ marginLeft: 8, background: "none", border: "none", cursor: "pointer" }}>✕</button></div>}

      {/* Welcome */}
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2.5rem", fontWeight: 800, margin: "0 0 6px", letterSpacing: "-0.03em" }}>
          <span style={{ background: "linear-gradient(135deg, #f97316, #ec4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Welcome back, {username}!
          </span>
        </h1>
        <p style={{ fontSize: "1rem", color: "#64748b", margin: 0 }}>Continue your learning journey</p>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: "2rem" }}>
        {[
          { label: "Enrolled Courses", value: enrolledList.length, grad: "linear-gradient(135deg, #3b82f6, #06b6d4)", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg> },
          { label: "Lessons Completed", value: totalCompleted, grad: "linear-gradient(135deg, #10b981, #14b8a6)", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> },
          { label: "Learning Streak", value: "7 days", grad: "linear-gradient(135deg, #f97316, #ec4899)", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg> },
        ].map((stat) => (
          <div key={stat.label} style={{ background: "#fff", borderRadius: 20, border: "1px solid #e2e8f0", padding: "1.25rem 1.5rem", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
              <div style={{ width: 46, height: 46, borderRadius: 14, background: stat.grad, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(0,0,0,0.15)" }}>
                {stat.icon}
              </div>
            </div>
            <p style={{ fontSize: "0.82rem", color: "#64748b", margin: "0 0 4px" }}>{stat.label}</p>
            <p style={{ fontSize: "1.7rem", fontWeight: 800, background: stat.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: 0, lineHeight: 1 }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* My Courses */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>My Courses</h2>
          <button onClick={() => onDashViewChange?.("browse")}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: "linear-gradient(135deg, #f97316, #ec4899)", color: "#fff", border: "none", borderRadius: 12, fontSize: "0.88rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 12px rgba(249,115,22,0.3)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            Browse All
          </button>
        </div>

        {enrolledList.length === 0 ? (
          <div style={{ background: "linear-gradient(135deg, #fff7ed, #fdf2f8)", borderRadius: 24, border: "2px dashed #fdba74", padding: "3rem", textAlign: "center" }}>
            <div style={{ width: 72, height: 72, background: "linear-gradient(135deg, #f97316, #ec4899)", borderRadius: 22, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", boxShadow: "0 8px 24px rgba(249,115,22,0.3)" }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
            </div>
            <p style={{ fontSize: "1.1rem", fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>You haven't enrolled in any courses yet.</p>
            <button onClick={() => onDashViewChange?.("browse")}
              style={{ marginTop: 8, padding: "12px 24px", background: "linear-gradient(135deg, #f97316, #ec4899)", color: "#fff", border: "none", borderRadius: 14, fontSize: "0.9rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 14px rgba(249,115,22,0.3)" }}>
              Browse courses →
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {enrolledList.map(([id, course]) => {
              const color = getCourseColor(course.course_name);
              const emoji = getCourseEmoji(course.course_name);
              const lessons = Object.values(lessonsMap[id] ?? {});
              const completed = Math.min(2, lessons.length);
              const total = lessons.length || 10;
              const progress = Math.round((completed / total) * 100);
              return (
                <div key={id} onClick={() => openCourse(id)}
                  style={{ background: "#fff", borderRadius: 20, border: "1px solid #e2e8f0", overflow: "hidden", cursor: "pointer", transition: "all 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.02) translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 32px rgba(0,0,0,0.1)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1) translateY(0)"; e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)"; }}>
                  {/* Top color bar */}
                  <div style={{ height: 6, background: `linear-gradient(135deg, ${color.from}, ${color.to})` }} />
                  <div style={{ padding: "1.25rem" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: "1rem" }}>
                      <div style={{ width: 60, height: 60, borderRadius: 18, background: `linear-gradient(135deg, ${color.from}, ${color.to})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem", flexShrink: 0, boxShadow: "0 4px 14px rgba(0,0,0,0.15)" }}>
                        {emoji}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 700, fontSize: "0.95rem", color: "#0f172a", marginBottom: 4 }}>{course.course_name}</p>
                        <p style={{ fontSize: "0.78rem", color: "#64748b", margin: 0, display: "flex", alignItems: "center", gap: 4 }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/></svg>
                          {course.teacher_username}
                        </p>
                      </div>
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: "0.78rem", color: "#64748b" }}>Progress</span>
                        <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#0f172a" }}>{progress}%</span>
                      </div>
                      <div style={{ height: 8, background: "#f1f5f9", borderRadius: 99, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${progress}%`, background: `linear-gradient(135deg, ${color.from}, ${color.to})`, borderRadius: 99 }} />
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "0.78rem", color: "#64748b" }}>{completed}/{total} lessons</span>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
