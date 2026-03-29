import { useEffect, useState } from "react";
import { courses as coursesApi, lessons as lessonsApi, chats as chatsApi } from "../services/api";
import type { Course, TeachingMode, TeachingTone } from "../types";
import type { Lesson } from "../services/api";

interface DashboardPageProps {
  onOpenChat: (chatId: string) => void;
  teachingMode: TeachingMode;
  teachingTone: TeachingTone;
}

function getCourseImage(courseName: string): string {
  const name = courseName.toLowerCase();
  if (name.includes("se115") || name.includes("se116")) return "/assets/se115.png";
  if (name.includes("linear")) return "/assets/linearalgebra.png";
  if (name.includes("music")) return "/assets/musicandcomputers.jpg";
  if (name.includes("eee")) return "/assets/digitalDesign.png";
  return "";
}

type CourseTab = "lessons" | "materials";

export default function DashboardPage({
  onOpenChat,
  teachingMode,
  teachingTone,
}: DashboardPageProps) {
  const [courseMap, setCourseMap] = useState<Record<string, Course>>({});
  const [lessonsMap, setLessonsMap] = useState<Record<string, Record<string, Lesson>>>({});
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<CourseTab>("lessons");
  const [loading, setLoading] = useState(true);
  const [lessonLoading, setLessonLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    coursesApi
      .getAll()
      .then(setCourseMap)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function openCourse(courseId: string) {
    setSelectedCourseId(courseId);
    setActiveTab("lessons");

    if (lessonsMap[courseId]) return;

    setLessonLoading(true);
    try {
      const data = await lessonsApi.getByCourse(courseId);
      setLessonsMap((prev) => ({ ...prev, [courseId]: data }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLessonLoading(false);
    }
  }

  async function startLessonChat(lessonId: string) {
    try {
      const { chat_id } = await lessonsApi.startChat(lessonId, teachingMode, teachingTone);
      onOpenChat(chat_id);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function startMaterialsChat(courseId: string) {
    try {
      const { chat_id } = await chatsApi.create({
        course_id: courseId,
        title: courseMap[courseId]?.course_name ?? "Course Chat",
        mode: teachingMode,
        tone: teachingTone,
      });
      onOpenChat(chat_id);
    } catch (e: any) {
      setError(e.message);
    }
  }

  if (loading) {
    return <div style={{ padding: "3rem", color: "var(--text-soft)" }}>Loading courses…</div>;
  }

  if (error) {
    return (
      <div className="alert alert-error" style={{ margin: "2rem" }}>
        {error}
      </div>
    );
  }

  const courseList = Object.entries(courseMap);

  if (selectedCourseId) {
    const selectedCourse = courseMap[selectedCourseId];
    const lessonList = Object.values(lessonsMap[selectedCourseId] ?? {});
    const materials = selectedCourse?.materials ?? [];

    return (
      <div>
        <div className="title-accent" />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
          <div>
            <h1 style={{ fontSize: "2rem", marginBottom: "0.35rem" }}>📘 {selectedCourse?.course_name}</h1>
            <p style={{ color: "var(--text-soft)", marginBottom: "1.25rem" }}>
              Choose how you want to study this course.
            </p>
          </div>
          <button className="btn btn-ghost" onClick={() => setSelectedCourseId(null)}>
            ← Back to Courses
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex",
          background: "var(--card)",
          border: "1.5px solid var(--line)",
          borderRadius: "var(--r-md)",
          padding: 4,
          gap: 2,
          marginBottom: "1.5rem",
        }}>
          {([
            { key: "lessons", label: "📖 Lessons" },
            { key: "materials", label: "📁 Materials" },
          ] as { key: CourseTab; label: string }[]).map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                flex: 1,
                padding: "0.4rem 1rem",
                borderRadius: "var(--r-sm)",
                border: "none",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "0.88rem",
                transition: "all 0.18s",
                background: activeTab === t.key ? "var(--orange)" : "transparent",
                color: activeTab === t.key ? "#fff" : "var(--text-soft)",
                boxShadow: activeTab === t.key ? "0 3px 14px rgba(232,81,10,0.28)" : "none",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Lessons Tab */}
        {activeTab === "lessons" && (
          <>
            {lessonLoading ? (
              <div style={{ padding: "1rem 0", color: "var(--text-soft)" }}>Loading lessons…</div>
            ) : lessonList.length === 0 ? (
              <div className="alert alert-warning">No published lessons yet for this course.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {lessonList.map((lesson) => (
                  <div
                    key={lesson.lesson_id}
                    className="card"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "1rem",
                      padding: "1rem 1.1rem",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: 4 }}>
                        {lesson.week_title}
                      </div>
                      <div style={{ fontSize: "0.82rem", color: "var(--text-soft)" }}>
                        📄 {lesson.original_filename}
                      </div>
                    </div>
                    <button
                      className="btn btn-primary"
                      style={{ whiteSpace: "nowrap" }}
                      onClick={() => startLessonChat(lesson.lesson_id)}
                    >
                      ▶ Start Lesson
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Materials Tab */}
        {activeTab === "materials" && (
          <>
            {materials.length === 0 ? (
              <div className="alert alert-warning">No materials uploaded yet for this course.</div>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginBottom: "1.5rem" }}>
                  {materials.map((m) => (
                    <div
                      key={m.file_hash}
                      className="card"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                        padding: "0.75rem 1rem",
                      }}
                    >
                      <span style={{ fontSize: "1.2rem" }}>📄</span>
                      <span style={{ fontSize: "0.88rem", color: "var(--text-mid)", flex: 1 }}>
                        {m.original_filename}
                      </span>
                    </div>
                  ))}
                </div>

                <div
                  className="card"
                  style={{
                    padding: "1.25rem 1.5rem",
                    background: "var(--orange-lt)",
                    border: "1.5px solid var(--orange-md)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "1rem",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: 4 }}>
                      Chat with all materials
                    </div>
                    <div style={{ fontSize: "0.82rem", color: "var(--text-mid)" }}>
                      Ask questions about any of the uploaded course documents.
                    </div>
                  </div>
                  <button
                    className="btn btn-primary"
                    style={{ whiteSpace: "nowrap" }}
                    onClick={() => startMaterialsChat(selectedCourseId)}
                  >
                    💬 Start Chat
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="title-accent" />
      <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📘 Start Learning</h1>
      <p style={{ color: "var(--text-soft)", marginBottom: "2rem" }}>
        Pick a course and open its weekly lessons.
      </p>

      {courseList.length === 0 ? (
        <div className="alert alert-warning">No courses available yet. Ask a teacher to create a course.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "1.25rem" }}>
          {courseList.map(([id, course]) => (
            <CourseCard key={id} course={course} onOpen={() => openCourse(id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function CourseCard({ course, onOpen }: { course: Course; onOpen: () => void }) {
  const materials = course.materials ?? [];
  const shown = materials.slice(-3);
  const extra = materials.length - shown.length;
  const imgSrc = getCourseImage(course.course_name);
  const [imgError, setImgError] = useState(false);

  return (
    <div className="card" style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
      {imgSrc && !imgError ? (
        <img
          src={imgSrc}
          alt={course.course_name}
          onError={() => setImgError(true)}
          style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }}
        />
      ) : (
        <div
          style={{
            height: 140,
            background: "linear-gradient(135deg, var(--orange-lt), var(--orange-md))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "2.5rem",
          }}
        >
          📚
        </div>
      )}

      <div style={{ padding: "0.9rem 1rem", flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: 2 }}>{course.course_name}</div>
        <div style={{ fontSize: "0.78rem", color: "var(--text-soft)", marginBottom: 10 }}>
          👤 {course.teacher_username}
        </div>

        {shown.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 8 }}>
            {shown.map((m) => (
              <div
                key={m.file_hash}
                style={{
                  fontSize: "0.75rem",
                  color: "var(--text-soft)",
                  padding: "0.15rem 0",
                  borderBottom: "1px solid var(--bg3)",
                }}
              >
                📄 {m.original_filename}
              </div>
            ))}
            {extra > 0 && (
              <div style={{ fontSize: "0.72rem", color: "var(--orange)", fontWeight: 600 }}>
                + {extra} more
              </div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 8 }}>
            No materials yet
          </div>
        )}
      </div>

      <div style={{ padding: "0 1rem 1rem" }}>
        <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={onOpen}>
          📂 Open Course
        </button>
      </div>
    </div>
  );
}
