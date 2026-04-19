import { useEffect, useState } from "react";
import { courses as coursesApi, lessons as lessonsApi } from "../services/api";
import type { Course, Material } from "../types";
import type { Lesson } from "../services/api";
import { LessonSectionReview } from "./LessonSectionReview";
import { SectionDetailPage } from "./SectionDetailPage";

type View = "home" | "course" | "section";

type ActiveSection = {
  lesson: Lesson;
  sectionIndex: number;
};

export default function TeacherPage({ username }: { username: string }) {
  const [courseMap, setCourseMap] = useState<Record<string, Course>>({});
  const [lessonMap, setLessonMap] = useState<Record<string, Record<string, Lesson>>>({});
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // Navigation state
  const [view, setView] = useState<View>("home");
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [activeSection, setActiveSection] = useState<ActiveSection | null>(null);

  // Home tab
  const [homeTab, setHomeTab] = useState<"courses" | "create" | "upload" | "upload_material">("courses");

  // Form state
  const [courseName, setCourseName] = useState("");
  const [uploadCourseId, setUploadCourseId] = useState("");
  const [weekTitle, setWeekTitle] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [materialCourseId, setMaterialCourseId] = useState("");
  const [materialFiles, setMaterialFiles] = useState<FileList | null>(null);

  function showFeedback(type: "success" | "error" | "info", text: string) {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4500);
  }

  async function loadCourses() {
    try {
      const data = await coursesApi.getMine();
      setCourseMap(data);
      const ids = Object.keys(data);
      if (ids.length > 0 && !uploadCourseId) setUploadCourseId(ids[0]);
      if (ids.length > 0 && !materialCourseId) setMaterialCourseId(ids[0]);

      const lessonEntries = await Promise.all(
        ids.map(async (courseId) => {
          try {
            const lessons = await lessonsApi.getAllByCourse(courseId);
            return [courseId, lessons] as const;
          } catch {
            return [courseId, {}] as const;
          }
        })
      );

      const nextLessonMap: Record<string, Record<string, Lesson>> = {};
      for (const [courseId, lessons] of lessonEntries) {
        nextLessonMap[courseId] = lessons;
      }
      setLessonMap(nextLessonMap);
    } catch (e: any) {
      showFeedback("error", e.message || "Could not load data.");
    }
  }

  useEffect(() => { loadCourses(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!courseName.trim()) return;
    setLoading(true);
    try {
      const { course_id } = await coursesApi.create(courseName.trim());
      showFeedback("success", `Course created: ${course_id}`);
      setCourseName("");
      await loadCourses();
      setHomeTab("courses");
    } catch (e: any) { showFeedback("error", e.message); }
    finally { setLoading(false); }
  }

  function inferWeekTitle(file: File, index: number, total: number) {
    if (total === 1 && weekTitle.trim()) return weekTitle.trim();
    return file.name.replace(/\.pdf$/i, "") || `Week ${index + 1}`;
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!files || files.length === 0 || !uploadCourseId) return;
    setLoading(true);
    let added = 0, skipped = 0;
    const errors: string[] = [];
    for (const [index, file] of Array.from(files).entries()) {
      try {
        const result = await lessonsApi.upload(uploadCourseId, inferWeekTitle(file, index, files.length), file);
        showFeedback("info", `${file.name} → ${result.section_count} sections created.`);
        added++;
      } catch (e: any) { skipped++; errors.push(`${file.name}: ${e.message}`); }
    }
    errors.forEach((err) => showFeedback("error", err));
    if (added > 0) showFeedback("success", `Done — Added: ${added} | Skipped: ${skipped}`);
    setFiles(null); setWeekTitle("");
    await loadCourses();
    setLoading(false);
  }

  async function handleUploadMaterial(e: React.FormEvent) {
    e.preventDefault();
    if (!materialFiles || materialFiles.length === 0 || !materialCourseId) return;
    setLoading(true);
    let added = 0, skipped = 0;
    const errors: string[] = [];
    for (const file of Array.from(materialFiles)) {
      try { await coursesApi.uploadMaterial(materialCourseId, file); added++; }
      catch (e: any) { skipped++; errors.push(`${file.name}: ${e.message}`); }
    }
    errors.forEach((err) => showFeedback("error", err));
    showFeedback("info", `Done — Added: ${added} | Skipped: ${skipped}`);
    setMaterialFiles(null);
    await loadCourses();
    setLoading(false);
  }

  async function handleDeleteMaterial(course_id: string, file_hash: string) {
    try {
      await coursesApi.deleteMaterial(course_id, file_hash);
      showFeedback("success", "Material deleted.");
      await loadCourses();
    } catch (e: any) { showFeedback("error", e.message); }
  }

  function openCourse(courseId: string) {
    setSelectedCourseId(courseId);
    setView("course");
  }

  // ── Section Detail View ──────────────────────────────────────────────────
  if (view === "section" && activeSection) {
    return (
      <div>
        <div className="title-accent" />
        {feedback && <div className={`alert alert-${feedback.type}`} style={{ marginBottom: "1rem" }}>{feedback.text}</div>}
        <SectionDetailPage
          lesson={activeSection.lesson}
          sectionIndex={activeSection.sectionIndex}
          onBack={() => { setView("course"); setActiveSection(null); }}
          showFeedback={showFeedback}
          onApproved={loadCourses}
        />
      </div>
    );
  }

  // ── Course Detail View ───────────────────────────────────────────────────
  if (view === "course" && selectedCourseId) {
    const course = courseMap[selectedCourseId];
    const lessons = Object.values(lessonMap[selectedCourseId] ?? {});
    const materials = course?.materials ?? [];

    return (
      <div>
        <div className="title-accent" />
        {feedback && <div className={`alert alert-${feedback.type}`} style={{ marginBottom: "1rem" }}>{feedback.text}</div>}

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: "1.5rem" }}>
          <div>
            <button className="btn btn-ghost btn-sm" onClick={() => setView("home")} style={{ marginBottom: 10 }}>
              ← All Courses
            </button>
            <h1 style={{ fontSize: "1.8rem", marginBottom: 4 }}>{course?.course_name}</h1>
            <p style={{ fontSize: "0.82rem", color: "var(--text-soft)" }}>
              👤 {course?.teacher_username} · {materials.length} materials · {lessons.length} lessons
            </p>
          </div>
        </div>

        {/* Materials */}
        {materials.length > 0 && (
          <div style={{ marginBottom: "1.5rem" }}>
            <p className="section-label" style={{ marginBottom: 8 }}>Course Materials</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {materials.map((m: Material) => (
                <div key={m.file_hash} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: "var(--orange-lt)", borderRadius: "var(--r-md)",
                  padding: "0.6rem 1rem", border: "1px solid var(--orange-md)", gap: 12,
                }}>
                  <span style={{ fontSize: "0.85rem" }}>📄 {m.original_filename}</span>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDeleteMaterial(selectedCourseId, m.file_hash)}>
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lessons */}
        <p className="section-label" style={{ marginBottom: 10 }}>Lesson Tuning</p>
        {lessons.length === 0 ? (
          <div className="alert alert-info">No lessons uploaded yet. Go back and upload a lesson PDF.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {lessons.map((lesson) => (
              <LessonSectionReview
                key={lesson.lesson_id}
                lesson={lesson}
                onPublished={loadCourses}
                onOpenSection={(lesson, sectionIndex) => {
                  setActiveSection({ lesson, sectionIndex });
                  setView("section");
                }}
                showFeedback={showFeedback}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Home View ────────────────────────────────────────────────────────────
  const courseList = Object.entries(courseMap);

  const tabs = [
    { key: "courses",          label: "📚 My Courses" },
    { key: "create",           label: "+ Create" },
    { key: "upload",           label: "+ Upload Lesson" },
    { key: "upload_material",  label: "+ Upload Material" },
  ] as const;

  return (
    <div>
      <div className="title-accent" />
      <h1 style={{ fontSize: "1.8rem", marginBottom: "1.25rem" }}>👩‍🏫 Teacher Dashboard</h1>

      {feedback && <div className={`alert alert-${feedback.type}`} style={{ marginBottom: "1rem" }}>{feedback.text}</div>}

      {/* Tab bar */}
      <div className="tab-bar">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`tab-btn ${homeTab === t.key ? "active" : ""}`}
            onClick={() => setHomeTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* My Courses */}
      {homeTab === "courses" && (
        <>
          {courseList.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--text-soft)" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>📭</div>
              <p style={{ fontWeight: 600, color: "var(--text-mid)", marginBottom: 6 }}>No courses yet</p>
              <p style={{ fontSize: "0.85rem", marginBottom: 16 }}>Create your first course to get started.</p>
              <button className="btn btn-primary" onClick={() => setHomeTab("create")}>
                + Create Course
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "1rem" }}>
              {courseList.map(([id, course]) => {
                const lessons = Object.values(lessonMap[id] ?? {});
                const materials = course.materials ?? [];
                return (
                  <div
                    key={id}
                    className="card"
                    onClick={() => openCourse(id)}
                    style={{
                      cursor: "pointer",
                      transition: "all 0.2s",
                      overflow: "hidden",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-3px)";
                      e.currentTarget.style.boxShadow = "var(--shadow-hover)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "var(--shadow-sm)";
                    }}
                  >
                    {/* Kurs renk bandı */}
                    <div style={{
                      height: 6,
                      background: `hsl(${Math.abs(id.charCodeAt(0) * 7) % 360}, 60%, 55%)`,
                    }} />

                    <div style={{ padding: "1rem 1.1rem" }}>
                      <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: 4, color: "var(--text)" }}>
                        {course.course_name}
                      </div>
                      <div style={{ fontSize: "0.76rem", color: "var(--text-soft)", marginBottom: 12 }}>
                        👤 {course.teacher_username}
                      </div>

                      {/* Stats */}
                      <div style={{ display: "flex", gap: 12 }}>
                        <div style={{
                          flex: 1, background: "var(--bg2)", borderRadius: "var(--r-sm)",
                          padding: "0.5rem 0.7rem", textAlign: "center",
                        }}>
                          <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--orange)" }}>{lessons.length}</div>
                          <div style={{ fontSize: "0.68rem", color: "var(--text-soft)", marginTop: 1 }}>Lessons</div>
                        </div>
                        <div style={{
                          flex: 1, background: "var(--bg2)", borderRadius: "var(--r-sm)",
                          padding: "0.5rem 0.7rem", textAlign: "center",
                        }}>
                          <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--orange)" }}>{materials.length}</div>
                          <div style={{ fontSize: "0.68rem", color: "var(--text-soft)", marginTop: 1 }}>Materials</div>
                        </div>
                      </div>

                      <div style={{ marginTop: 12, fontSize: "0.78rem", color: "var(--orange)", fontWeight: 600 }}>
                        Open course →
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Create Course */}
      {homeTab === "create" && (
        <div style={{ maxWidth: 480 }}>
          <p style={{ color: "var(--text-soft)", fontSize: "0.88rem", marginBottom: "1.25rem" }}>
            Give your course a clear, descriptive name.
          </p>
          <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label className="label">Course Name</label>
              <input
                className="input"
                placeholder="e.g. Introduction to Quantum Physics"
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                required
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ alignSelf: "flex-start" }}>
              {loading ? "Creating…" : "Create Course →"}
            </button>
          </form>
        </div>
      )}

      {/* Upload Lesson */}
      {homeTab === "upload" && (
        <div style={{ maxWidth: 580 }}>
          {courseList.length === 0 ? (
            <div className="alert alert-warning">⚠️ Create a course first.</div>
          ) : (
            <form onSubmit={handleUpload} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="label">Select Course</label>
                <select className="select" value={uploadCourseId} onChange={(e) => setUploadCourseId(e.target.value)}>
                  {courseList.map(([id, c]) => (
                    <option key={id} value={id}>{c.course_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Week / Lesson Title</label>
                <input className="input" placeholder="e.g. Week 1" value={weekTitle} onChange={(e) => setWeekTitle(e.target.value)} />
                <p style={{ marginTop: 6, fontSize: "0.78rem", color: "var(--text-soft)" }}>
                  Multiple files use their filenames as titles.
                </p>
              </div>
              <div>
                <label className="label">Upload PDF Files</label>
                <div
                  style={{
                    border: "2px dashed var(--line2)", borderRadius: "var(--r-lg)",
                    padding: "2rem", textAlign: "center", background: "var(--card)", cursor: "pointer",
                    transition: "border-color 0.2s",
                  }}
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--orange)"; }}
                  onDragLeave={(e) => { e.currentTarget.style.borderColor = "var(--line2)"; }}
                  onDrop={(e) => { e.preventDefault(); setFiles(e.dataTransfer.files); e.currentTarget.style.borderColor = "var(--line2)"; }}
                >
                  <input type="file" accept=".pdf" multiple style={{ display: "none" }} id="lesson-upload" onChange={(e) => setFiles(e.target.files)} />
                  <label htmlFor="lesson-upload" style={{ cursor: "pointer" }}>
                    <div style={{ fontSize: "2rem", marginBottom: 8 }}>📂</div>
                    <p style={{ color: "var(--text-soft)", fontSize: "0.88rem" }}>
                      {files && files.length > 0 ? `${files.length} file(s) selected` : "Click to browse or drag & drop PDF files"}
                    </p>
                  </label>
                </div>
              </div>
              {files && files.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {Array.from(files).map((f, i) => (
                    <div key={i} style={{ background: "var(--orange-lt)", borderRadius: "var(--r-sm)", padding: "0.4rem 0.8rem", fontSize: "0.83rem", border: "1px solid var(--orange-md)" }}>
                      📄 {f.name}
                    </div>
                  ))}
                </div>
              )}
              <div className="alert alert-info" style={{ fontSize: "0.8rem" }}>
                ✨ AI will automatically split the PDF into logical sections after upload.
              </div>
              <button className="btn btn-primary" type="submit" disabled={loading || !files || files.length === 0} style={{ alignSelf: "flex-start" }}>
                {loading ? "Uploading & Analyzing…" : "⬆️ Upload Lesson(s)"}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Upload Material */}
      {homeTab === "upload_material" && (
        <div style={{ maxWidth: 580 }}>
          <p style={{ color: "var(--text-soft)", fontSize: "0.88rem", marginBottom: "1.25rem" }}>
            Upload PDF materials. Students can chat with these using RAG.
          </p>
          {courseList.length === 0 ? (
            <div className="alert alert-warning">⚠️ Create a course first.</div>
          ) : (
            <form onSubmit={handleUploadMaterial} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="label">Select Course</label>
                <select className="select" value={materialCourseId} onChange={(e) => setMaterialCourseId(e.target.value)}>
                  {courseList.map(([id, c]) => (
                    <option key={id} value={id}>{c.course_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Upload PDF Files</label>
                <div
                  style={{
                    border: "2px dashed var(--line2)", borderRadius: "var(--r-lg)",
                    padding: "2rem", textAlign: "center", background: "var(--card)", cursor: "pointer",
                    transition: "border-color 0.2s",
                  }}
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--orange)"; }}
                  onDragLeave={(e) => { e.currentTarget.style.borderColor = "var(--line2)"; }}
                  onDrop={(e) => { e.preventDefault(); setMaterialFiles(e.dataTransfer.files); e.currentTarget.style.borderColor = "var(--line2)"; }}
                >
                  <input type="file" accept=".pdf" multiple style={{ display: "none" }} id="material-upload" onChange={(e) => setMaterialFiles(e.target.files)} />
                  <label htmlFor="material-upload" style={{ cursor: "pointer" }}>
                    <div style={{ fontSize: "2rem", marginBottom: 8 }}>📁</div>
                    <p style={{ color: "var(--text-soft)", fontSize: "0.88rem" }}>
                      {materialFiles && materialFiles.length > 0 ? `${materialFiles.length} file(s) selected` : "Click to browse or drag & drop PDF files"}
                    </p>
                  </label>
                </div>
              </div>
              {materialFiles && materialFiles.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {Array.from(materialFiles).map((f, i) => (
                    <div key={i} style={{ background: "var(--orange-lt)", borderRadius: "var(--r-sm)", padding: "0.4rem 0.8rem", fontSize: "0.83rem", border: "1px solid var(--orange-md)" }}>
                      📄 {f.name}
                    </div>
                  ))}
                </div>
              )}
              <button className="btn btn-primary" type="submit" disabled={loading || !materialFiles || materialFiles.length === 0} style={{ alignSelf: "flex-start" }}>
                {loading ? "Uploading…" : "⬆️ Upload Material(s)"}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
