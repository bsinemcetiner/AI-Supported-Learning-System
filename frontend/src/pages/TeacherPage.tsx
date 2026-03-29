import { useEffect, useState } from "react";
import { courses as coursesApi, lessons as lessonsApi } from "../services/api";
import type { Course, Material } from "../types";
import type { Lesson } from "../services/api";

export default function TeacherPage({ username }: { username: string }) {
  const [courseMap, setCourseMap] = useState<Record<string, Course>>({});
  const [lessonMap, setLessonMap] = useState<Record<string, Record<string, Lesson>>>({});
  const [activeTab, setActiveTab] = useState<"create" | "upload" | "upload_material" | "manage">("create");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  const [courseName, setCourseName] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [weekTitle, setWeekTitle] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);

  // Upload Material state
  const [materialCourseId, setMaterialCourseId] = useState("");
  const [materialFiles, setMaterialFiles] = useState<FileList | null>(null);

  const [previewText, setPreviewText] = useState<Record<string, string>>({});
  const [previewLoading, setPreviewLoading] = useState<Record<string, boolean>>({});
  const [feedbackDraft, setFeedbackDraft] = useState<Record<string, string>>({});
  const [customPromptDraft, setCustomPromptDraft] = useState<Record<string, string>>({});
  const [previewQuestionDraft, setPreviewQuestionDraft] = useState<Record<string, string>>({});
  const [publishDraft, setPublishDraft] = useState<Record<string, boolean>>({});
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  function showFeedback(type: "success" | "error" | "info", text: string) {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4500);
  }

  function setLessonBusy(lessonId: string, busy: boolean) {
    setActionLoading((prev) => ({ ...prev, [lessonId]: busy }));
  }

  async function loadCourses() {
    try {
      const data = await coursesApi.getMine();
      setCourseMap(data);

      const ids = Object.keys(data);
      if (ids.length > 0 && !selectedCourseId) {
        setSelectedCourseId(ids[0]);
      }
      if (ids.length > 0 && !materialCourseId) {
        setMaterialCourseId(ids[0]);
      }

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
      const nextCustomPrompt: Record<string, string> = {};
      const nextPreviewQuestion: Record<string, string> = {};
      const nextPublish: Record<string, boolean> = {};
      const nextPreviewText: Record<string, string> = {};

      for (const [courseId, lessons] of lessonEntries) {
        nextLessonMap[courseId] = lessons;

        Object.values(lessons).forEach((lesson) => {
          nextCustomPrompt[lesson.lesson_id] = lesson.custom_prompt ?? "";
          nextPreviewQuestion[lesson.lesson_id] =
            lesson.preview_question ??
            "Teach this lesson as a natural spoken teaching script.";
          nextPublish[lesson.lesson_id] = lesson.is_published ?? false;

          if (lesson.draft_explanation?.trim()) {
            nextPreviewText[lesson.lesson_id] = lesson.draft_explanation;
          }
        });
      }

      setLessonMap(nextLessonMap);
      setCustomPromptDraft((prev) => ({ ...nextCustomPrompt, ...prev }));
      setPreviewQuestionDraft((prev) => ({ ...nextPreviewQuestion, ...prev }));
      setPublishDraft((prev) => ({ ...nextPublish, ...prev }));
      setPreviewText((prev) => ({ ...nextPreviewText, ...prev }));
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
      showFeedback("success", `Course created: ${course_id}`);
      setCourseName("");
      await loadCourses();
    } catch (e: any) {
      showFeedback("error", e.message);
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
    if (!files || files.length === 0 || !selectedCourseId) return;

    setLoading(true);

    let added = 0;
    let skipped = 0;
    const errors: string[] = [];
    const allFiles = Array.from(files);

    for (const [index, file] of allFiles.entries()) {
      try {
        const derivedWeekTitle = inferWeekTitle(file, index, allFiles.length);
        await lessonsApi.upload(selectedCourseId, derivedWeekTitle, file);
        added++;
      } catch (e: any) {
        skipped++;
        errors.push(`${file.name}: ${e.message}`);
      }
    }

    errors.forEach((err) => showFeedback("error", err));
    showFeedback("info", `Done — Added: ${added} | Skipped: ${skipped}`);
    setFiles(null);
    setWeekTitle("");
    await loadCourses();
    setLoading(false);
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
    } catch (e: any) {
      showFeedback("error", e.message);
    }
  }

  async function handlePreview(lessonId: string) {
    setPreviewLoading((prev) => ({ ...prev, [lessonId]: true }));
    setPreviewText((prev) => ({ ...prev, [lessonId]: "" }));

    try {
      let full = "";
      for await (const delta of lessonsApi.previewStream(lessonId)) {
        full += delta;
        setPreviewText((prev) => ({ ...prev, [lessonId]: full }));
      }
      await loadCourses();
      showFeedback("success", "Preview generated.");
    } catch (e: any) {
      showFeedback("error", e.message || "Preview generation failed.");
    } finally {
      setPreviewLoading((prev) => ({ ...prev, [lessonId]: false }));
    }
  }

  async function handleSaveInstruction(lessonId: string) {
    setLessonBusy(lessonId, true);
    try {
      await lessonsApi.saveFeedback(
        lessonId,
        feedbackDraft[lessonId] ?? "",
        customPromptDraft[lessonId] ?? ""
      );
      setFeedbackDraft((prev) => ({ ...prev, [lessonId]: "" }));
      await loadCourses();
      showFeedback("success", "Instruction saved.");
    } catch (e: any) {
      showFeedback("error", e.message || "Could not save instruction.");
    } finally {
      setLessonBusy(lessonId, false);
    }
  }

  async function handleApplyFeedbackAndRegenerate(lessonId: string) {
    setLessonBusy(lessonId, true);
    try {
      await lessonsApi.saveFeedback(
        lessonId,
        feedbackDraft[lessonId] ?? "",
        customPromptDraft[lessonId] ?? ""
      );
      setFeedbackDraft((prev) => ({ ...prev, [lessonId]: "" }));

      setPreviewLoading((prev) => ({ ...prev, [lessonId]: true }));
      setPreviewText((prev) => ({ ...prev, [lessonId]: "" }));

      let full = "";
      for await (const delta of lessonsApi.previewStream(lessonId)) {
        full += delta;
        setPreviewText((prev) => ({ ...prev, [lessonId]: full }));
      }

      await loadCourses();
      showFeedback("success", "Feedback applied and preview regenerated.");
    } catch (e: any) {
      showFeedback("error", e.message || "Could not apply feedback.");
    } finally {
      setPreviewLoading((prev) => ({ ...prev, [lessonId]: false }));
      setLessonBusy(lessonId, false);
    }
  }

  async function handleSavePreviewQuestion(lessonId: string) {
    setLessonBusy(lessonId, true);
    try {
      await lessonsApi.updatePreviewQuestion(
        lessonId,
        previewQuestionDraft[lessonId] ??
          "Teach this lesson as a natural spoken teaching script."
      );
      await loadCourses();
      showFeedback("success", "Preview prompt updated.");
    } catch (e: any) {
      showFeedback("error", e.message);
    } finally {
      setLessonBusy(lessonId, false);
    }
  }

  async function handlePublishUpdate(lessonId: string) {
    setLessonBusy(lessonId, true);
    try {
      await lessonsApi.setPublished(lessonId, !!publishDraft[lessonId]);
      await loadCourses();
      showFeedback("success", "Publish state updated.");
    } catch (e: any) {
      showFeedback("error", e.message);
    } finally {
      setLessonBusy(lessonId, false);
    }
  }

  async function handleApprove(lessonId: string) {
    setLessonBusy(lessonId, true);
    try {
      await lessonsApi.approve(lessonId);
      setPublishDraft((prev) => ({ ...prev, [lessonId]: true }));
      await loadCourses();
      showFeedback("success", "Lesson approved and published for students.");
    } catch (e: any) {
      showFeedback("error", e.message || "Could not approve lesson.");
    } finally {
      setLessonBusy(lessonId, false);
    }
  }

  const courseList = Object.entries(courseMap);

  const tabs = [
    { key: "create",          label: "✦ Create Course" },
    { key: "upload",          label: "✦ Upload Lesson" },
    { key: "upload_material", label: "✦ Upload Material" },
    { key: "manage",          label: "✦ My Courses" },
  ] as const;

  return (
    <div>
      <div className="title-accent" />
      <h1 style={{ fontSize: "2rem", marginBottom: "1.5rem" }}>👩‍🏫 Teacher Dashboard</h1>

      {feedback && (
        <div className={`alert alert-${feedback.type}`} style={{ marginBottom: "1rem" }}>
          {feedback.text}
        </div>
      )}

      <div
        style={{
          display: "flex",
          background: "var(--card)",
          border: "1.5px solid var(--line)",
          borderRadius: "var(--r-md)",
          padding: 4,
          gap: 2,
          marginBottom: "1.5rem",
        }}
      >
        {tabs.map((t) => (
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

      {/* Create Course */}
      {activeTab === "create" && (
        <form onSubmit={handleCreate} style={{ maxWidth: 480, display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ color: "var(--text-mid)", fontSize: "0.9rem" }}>
            Give your course a clear, descriptive name.
          </p>
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
      )}

      {/* Upload Lesson */}
      {activeTab === "upload" && (
        <form onSubmit={handleUpload} style={{ maxWidth: 620, display: "flex", flexDirection: "column", gap: 14 }}>
          {courseList.length === 0 ? (
            <div className="alert alert-warning">⚠️ You need to create a course first.</div>
          ) : (
            <>
              <div>
                <label className="label">Select Course</label>
                <select className="select" value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)}>
                  {courseList.map(([id, c]) => (
                    <option key={id} value={id}>{c.course_name} ({id})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Week / Lesson Title</label>
                <input className="input" placeholder="e.g. Week 1" value={weekTitle} onChange={(e) => setWeekTitle(e.target.value)} />
                <p style={{ marginTop: 6, fontSize: "0.8rem", color: "var(--text-soft)" }}>
                  If you upload one file, this title will be used. If you upload multiple files, each file name will be used as the lesson title.
                </p>
              </div>
              <div>
                <label className="label">Upload PDF Files</label>
                <div
                  style={{ border: "2px dashed var(--line2)", borderRadius: "var(--r-lg)", padding: "2rem", textAlign: "center", background: "var(--card)", cursor: "pointer" }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); setFiles(e.dataTransfer.files); }}
                >
                  <input type="file" accept=".pdf" multiple style={{ display: "none" }} id="lesson-upload" onChange={(e) => setFiles(e.target.files)} />
                  <label htmlFor="lesson-upload" style={{ cursor: "pointer" }}>
                    <div style={{ fontSize: "2rem", marginBottom: 8 }}>📂</div>
                    <p style={{ color: "var(--text-soft)", fontSize: "0.9rem" }}>
                      {files && files.length > 0 ? `${files.length} file(s) selected` : "Click to browse or drag & drop PDF files here"}
                    </p>
                  </label>
                </div>
              </div>
              {files && files.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {Array.from(files).map((f, i) => (
                    <div key={i} style={{ background: "var(--orange-lt)", borderRadius: "var(--r-sm)", padding: "0.4rem 0.8rem", fontSize: "0.85rem", border: "1px solid var(--orange-md)" }}>
                      📄 {f.name}
                    </div>
                  ))}
                </div>
              )}
              <button className="btn btn-primary" type="submit" disabled={loading || !files || files.length === 0} style={{ alignSelf: "flex-start" }}>
                {loading ? "Uploading…" : "⬆️ Upload Lesson(s)"}
              </button>
            </>
          )}
        </form>
      )}

      {/* Upload Material */}
      {activeTab === "upload_material" && (
        <form onSubmit={handleUploadMaterial} style={{ maxWidth: 620, display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ color: "var(--text-mid)", fontSize: "0.9rem" }}>
            Upload PDF materials to a course. Students can chat with these materials using RAG.
          </p>
          {courseList.length === 0 ? (
            <div className="alert alert-warning">⚠️ You need to create a course first.</div>
          ) : (
            <>
              <div>
                <label className="label">Select Course</label>
                <select className="select" value={materialCourseId} onChange={(e) => setMaterialCourseId(e.target.value)}>
                  {courseList.map(([id, c]) => (
                    <option key={id} value={id}>{c.course_name} ({id})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Upload PDF Files</label>
                <div
                  style={{ border: "2px dashed var(--line2)", borderRadius: "var(--r-lg)", padding: "2rem", textAlign: "center", background: "var(--card)", cursor: "pointer" }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); setMaterialFiles(e.dataTransfer.files); }}
                >
                  <input type="file" accept=".pdf" multiple style={{ display: "none" }} id="material-upload" onChange={(e) => setMaterialFiles(e.target.files)} />
                  <label htmlFor="material-upload" style={{ cursor: "pointer" }}>
                    <div style={{ fontSize: "2rem", marginBottom: 8 }}>📁</div>
                    <p style={{ color: "var(--text-soft)", fontSize: "0.9rem" }}>
                      {materialFiles && materialFiles.length > 0 ? `${materialFiles.length} file(s) selected` : "Click to browse or drag & drop PDF files here"}
                    </p>
                  </label>
                </div>
              </div>
              {materialFiles && materialFiles.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {Array.from(materialFiles).map((f, i) => (
                    <div key={i} style={{ background: "var(--orange-lt)", borderRadius: "var(--r-sm)", padding: "0.4rem 0.8rem", fontSize: "0.85rem", border: "1px solid var(--orange-md)" }}>
                      📄 {f.name}
                    </div>
                  ))}
                </div>
              )}
              <button className="btn btn-primary" type="submit" disabled={loading || !materialFiles || materialFiles.length === 0} style={{ alignSelf: "flex-start" }}>
                {loading ? "Uploading…" : "⬆️ Upload Material(s)"}
              </button>
            </>
          )}
        </form>
      )}

      {/* My Courses */}
      {activeTab === "manage" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {courseList.length === 0 ? (
            <div className="alert alert-info">You haven't created any courses yet.</div>
          ) : (
            courseList.map(([id, course]) => (
              <CourseExpander
                key={id}
                course={course}
                lessons={lessonMap[id] ?? {}}
                previewText={previewText}
                previewLoading={previewLoading}
                feedbackDraft={feedbackDraft}
                customPromptDraft={customPromptDraft}
                previewQuestionDraft={previewQuestionDraft}
                publishDraft={publishDraft}
                actionLoading={actionLoading}
                setFeedbackDraft={setFeedbackDraft}
                setCustomPromptDraft={setCustomPromptDraft}
                setPreviewQuestionDraft={setPreviewQuestionDraft}
                setPublishDraft={setPublishDraft}
                onDeleteMaterial={(hash) => handleDeleteMaterial(id, hash)}
                onPreview={handlePreview}
                onSaveInstruction={handleSaveInstruction}
                onApplyFeedbackAndRegenerate={handleApplyFeedbackAndRegenerate}
                onSavePreviewQuestion={handleSavePreviewQuestion}
                onPublishUpdate={handlePublishUpdate}
                onApprove={handleApprove}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function CourseExpander({
  course, lessons, previewText, previewLoading, feedbackDraft, customPromptDraft,
  previewQuestionDraft, publishDraft, actionLoading, setFeedbackDraft, setCustomPromptDraft,
  setPreviewQuestionDraft, setPublishDraft, onDeleteMaterial, onPreview, onSaveInstruction,
  onApplyFeedbackAndRegenerate, onSavePreviewQuestion, onPublishUpdate, onApprove,
}: {
  course: Course;
  lessons: Record<string, Lesson>;
  previewText: Record<string, string>;
  previewLoading: Record<string, boolean>;
  feedbackDraft: Record<string, string>;
  customPromptDraft: Record<string, string>;
  previewQuestionDraft: Record<string, string>;
  publishDraft: Record<string, boolean>;
  actionLoading: Record<string, boolean>;
  setFeedbackDraft: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setCustomPromptDraft: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setPreviewQuestionDraft: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setPublishDraft: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onDeleteMaterial: (hash: string) => void;
  onPreview: (lessonId: string) => void;
  onSaveInstruction: (lessonId: string) => void;
  onApplyFeedbackAndRegenerate: (lessonId: string) => void;
  onSavePreviewQuestion: (lessonId: string) => void;
  onPublishUpdate: (lessonId: string) => void;
  onApprove: (lessonId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const materials = course.materials ?? [];
  const lessonList = Object.values(lessons);

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%", padding: "0.9rem 1.2rem", background: "var(--bg2)", border: "none",
          borderBottom: open ? "1.5px solid var(--line)" : "none", display: "flex",
          justifyContent: "space-between", alignItems: "center", cursor: "pointer",
          fontWeight: 600, fontSize: "0.95rem", color: "var(--text-mid)",
        }}
      >
        <span>📚 {course.course_name} · <span style={{ fontWeight: 400, opacity: 0.7 }}>{course.course_id}</span></span>
        <span style={{ fontSize: "0.75rem", color: "var(--text-soft)" }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{ padding: "1rem 1.2rem" }}>
          <div style={{ display: "flex", gap: "2rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
            <p style={{ fontSize: "0.85rem", color: "var(--text-mid)" }}><b>Teacher:</b> {course.teacher_username}</p>
            <p style={{ fontSize: "0.85rem", color: "var(--text-mid)" }}><b>Materials:</b> {materials.length}</p>
            <p style={{ fontSize: "0.85rem", color: "var(--text-mid)" }}><b>Lessons:</b> {lessonList.length}</p>
          </div>

          <h3 style={{ marginBottom: 10 }}>Materials</h3>
          {materials.length === 0 ? (
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>No materials uploaded yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 }}>
              {materials.map((m: Material) => (
                <div key={m.file_hash} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--orange-lt)", borderRadius: "var(--r-sm)", padding: "0.4rem 0.8rem", border: "1px solid var(--orange-md)", gap: 12 }}>
                  <span style={{ fontSize: "0.85rem" }}>📄 {m.original_filename}</span>
                  <button className="btn btn-danger" style={{ padding: "0.2rem 0.6rem", fontSize: "0.78rem" }} onClick={() => onDeleteMaterial(m.file_hash)}>
                    🗑 Delete
                  </button>
                </div>
              ))}
            </div>
          )}

          <h3 style={{ marginBottom: 10 }}>Lesson Tuning</h3>
          {lessonList.length === 0 ? (
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>No lesson uploaded yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {lessonList.map((lesson) => {
                const isBusy = !!actionLoading[lesson.lesson_id] || !!previewLoading[lesson.lesson_id];
                const shownPreview = previewText[lesson.lesson_id] || lesson.draft_explanation || "";
                const approvedExplanation = lesson.approved_explanation || "";

                return (
                  <div key={lesson.lesson_id} style={{ border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: "1rem", background: "var(--card)" }}>
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontWeight: 700 }}>{lesson.week_title}</div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-soft)" }}>📄 {lesson.original_filename}</div>
                    </div>

                    <div style={{ display: "grid", gap: 10 }}>
                      <div>
                        <label className="label">Preview Prompt</label>
                        <input
                          className="input"
                          value={previewQuestionDraft[lesson.lesson_id] ?? lesson.preview_question ?? "Teach this lesson as a natural spoken teaching script."}
                          onChange={(e) => setPreviewQuestionDraft((prev) => ({ ...prev, [lesson.lesson_id]: e.target.value }))}
                        />
                        <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
                          <button className="btn btn-ghost" type="button" onClick={() => onSavePreviewQuestion(lesson.lesson_id)} disabled={isBusy}>Save Preview Prompt</button>
                          <button className="btn btn-primary" type="button" onClick={() => onPreview(lesson.lesson_id)} disabled={isBusy}>
                            {previewLoading[lesson.lesson_id] ? "Generating…" : "Generate / Regenerate Preview"}
                          </button>
                        </div>
                        <p style={{ marginTop: 8, fontSize: "0.8rem", color: "var(--text-soft)" }}>
                          This preview is the spoken teaching script draft. After approval, students will see this same lesson text first.
                        </p>
                      </div>

                      {(shownPreview || previewLoading[lesson.lesson_id]) && (
                        <div>
                          <div className="label">Current Draft Preview</div>
                          <div style={{ background: "var(--bg2)", border: "1px solid var(--line)", borderRadius: "var(--r-sm)", padding: "0.9rem", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                            {shownPreview || "Generating preview…"}
                          </div>
                        </div>
                      )}

                      {approvedExplanation && (
                        <div>
                          <div className="label">Approved Student Version</div>
                          <div style={{ background: "#F7F3EE", border: "1px solid var(--orange-md)", borderRadius: "var(--r-sm)", padding: "0.9rem", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                            {approvedExplanation}
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="label">Teacher Feedback</label>
                        <textarea className="input" rows={4} placeholder="e.g. Explain this more deeply, add clearer transitions..." value={feedbackDraft[lesson.lesson_id] ?? ""} onChange={(e) => setFeedbackDraft((prev) => ({ ...prev, [lesson.lesson_id]: e.target.value }))} style={{ resize: "vertical" }} />
                      </div>

                      <div>
                        <label className="label">Final Custom Lesson Prompt</label>
                        <textarea className="input" rows={5} value={customPromptDraft[lesson.lesson_id] ?? lesson.custom_prompt ?? ""} onChange={(e) => setCustomPromptDraft((prev) => ({ ...prev, [lesson.lesson_id]: e.target.value }))} style={{ resize: "vertical" }} />
                      </div>

                      {lesson.teacher_feedback_history?.length > 0 && (
                        <div>
                          <div className="label">Saved Feedback History</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {lesson.teacher_feedback_history.map((item, index) => (
                              <div key={`${lesson.lesson_id}-${index}`} style={{ fontSize: "0.82rem", padding: "0.5rem 0.75rem", background: "var(--orange-lt)", border: "1px solid var(--orange-md)", borderRadius: "var(--r-sm)" }}>
                                {item}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <input type="checkbox" checked={publishDraft[lesson.lesson_id] ?? lesson.is_published ?? false} onChange={(e) => setPublishDraft((prev) => ({ ...prev, [lesson.lesson_id]: e.target.checked }))} />
                          Published for students
                        </label>
                        <button className="btn btn-ghost" type="button" onClick={() => onPublishUpdate(lesson.lesson_id)} disabled={isBusy}>Update Publish State</button>
                        <button className="btn btn-ghost" type="button" onClick={() => onSaveInstruction(lesson.lesson_id)} disabled={isBusy}>Save Instruction</button>
                        <button className="btn btn-primary" type="button" onClick={() => onApplyFeedbackAndRegenerate(lesson.lesson_id)} disabled={isBusy}>Apply Feedback & Regenerate</button>
                        <button className="btn btn-primary" type="button" onClick={() => onApprove(lesson.lesson_id)} disabled={isBusy || !shownPreview.trim()} style={{ background: "#1f8f5f" }}>Approve & Publish</button>
                      </div>

                      <p style={{ fontSize: "0.78rem", color: "var(--text-soft)", marginTop: 2 }}>
                        Recommended flow: write feedback → Apply Feedback & Regenerate → review draft → Approve & Publish.
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
