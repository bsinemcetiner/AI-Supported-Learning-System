import { useEffect, useMemo, useState } from "react";
import { courses as coursesApi, lessons as lessonsApi } from "../services/api";
import type { Course, Material } from "../types";
import type { Lesson } from "../services/api";
import { LessonSectionReview } from "./LessonSectionReview";
import { SectionDetailPage } from "./SectionDetailPage";

type View = "home" | "course" | "section";
type HomeTab = "wizard" | "courses" | "create" | "upload" | "upload_material";

type ActiveSection = {
  lesson: Lesson;
  sectionIndex: number;
};

type FeedbackState = {
  type: "success" | "error" | "info";
  text: string;
} | null;

export default function TeacherPage({ username }: { username: string }) {
  const [courseMap, setCourseMap] = useState<Record<string, Course>>({});
  const [lessonMap, setLessonMap] = useState<Record<string, Record<string, Lesson>>>({});
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);

  const [view, setView] = useState<View>("home");
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [activeSection, setActiveSection] = useState<ActiveSection | null>(null);

  const [homeTab, setHomeTab] = useState<HomeTab>("wizard");

  const [courseName, setCourseName] = useState("");
  const [uploadCourseId, setUploadCourseId] = useState("");
  const [weekTitle, setWeekTitle] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [materialCourseId, setMaterialCourseId] = useState("");
  const [materialFiles, setMaterialFiles] = useState<FileList | null>(null);

  function showFeedback(type: "success" | "error" | "info", text: string) {
    setFeedback({ type, text });
    window.clearTimeout((window as any).__teacher_feedback_timer);
    (window as any).__teacher_feedback_timer = window.setTimeout(() => {
      setFeedback(null);
    }, 4500);
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
      showFeedback("error", e.message || "Could not load teacher data.");
    }
  }

  useEffect(() => {
    loadCourses();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!courseName.trim()) return;

    setLoading(true);
    try {
      const { course_id } = await coursesApi.create(courseName.trim());
      showFeedback("success", `Course created successfully.`);
      setCourseName("");
      await loadCourses();
      setHomeTab("upload");
      setSelectedCourseId(course_id);
      setUploadCourseId(course_id);
      setMaterialCourseId(course_id);
    } catch (e: any) {
      showFeedback("error", e.message || "Could not create course.");
    } finally {
      setLoading(false);
    }
  }

  function inferWeekTitle(file: File, index: number, total: number) {
    if (total === 1 && weekTitle.trim()) return weekTitle.trim();
    return file.name.replace(/\.pdf$/i, "") || `Week ${index + 1}`;
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!files || files.length === 0 || !uploadCourseId) return;

    setLoading(true);
    let added = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const [index, file] of Array.from(files).entries()) {
      try {
        const result = await lessonsApi.upload(
          uploadCourseId,
          inferWeekTitle(file, index, files.length),
          file
        );
        added++;
        showFeedback(
          "success",
          `${file.name} uploaded. ${result.section_count} sections were created automatically.`
        );
      } catch (e: any) {
        skipped++;
        errors.push(`${file.name}: ${e.message}`);
      }
    }

    errors.forEach((err) => showFeedback("error", err));
    if (added > 0) {
      showFeedback("info", `Upload finished. Added: ${added} | Skipped: ${skipped}`);
    }

    setFiles(null);
    setWeekTitle("");
    await loadCourses();
    setLoading(false);

    if (uploadCourseId) {
      setSelectedCourseId(uploadCourseId);
      setView("course");
    }
  }

  async function handleUploadMaterial(e: React.FormEvent) {
    e.preventDefault();
    if (!materialFiles || materialFiles.length === 0 || !materialCourseId) return;

    setLoading(true);
    let added = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const file of Array.from(materialFiles)) {
      try {
        await coursesApi.uploadMaterial(materialCourseId, file);
        added++;
      } catch (e: any) {
        skipped++;
        errors.push(`${file.name}: ${e.message}`);
      }
    }

    errors.forEach((err) => showFeedback("error", err));
    if (added > 0) {
      showFeedback("success", `Material upload complete. Added: ${added} | Skipped: ${skipped}`);
    }

    setMaterialFiles(null);
    await loadCourses();
    setLoading(false);
  }

  async function handleDeleteMaterial(course_id: string, file_hash: string) {
    try {
      await coursesApi.deleteMaterial(course_id, file_hash);
      showFeedback("success", "Material deleted.");
      await loadCourses();
    } catch (e: any) {
      showFeedback("error", e.message || "Could not delete material.");
    }
  }

  function openCourse(courseId: string) {
    setSelectedCourseId(courseId);
    setView("course");
  }

  const courseList = Object.entries(courseMap);

  const wizardSummary = useMemo(() => {
    const courseCount = courseList.length;

    let totalLessons = 0;
    let totalMaterials = 0;
    let totalApprovedSections = 0;
    let totalSections = 0;

    for (const [courseId, course] of courseList) {
      totalMaterials += course.materials?.length ?? 0;

      const lessons = Object.values(lessonMap[courseId] ?? {});
      totalLessons += lessons.length;
    }

    return {
      courseCount,
      totalLessons,
      totalMaterials,
      totalApprovedSections,
      totalSections,
    };
  }, [courseList, lessonMap]);

  const wizardCurrentStep = useMemo(() => {
    if (wizardSummary.courseCount === 0) return 1;
    if (wizardSummary.totalLessons === 0) return 2;
    return 3;
  }, [wizardSummary]);

  function renderFeedback() {
    if (!feedback) return null;
    return (
      <div className={`alert alert-${feedback.type}`} style={{ marginBottom: "1rem" }}>
        {feedback.text}
      </div>
    );
  }

  function StepCard({
    step,
    title,
    desc,
    active,
    done,
    onClick,
  }: {
    step: number;
    title: string;
    desc: string;
    active?: boolean;
    done?: boolean;
    onClick?: () => void;
  }) {
    return (
      <div
        onClick={onClick}
        style={{
          background: active ? "var(--orange-lt)" : "var(--card)",
          border: active
            ? "1.5px solid var(--orange)"
            : done
            ? "1.5px solid #7cc7a6"
            : "1.5px solid var(--line)",
          borderRadius: "var(--r-lg)",
          padding: "1rem",
          cursor: onClick ? "pointer" : "default",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            borderRadius: 999,
            background: done ? "#dff5ea" : active ? "var(--orange)" : "var(--bg2)",
            color: done ? "#0f6e56" : active ? "#fff" : "var(--text-soft)",
            fontSize: "0.82rem",
            fontWeight: 700,
            marginBottom: 10,
          }}
        >
          {done ? "✓" : step}
        </div>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: "0.82rem", color: "var(--text-soft)", lineHeight: 1.5 }}>{desc}</div>
      </div>
    );
  }

  if (view === "section" && activeSection) {
    return (
      <div>
        <div className="title-accent" />
        {renderFeedback()}
        <SectionDetailPage
          lesson={activeSection.lesson}
          sectionIndex={activeSection.sectionIndex}
          onBack={() => {
            setView("course");
            setActiveSection(null);
          }}
          showFeedback={showFeedback}
          onApproved={loadCourses}
        />
      </div>
    );
  }

  if (view === "course" && selectedCourseId) {
    const course = courseMap[selectedCourseId];
    const lessons = Object.values(lessonMap[selectedCourseId] ?? {});
    const materials = course?.materials ?? [];

    return (
      <div>
        <div className="title-accent" />
        {renderFeedback()}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
            marginBottom: "1.25rem",
            flexWrap: "wrap",
          }}
        >
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

        <div
          className="card"
          style={{
            padding: "1rem 1.1rem",
            marginBottom: "1rem",
            background: "var(--orange-lt)",
            border: "1px solid var(--orange-md)",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>What to do on this page</div>
          <div style={{ fontSize: "0.84rem", color: "var(--text-mid)", lineHeight: 1.6 }}>
            First review each lesson section. Generate preview text if needed, approve the sections you like,
            then publish the approved sections for students.
          </div>
        </div>

        {materials.length > 0 && (
          <div style={{ marginBottom: "1.5rem" }}>
            <p className="section-label" style={{ marginBottom: 8 }}>Course Materials</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {materials.map((m: Material) => (
                <div
                  key={m.file_hash}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "var(--orange-lt)",
                    borderRadius: "var(--r-md)",
                    padding: "0.6rem 1rem",
                    border: "1px solid var(--orange-md)",
                    gap: 12,
                  }}
                >
                  <span style={{ fontSize: "0.85rem" }}>📄 {m.original_filename}</span>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDeleteMaterial(selectedCourseId, m.file_hash)}>
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
          <p className="section-label" style={{ marginBottom: 0 }}>Lesson Review Wizard</p>
          <button className="btn btn-ghost btn-sm" onClick={() => setHomeTab("upload")}>
            + Upload another lesson
          </button>
        </div>

        {lessons.length === 0 ? (
          <div className="alert alert-info">No lessons uploaded yet. Go back and upload a lesson PDF first.</div>
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

  const tabs = [
    { key: "wizard", label: "✨ Quick Start" },
    { key: "courses", label: "📚 My Courses" },
    { key: "create", label: "+ Create Course" },
    { key: "upload", label: "+ Upload Lesson" },
    { key: "upload_material", label: "+ Upload Material" },
  ] as const;

  return (
    <div>
      <div className="title-accent" />
      <h1 style={{ fontSize: "1.8rem", marginBottom: "1rem" }}>👩‍🏫 Teacher Dashboard</h1>

      {renderFeedback()}

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

      {homeTab === "wizard" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            className="card"
            style={{
              padding: "1rem 1.1rem",
              background: "var(--bg2)",
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Teacher flow</div>
            <div style={{ fontSize: "0.84rem", color: "var(--text-soft)", lineHeight: 1.6 }}>
              The system works best in this order: create a course, upload a lesson PDF, review sections,
              approve the good ones, then publish them.
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            <StepCard
              step={1}
              title="Create a course"
              desc="Start by creating the course where you want to place lessons and materials."
              active={wizardCurrentStep === 1}
              done={wizardSummary.courseCount > 0}
              onClick={() => setHomeTab("create")}
            />
            <StepCard
              step={2}
              title="Upload a lesson PDF"
              desc="Upload the lesson file. The system will split it into sections automatically."
              active={wizardCurrentStep === 2}
              done={wizardSummary.totalLessons > 0}
              onClick={() => setHomeTab("upload")}
            />
            <StepCard
              step={3}
              title="Review sections"
              desc="Open a course, generate or regenerate the preview, and check section quality."
              active={wizardCurrentStep === 3}
              done={false}
              onClick={() => {
                if (courseList[0]) openCourse(courseList[0][0]);
              }}
            />
            <StepCard
              step={4}
              title="Approve sections"
              desc="Approve sections that are ready for students."
              onClick={() => {
                if (courseList[0]) openCourse(courseList[0][0]);
              }}
            />
            <StepCard
              step={5}
              title="Publish approved sections"
              desc="Publish only after you are satisfied with the approved content."
              onClick={() => {
                if (courseList[0]) openCourse(courseList[0][0]);
              }}
            />
          </div>

          <div className="card" style={{ padding: "1rem 1.1rem" }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Current progress</div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 10,
              }}
            >
              <div style={{ background: "var(--bg2)", padding: "0.9rem", borderRadius: "var(--r-md)" }}>
                <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--orange)" }}>
                  {wizardSummary.courseCount}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-soft)" }}>Courses</div>
              </div>
              <div style={{ background: "var(--bg2)", padding: "0.9rem", borderRadius: "var(--r-md)" }}>
                <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--orange)" }}>
                  {wizardSummary.totalLessons}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-soft)" }}>Lessons</div>
              </div>
              <div style={{ background: "var(--bg2)", padding: "0.9rem", borderRadius: "var(--r-md)" }}>
                <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--orange)" }}>
                  {wizardSummary.totalMaterials}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-soft)" }}>Materials</div>
              </div>
            </div>
          </div>

          {courseList.length > 0 && (
            <div className="card" style={{ padding: "1rem 1.1rem" }}>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>Continue with an existing course</div>
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
                        border: "1px solid var(--line)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: 6,
                          background: `hsl(${Math.abs(id.charCodeAt(0) * 7) % 360}, 60%, 55%)`,
                        }}
                      />
                      <div style={{ padding: "1rem 1.1rem" }}>
                        <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: 4 }}>{course.course_name}</div>
                        <div style={{ fontSize: "0.76rem", color: "var(--text-soft)", marginBottom: 10 }}>
                          👤 {course.teacher_username}
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "var(--text-mid)", marginBottom: 8 }}>
                          {lessons.length === 0
                            ? "No lessons yet. Upload a lesson first."
                            : "Lesson review is ready."}
                        </div>
                        <div style={{ display: "flex", gap: 12 }}>
                          <div style={{ flex: 1, background: "var(--bg2)", borderRadius: "var(--r-sm)", padding: "0.5rem 0.7rem", textAlign: "center" }}>
                            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--orange)" }}>{lessons.length}</div>
                            <div style={{ fontSize: "0.68rem", color: "var(--text-soft)", marginTop: 1 }}>Lessons</div>
                          </div>
                          <div style={{ flex: 1, background: "var(--bg2)", borderRadius: "var(--r-sm)", padding: "0.5rem 0.7rem", textAlign: "center" }}>
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
            </div>
          )}
        </div>
      )}

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
                    style={{ cursor: "pointer", overflow: "hidden" }}
                  >
                    <div
                      style={{
                        height: 6,
                        background: `hsl(${Math.abs(id.charCodeAt(0) * 7) % 360}, 60%, 55%)`,
                      }}
                    />
                    <div style={{ padding: "1rem 1.1rem" }}>
                      <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: 4, color: "var(--text)" }}>
                        {course.course_name}
                      </div>
                      <div style={{ fontSize: "0.76rem", color: "var(--text-soft)", marginBottom: 12 }}>
                        👤 {course.teacher_username}
                      </div>

                      <div style={{ display: "flex", gap: 12 }}>
                        <div style={{ flex: 1, background: "var(--bg2)", borderRadius: "var(--r-sm)", padding: "0.5rem 0.7rem", textAlign: "center" }}>
                          <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--orange)" }}>{lessons.length}</div>
                          <div style={{ fontSize: "0.68rem", color: "var(--text-soft)", marginTop: 1 }}>Lessons</div>
                        </div>
                        <div style={{ flex: 1, background: "var(--bg2)", borderRadius: "var(--r-sm)", padding: "0.5rem 0.7rem", textAlign: "center" }}>
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

      {homeTab === "create" && (
        <div style={{ maxWidth: 520 }}>
          <div className="card" style={{ padding: "1rem 1.1rem", marginBottom: "1rem", background: "var(--orange-lt)", border: "1px solid var(--orange-md)" }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Step 1 of 5</div>
            <div style={{ fontSize: "0.84rem", color: "var(--text-mid)" }}>
              Create the course first. After that, you can upload lesson PDFs into it.
            </div>
          </div>

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

      {homeTab === "upload" && (
        <div style={{ maxWidth: 620 }}>
          <div className="card" style={{ padding: "1rem 1.1rem", marginBottom: "1rem", background: "var(--orange-lt)", border: "1px solid var(--orange-md)" }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Step 2 of 5</div>
            <div style={{ fontSize: "0.84rem", color: "var(--text-mid)" }}>
              Upload a lesson PDF. The system will split it into sections automatically.
            </div>
          </div>

          {courseList.length === 0 ? (
            <div className="alert alert-warning">Create a course first.</div>
          ) : (
            <form onSubmit={handleUpload} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="label">Select Course</label>
                <select className="select" value={uploadCourseId} onChange={(e) => setUploadCourseId(e.target.value)}>
                  {courseList.map(([id, c]) => (
                    <option key={id} value={id}>
                      {c.course_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Week / Lesson Title</label>
                <input
                  className="input"
                  placeholder="e.g. Week 1"
                  value={weekTitle}
                  onChange={(e) => setWeekTitle(e.target.value)}
                />
                <p style={{ marginTop: 6, fontSize: "0.78rem", color: "var(--text-soft)" }}>
                  If you upload one file, this title will be used. If you upload multiple files, filenames will be used.
                </p>
              </div>

              <div>
                <label className="label">Upload PDF Files</label>
                <div
                  style={{
                    border: "2px dashed var(--line2)",
                    borderRadius: "var(--r-lg)",
                    padding: "2rem",
                    textAlign: "center",
                    background: "var(--card)",
                    cursor: "pointer",
                    transition: "border-color 0.2s",
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.style.borderColor = "var(--orange)";
                  }}
                  onDragLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--line2)";
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setFiles(e.dataTransfer.files);
                    e.currentTarget.style.borderColor = "var(--line2)";
                  }}
                >
                  <input
                    type="file"
                    accept=".pdf"
                    multiple
                    style={{ display: "none" }}
                    id="lesson-upload"
                    onChange={(e) => setFiles(e.target.files)}
                  />
                  <label htmlFor="lesson-upload" style={{ cursor: "pointer" }}>
                    <div style={{ fontSize: "2rem", marginBottom: 8 }}>📂</div>
                    <p style={{ color: "var(--text-soft)", fontSize: "0.88rem" }}>
                      {files && files.length > 0
                        ? `${files.length} file(s) selected`
                        : "Click to browse or drag & drop PDF files"}
                    </p>
                  </label>
                </div>
              </div>

              {files && files.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {Array.from(files).map((f, i) => (
                    <div
                      key={i}
                      style={{
                        background: "var(--orange-lt)",
                        borderRadius: "var(--r-sm)",
                        padding: "0.4rem 0.8rem",
                        fontSize: "0.83rem",
                        border: "1px solid var(--orange-md)",
                      }}
                    >
                      📄 {f.name}
                    </div>
                  ))}
                </div>
              )}

              <div className="alert alert-info" style={{ fontSize: "0.8rem" }}>
                After upload, open the course and review the generated sections one by one.
              </div>

              <button
                className="btn btn-primary"
                type="submit"
                disabled={loading || !files || files.length === 0}
                style={{ alignSelf: "flex-start" }}
              >
                {loading ? "Uploading & Analyzing…" : "Upload Lesson(s) →"}
              </button>
            </form>
          )}
        </div>
      )}

      {homeTab === "upload_material" && (
        <div style={{ maxWidth: 620 }}>
          <div className="card" style={{ padding: "1rem 1.1rem", marginBottom: "1rem", background: "var(--bg2)" }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Optional step</div>
            <div style={{ fontSize: "0.84rem", color: "var(--text-mid)" }}>
              Upload course materials for student chat support. This is separate from lesson tuning.
            </div>
          </div>

          {courseList.length === 0 ? (
            <div className="alert alert-warning">Create a course first.</div>
          ) : (
            <form onSubmit={handleUploadMaterial} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label className="label">Select Course</label>
                <select className="select" value={materialCourseId} onChange={(e) => setMaterialCourseId(e.target.value)}>
                  {courseList.map(([id, c]) => (
                    <option key={id} value={id}>
                      {c.course_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Upload PDF Files</label>
                <div
                  style={{
                    border: "2px dashed var(--line2)",
                    borderRadius: "var(--r-lg)",
                    padding: "2rem",
                    textAlign: "center",
                    background: "var(--card)",
                    cursor: "pointer",
                    transition: "border-color 0.2s",
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.style.borderColor = "var(--orange)";
                  }}
                  onDragLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--line2)";
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setMaterialFiles(e.dataTransfer.files);
                    e.currentTarget.style.borderColor = "var(--line2)";
                  }}
                >
                  <input
                    type="file"
                    accept=".pdf"
                    multiple
                    style={{ display: "none" }}
                    id="material-upload"
                    onChange={(e) => setMaterialFiles(e.target.files)}
                  />
                  <label htmlFor="material-upload" style={{ cursor: "pointer" }}>
                    <div style={{ fontSize: "2rem", marginBottom: 8 }}>📁</div>
                    <p style={{ color: "var(--text-soft)", fontSize: "0.88rem" }}>
                      {materialFiles && materialFiles.length > 0
                        ? `${materialFiles.length} file(s) selected`
                        : "Click to browse or drag & drop PDF files"}
                    </p>
                  </label>
                </div>
              </div>

              {materialFiles && materialFiles.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {Array.from(materialFiles).map((f, i) => (
                    <div
                      key={i}
                      style={{
                        background: "var(--orange-lt)",
                        borderRadius: "var(--r-sm)",
                        padding: "0.4rem 0.8rem",
                        fontSize: "0.83rem",
                        border: "1px solid var(--orange-md)",
                      }}
                    >
                      📄 {f.name}
                    </div>
                  ))}
                </div>
              )}

              <button
                className="btn btn-primary"
                type="submit"
                disabled={loading || !materialFiles || materialFiles.length === 0}
                style={{ alignSelf: "flex-start" }}
              >
                {loading ? "Uploading…" : "Upload Material(s) →"}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}