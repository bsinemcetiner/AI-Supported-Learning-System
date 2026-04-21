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
type DashTab = "enrolled" | "browse";

export default function DashboardPage({
  onOpenChat,
  teachingMode,
  teachingTone,
}: DashboardPageProps) {
  const [courseMap, setCourseMap] = useState<Record<string, Course>>({});
  const [allCourses, setAllCourses] = useState<Record<string, Course>>({});
  const [lessonsMap, setLessonsMap] = useState<Record<string, Record<string, Lesson>>>({});
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<CourseTab>("lessons");
  const [dashTab, setDashTab] = useState<DashTab>("enrolled");
  const [loading, setLoading] = useState(true);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [lessonLoading, setLessonLoading] = useState(false);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    coursesApi
      .getAssigned()
      .then(setCourseMap)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function loadAllCourses() {
    if (Object.keys(allCourses).length > 0) return;
    setBrowseLoading(true);
    try {
      const data = await coursesApi.getAll();
      setAllCourses(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBrowseLoading(false);
    }
  }

  function switchDashTab(tab: DashTab) {
    setDashTab(tab);
    if (tab === "browse") loadAllCourses();
  }

  async function handleEnroll(courseId: string) {
    setEnrollingId(courseId);
    try {
      await coursesApi.enroll(courseId);
      const updated = await coursesApi.getAssigned();
      setCourseMap(updated);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setEnrollingId(null);
    }
  }

  async function handleUnenroll(courseId: string) {
    setEnrollingId(courseId);
    try {
      await coursesApi.unenroll(courseId);
      const updated = await coursesApi.getAssigned();
      setCourseMap(updated);
      if (selectedCourseId === courseId) setSelectedCourseId(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setEnrollingId(null);
    }
  }

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
      const data = await lessonsApi.startChat(lessonId, teachingMode, teachingTone);
      sessionStorage.setItem("starter_message", data.starter_message || "");
      onOpenChat(data.chat_id);
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
    return (
      <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-soft)" }}>
        <div style={{ fontSize: "2rem", marginBottom: 12 }}>📚</div>
        <p>Loading courses…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error" style={{ margin: "2rem" }}>
        {error}
        <button className="btn btn-ghost btn-sm" style={{ marginLeft: 12 }} onClick={() => setError("")}>
          Dismiss
        </button>
      </div>
    );
  }

  // ── Course detail view ──
  if (selectedCourseId) {
    const selectedCourse = courseMap[selectedCourseId];
    const lessonList = Object.values(lessonsMap[selectedCourseId] ?? {});
    const materials = selectedCourse?.materials ?? [];

    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: "1.5rem" }}>
          <div>
            <div className="title-accent" />
            <h1 style={{ fontSize: "1.8rem", marginBottom: 4 }}>{selectedCourse?.course_name}</h1>
            <p style={{ color: "var(--text-soft)", fontSize: "0.88rem" }}>
              Choose how you want to study this course.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn btn-ghost btn-sm"
              style={{ color: "var(--red, #e74c3c)", borderColor: "var(--red, #e74c3c)" }}
              disabled={enrollingId === selectedCourseId}
              onClick={() => handleUnenroll(selectedCourseId)}
            >
              {enrollingId === selectedCourseId ? "Leaving…" : "Leave Course"}
            </button>
            <button className="btn btn-ghost" onClick={() => setSelectedCourseId(null)}>
              ← Back
            </button>
          </div>
        </div>

        <div className="tab-bar">
          {([
            { key: "lessons", label: "📖 Lessons" },
            { key: "materials", label: "📁 Materials" },
          ] as { key: CourseTab; label: string }[]).map((t) => (
            <button
              key={t.key}
              className={`tab-btn ${activeTab === t.key ? "active" : ""}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === "lessons" && (
          <>
            {lessonLoading ? (
              <div style={{ padding: "1rem 0", color: "var(--text-soft)" }}>Loading lessons…</div>
            ) : lessonList.length === 0 ? (
              <div className="alert alert-warning">No published lessons yet for this course.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {lessonList.map((lesson) => (
                  <div
                    key={lesson.lesson_id}
                    className="card"
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", padding: "1rem 1.25rem", transition: "all 0.2s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "var(--shadow-md)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "var(--shadow-sm)"; e.currentTarget.style.transform = "translateY(0)"; }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: 3 }}>{lesson.week_title}</div>
                      <div style={{ fontSize: "0.78rem", color: "var(--text-soft)" }}>📄 {lesson.original_filename}</div>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={() => startLessonChat(lesson.lesson_id)}>
                      ▶ Start
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === "materials" && (
          <>
            {materials.length === 0 ? (
              <div className="alert alert-warning">No materials uploaded yet.</div>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.25rem" }}>
                  {materials.map((m) => (
                    <div key={m.file_hash} className="card" style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.7rem 1rem" }}>
                      <span style={{ fontSize: "1rem" }}>📄</span>
                      <span style={{ fontSize: "0.875rem", color: "var(--text-mid)", flex: 1 }}>{m.original_filename}</span>
                    </div>
                  ))}
                </div>
                <div className="card" style={{ padding: "1.1rem 1.25rem", background: "var(--orange-lt)", border: "1.5px solid var(--orange-md)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: 3 }}>Chat with all materials</div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-mid)" }}>Ask questions about any uploaded course document.</div>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={() => startMaterialsChat(selectedCourseId)}>
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

  // ── Main dashboard ──
  const enrolledIds = new Set(Object.keys(courseMap));

  return (
    <div>
      <div className="title-accent" />
      <h1 style={{ fontSize: "1.8rem", marginBottom: 6 }}>Start Learning</h1>
      <p style={{ color: "var(--text-soft)", marginBottom: "1.25rem", fontSize: "0.9rem" }}>
        Continue your courses or discover new ones.
      </p>

      <div className="tab-bar" style={{ marginBottom: "1.5rem" }}>
        <button
          className={`tab-btn ${dashTab === "enrolled" ? "active" : ""}`}
          onClick={() => switchDashTab("enrolled")}
        >
          📚 My Courses {enrolledIds.size > 0 && `(${enrolledIds.size})`}
        </button>
        <button
          className={`tab-btn ${dashTab === "browse" ? "active" : ""}`}
          onClick={() => switchDashTab("browse")}
        >
          🔍 Browse All
        </button>
      </div>

      {dashTab === "enrolled" && (
        <>
          {enrolledIds.size === 0 ? (
            <div className="alert alert-warning">
              You haven't enrolled in any courses yet.{" "}
              <button className="btn btn-ghost btn-sm" onClick={() => switchDashTab("browse")}>
                Browse courses →
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "1rem" }}>
              {Object.entries(courseMap).map(([id, course]) => (
                <CourseCard key={id} course={course} onOpen={() => openCourse(id)} />
              ))}
            </div>
          )}
        </>
      )}

      {dashTab === "browse" && (
        <>
          {browseLoading ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-soft)" }}>
              Loading courses…
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "1rem" }}>
              {Object.entries(allCourses).map(([id, course]) => {
                const isEnrolled = enrolledIds.has(id);
                return (
                  <BrowseCourseCard
                    key={id}
                    course={course}
                    isEnrolled={isEnrolled}
                    enrolling={enrollingId === id}
                    onEnroll={() => handleEnroll(id)}
                    onOpen={() => { switchDashTab("enrolled"); openCourse(id); }}
                  />
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Enrolled course card ──
function CourseCard({ course, onOpen }: { course: Course; onOpen: () => void }) {
  const materials = course.materials ?? [];
  const shown = materials.slice(0, 3);
  const extra = materials.length - shown.length;
  const imgSrc = getCourseImage(course.course_name);
  const [imgError, setImgError] = useState(false);

  return (
    <div
      className="card"
      style={{ overflow: "hidden", display: "flex", flexDirection: "column", cursor: "pointer", transition: "all 0.2s" }}
      onClick={onOpen}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "var(--shadow-hover)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "var(--shadow-sm)"; }}
    >
      {imgSrc && !imgError ? (
        <img src={imgSrc} alt={course.course_name} onError={() => setImgError(true)} style={{ width: "100%", height: 130, objectFit: "cover", display: "block" }} />
      ) : (
        <div style={{ height: 130, background: "var(--orange-lt)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.2rem", borderBottom: "1.5px solid var(--orange-md)" }}>
          📚
        </div>
      )}
      <div style={{ padding: "0.85rem 1rem", flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: 3 }}>{course.course_name}</div>
        <div style={{ fontSize: "0.76rem", color: "var(--text-soft)", marginBottom: 10 }}>👤 {course.teacher_username}</div>
        {shown.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {shown.map((m) => (
              <div key={m.file_hash} style={{ fontSize: "0.73rem", color: "var(--text-soft)", display: "flex", alignItems: "center", gap: 4 }}>
                <span>📄</span>
                {m.original_filename.length > 28 ? m.original_filename.slice(0, 28) + "…" : m.original_filename}
              </div>
            ))}
            {extra > 0 && <div style={{ fontSize: "0.7rem", color: "var(--orange)", fontWeight: 600 }}>+{extra} more</div>}
          </div>
        ) : (
          <div style={{ fontSize: "0.73rem", color: "var(--text-muted)" }}>No materials yet</div>
        )}
      </div>
      <div style={{ padding: "0 1rem 1rem" }}>
        <div className="btn btn-primary" style={{ width: "100%", padding: "0.5rem" }}>Open Course →</div>
      </div>
    </div>
  );
}

// ── Browse course card ──
function BrowseCourseCard({
  course,
  isEnrolled,
  enrolling,
  onEnroll,
  onOpen,
}: {
  course: Course;
  isEnrolled: boolean;
  enrolling: boolean;
  onEnroll: () => void;
  onOpen: () => void;
}) {
  const imgSrc = getCourseImage(course.course_name);
  const [imgError, setImgError] = useState(false);

  return (
    <div
      className="card"
      style={{ overflow: "hidden", display: "flex", flexDirection: "column", transition: "all 0.2s" }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "var(--shadow-hover)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "var(--shadow-sm)"; }}
    >
      {imgSrc && !imgError ? (
        <img src={imgSrc} alt={course.course_name} onError={() => setImgError(true)} style={{ width: "100%", height: 130, objectFit: "cover", display: "block" }} />
      ) : (
        <div style={{ height: 130, background: "var(--orange-lt)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.2rem", borderBottom: "1.5px solid var(--orange-md)" }}>
          📚
        </div>
      )}
      <div style={{ padding: "0.85rem 1rem", flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: 3 }}>{course.course_name}</div>
        <div style={{ fontSize: "0.76rem", color: "var(--text-soft)", marginBottom: 6 }}>👤 {course.teacher_username}</div>
        {isEnrolled && (
          <div style={{ fontSize: "0.72rem", color: "var(--green, #27ae60)", fontWeight: 600, marginBottom: 4 }}>
            ✓ Enrolled
          </div>
        )}
      </div>
      <div style={{ padding: "0 1rem 1rem" }}>
        {isEnrolled ? (
          <button className="btn btn-primary" style={{ width: "100%", padding: "0.5rem" }} onClick={onOpen}>
            Go to Course →
          </button>
        ) : (
          <button
            className="btn btn-primary"
            style={{ width: "100%", padding: "0.5rem", opacity: enrolling ? 0.6 : 1 }}
            disabled={enrolling}
            onClick={onEnroll}
          >
            {enrolling ? "Enrolling…" : "Enroll"}
          </button>
        )}
      </div>
    </div>
  );
}