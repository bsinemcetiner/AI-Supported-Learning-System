import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap, BookOpen, Upload, FileText, CheckCircle2,
  Send, Sparkles, TrendingUp, BookMarked, ChevronRight,
  Plus, Layers, Users, Moon, Sun, Settings
} from "lucide-react";
import { courses as coursesApi, lessons as lessonsApi } from "../services/api";
import type { Course, Material } from "../types";
import type { Lesson } from "../services/api";
import { LessonSectionReview } from "./LessonSectionReview";
import { SectionDetailPage } from "./SectionDetailPage";

type View = "home" | "course" | "section";
type HomeTab = "quick-start" | "courses" | "create" | "upload" | "upload_material";
type ActiveSection = { lesson: Lesson; sectionIndex: number };

type StepStatus = "Done" | "Next" | "Pending" | "Available";

type FlowStep = {
  id: number;
  title: string;
  desc: string;
  icon: any;
  gradient: string;
  status: StepStatus;
};

function getStatusStyle(status: StepStatus) {
  if (status === "Done") {
    return {
      text: "✓ Done",
      bg: "rgba(16,185,129,0.12)",
      color: "#059669",
      border: "rgba(16,185,129,0.3)",
    };
  }

  if (status === "Next") {
    return {
      text: "Next",
      bg: "rgba(249,115,22,0.12)",
      color: "#ea580c",
      border: "rgba(249,115,22,0.3)",
    };
  }

  if (status === "Available") {
    return {
      text: "Available",
      bg: "rgba(59,130,246,0.12)",
      color: "#2563eb",
      border: "rgba(59,130,246,0.3)",
    };
  }

  return {
    text: "Pending",
    bg: "rgba(148,163,184,0.12)",
    color: "#64748b",
    border: "rgba(148,163,184,0.25)",
  };
}

function FlowStepCard({
  step,
  index,
  darkMode,
  textPrimary,
  textSecondary,
  borderColor,
}: {
  step: FlowStep;
  index: number;
  darkMode: boolean;
  textPrimary: string;
  textSecondary: string;
  borderColor: string;
}) {
  const status = getStatusStyle(step.status);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0, transition: { delay: 0.08 + index * 0.06 } }}
      whileHover={{ scale: 1.03, y: -3 }}
      style={{
        background: darkMode ? "rgba(15,23,42,0.7)" : "#fff",
        borderRadius: 16,
        border: `1px solid ${borderColor}`,
        boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
        padding: "1.1rem",
        cursor: "default",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minHeight: 150,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            padding: 10,
            background: step.gradient,
            borderRadius: 12,
            flexShrink: 0,
            boxShadow: "0 3px 10px rgba(0,0,0,0.15)",
          }}
        >
          <step.icon size={20} color="#fff" />
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.78rem", fontWeight: 700, color: textSecondary }}>
              {step.id}
            </span>

            <span
              style={{
                fontSize: "0.68rem",
                background: status.bg,
                color: status.color,
                border: `1px solid ${status.border}`,
                borderRadius: 99,
                padding: "2px 8px",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: 2,
              }}
            >
              {status.text}
            </span>
          </div>

          <h3
            style={{
              fontSize: "0.95rem",
              fontWeight: 700,
              color: textPrimary,
              margin: 0,
              lineHeight: 1.3,
            }}
          >
            {step.title}
          </h3>
        </div>
      </div>

      <p style={{ fontSize: "0.84rem", color: textSecondary, margin: 0, lineHeight: 1.55 }}>
        {step.desc}
      </p>
    </motion.div>
  );
}
const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.22 },
};

   export default function TeacherPage({
      username,
      onLogout,
      onSettings,
   }: {
      username: string;
      onLogout?: () => void;
      onSettings?: () => void;
   }) {
  const [courseMap, setCourseMap] = useState<Record<string, Course>>({});
  const [lessonMap, setLessonMap] = useState<Record<string, Record<string, Lesson>>>({});
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [darkMode, setDarkMode] = useState(false);

  const [view, setView] = useState<View>("home");
  const [homeTab, setHomeTab] = useState<HomeTab>("quick-start");
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [activeSection, setActiveSection] = useState<ActiveSection | null>(null);

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
      const entries = await Promise.all(
        ids.map(async (id) => {
          try { return [id, await lessonsApi.getAllByCourse(id)] as const; }
          catch { return [id, {}] as const; }
        })
      );
      const map: Record<string, Record<string, Lesson>> = {};
      for (const [id, l] of entries) map[id] = l;
      setLessonMap(map);
    } catch (e: any) { showFeedback("error", e.message); }
  }

  useEffect(() => { loadCourses(); }, []);

  const courseList = Object.entries(courseMap);
const totalLessons = Object.values(lessonMap).reduce((a, m) => a + Object.keys(m).length, 0);
const totalMaterials = courseList.reduce((a, [, c]) => a + (c.materials?.length ?? 0), 0);

const hasCourse = courseList.length > 0;
const hasLesson = totalLessons > 0;
const hasMaterial = totalMaterials > 0;

const lessonSteps: FlowStep[] = [
  {
    id: 1,
    title: "Create a course",
    desc: "Create the course where lessons will be published.",
    icon: BookOpen,
    gradient: "linear-gradient(135deg, #34d399, #0ea5e9)",
    status: hasCourse ? "Done" : "Next",
  },
  {
    id: 2,
    title: "Upload a lesson PDF",
    desc: "Upload a lesson file. The system splits it into sections automatically.",
    icon: Upload,
    gradient: "linear-gradient(135deg, #60a5fa, #22d3ee)",
    status: hasLesson ? "Done" : hasCourse ? "Next" : "Pending",
  },
  {
    id: 3,
    title: "Review sections",
    desc: "Open a course, generate previews, and check section quality.",
    icon: FileText,
    gradient: "linear-gradient(135deg, #fb923c, #f59e0b)",
    status: hasLesson ? "Next" : "Pending",
  },
  {
    id: 4,
    title: "Approve sections",
    desc: "Approve sections that are ready for students.",
    icon: CheckCircle2,
    gradient: "linear-gradient(135deg, #a78bfa, #ec4899)",
    status: "Pending",
  },
  {
    id: 5,
    title: "Publish",
    desc: "Publish approved sections for students.",
    icon: Send,
    gradient: "linear-gradient(135deg, #f87171, #fb7185)",
    status: "Pending",
  },
];

const materialSteps: FlowStep[] = [
  {
    id: 1,
    title: "Create a course",
    desc: "Use an existing course or create a new one.",
    icon: BookOpen,
    gradient: "linear-gradient(135deg, #34d399, #0ea5e9)",
    status: hasCourse ? "Done" : "Next",
  },
  {
    id: 2,
    title: "Upload material",
    desc: "Upload extra PDFs for course-wide chat support.",
    icon: Layers,
    gradient: "linear-gradient(135deg, #8b5cf6, #ec4899)",
    status: hasMaterial ? "Done" : hasCourse ? "Next" : "Pending",
  },
  {
    id: 3,
    title: "Materials available",
    desc: "Students can browse uploaded materials under the course page.",
    icon: FileText,
    gradient: "linear-gradient(135deg, #0ea5e9, #6366f1)",
    status: hasMaterial ? "Done" : "Pending",
  },
  {
    id: 4,
    title: "Chat support ready",
    desc: "Students can ask questions based on uploaded course documents.",
    icon: Sparkles,
    gradient: "linear-gradient(135deg, #f97316, #ec4899)",
    status: hasMaterial ? "Available" : "Pending",
  },
];


  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!courseName.trim()) return;
    setLoading(true);
    try {
      const { course_id } = await coursesApi.create(courseName.trim());
      showFeedback("success", `Course created: ${course_id}`);
      setCourseName(""); await loadCourses(); setHomeTab("courses");
    } catch (e: any) { showFeedback("error", e.message); }
    finally { setLoading(false); }
  }

  function inferWeekTitle(file: File, i: number, total: number) {
    if (total === 1 && weekTitle.trim()) return weekTitle.trim();
    return file.name.replace(/\.pdf$/i, "") || `Week ${i + 1}`;
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!files || !uploadCourseId) return;
    setLoading(true);
    let added = 0;
    for (const [i, f] of Array.from(files).entries()) {
      try { await lessonsApi.upload(uploadCourseId, inferWeekTitle(f, i, files.length), f); added++; }
      catch (e: any) { showFeedback("error", `${f.name}: ${e.message}`); }
    }
    if (added > 0) showFeedback("success", `${added} lesson(s) uploaded.`);
    setFiles(null); setWeekTitle(""); await loadCourses(); setLoading(false);
  }

  async function handleUploadMaterial(e: React.FormEvent) {
    e.preventDefault();
    if (!materialFiles || !materialCourseId) return;
    setLoading(true);
    let added = 0;
    for (const f of Array.from(materialFiles)) {
      try { await coursesApi.uploadMaterial(materialCourseId, f); added++; }
      catch (e: any) { showFeedback("error", `${f.name}: ${e.message}`); }
    }
    showFeedback("success", `${added} material(s) uploaded.`);
    setMaterialFiles(null); await loadCourses(); setLoading(false);
  }

  async function handleDeleteMaterial(course_id: string, file_hash: string) {
    try { await coursesApi.deleteMaterial(course_id, file_hash); showFeedback("success", "Deleted."); await loadCourses(); }
    catch (e: any) { showFeedback("error", e.message); }
  }

  const bg = darkMode
    ? "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)"
    : "linear-gradient(135deg, #fff7ed 0%, #fdf2f8 50%, #f5f3ff 100%)";

  const cardBg = darkMode ? "rgba(30,41,59,0.85)" : "rgba(255,255,255,0.85)";
  const textPrimary = darkMode ? "#f1f5f9" : "#111827";
  const textSecondary = darkMode ? "#94a3b8" : "#6b7280";
  const borderColor = darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.07)";

function TeacherTopHeader() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "2rem",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ position: "relative" }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(135deg, #fb923c, #ec4899)",
              borderRadius: 20,
              filter: "blur(12px)",
              opacity: 0.45,
            }}
          />
          <div
            style={{
              position: "relative",
              background: darkMode ? "#1e293b" : "#fff",
              padding: 14,
              borderRadius: 20,
              boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
            }}
          >
            <GraduationCap size={28} color="#f97316" />
          </div>
        </div>

        <div>
          <h1
            style={{
              fontSize: "2.2rem",
              fontWeight: 700,
              color: textPrimary,
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            Teacher Dashboard
          </h1>
          <p style={{ fontSize: "0.85rem", color: textSecondary, margin: 0 }}>
            AI-Powered Learning Platform
          </p>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setDarkMode(!darkMode)}
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: darkMode ? "#334155" : "#fff",
            border: `1px solid ${borderColor}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
          }}
        >
          {darkMode ? <Sun size={18} color="#fbbf24" /> : <Moon size={18} color="#6b7280" />}
        </motion.button>

        {onSettings && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onSettings}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              borderRadius: 12,
              background: darkMode ? "#334155" : "#fff",
              border: `1px solid ${borderColor}`,
              cursor: "pointer",
              fontSize: "0.85rem",
              fontWeight: 600,
              color: textSecondary,
              fontFamily: "inherit",
              boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
            }}
          >
            <Settings size={16} />
            Settings
          </motion.button>
        )}

        {onLogout && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onLogout}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              borderRadius: 12,
              background: darkMode ? "#334155" : "#fff",
              border: `1px solid ${borderColor}`,
              cursor: "pointer",
              fontSize: "0.85rem",
              fontWeight: 600,
              color: textSecondary,
              fontFamily: "inherit",
              boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
            }}
          >
            Logout
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

  // ── Section detail ──
  if (view === "section" && activeSection) {
    return (
       <div style={{ background: bg, minHeight: "100vh" }}>
        <div style={{ padding: "2rem 2rem", maxWidth: 1200, margin: "0 auto" }}>
          <TeacherTopHeader />
            <AnimatePresence>
              {feedback && <motion.div {...fadeUp} className={`alert alert-${feedback.type}`} style={{ marginBottom: 16 }}>{feedback.text}</motion.div>}
            </AnimatePresence>
            <SectionDetailPage
              lesson={activeSection.lesson}
              sectionIndex={activeSection.sectionIndex}
              onBack={() => { setView("course"); setActiveSection(null); }}
              showFeedback={showFeedback}
              onApproved={loadCourses}
              darkMode={darkMode}
              cardBg={cardBg}
              textPrimary={textPrimary}
              textSecondary={textSecondary}
              borderColor={borderColor}
            />
        </div>
      </div>
    );
  }

  // ── Course detail ──
  if (view === "course" && selectedCourseId) {
    const course = courseMap[selectedCourseId];
    const lessons = Object.values(lessonMap[selectedCourseId] ?? {});
    const materials = course?.materials ?? [];

    return (
  <div style={{ background: bg, minHeight: "100vh" }}>
    <div style={{ padding: "2rem 2rem", maxWidth: 1200, margin: "0 auto" }}>
      <TeacherTopHeader />

      <AnimatePresence>
        {feedback && (
          <motion.div
            {...fadeUp}
            className={`alert alert-${feedback.type}`}
            style={{ marginBottom: 16 }}
          >
            {feedback.text}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div {...fadeUp}>

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, fontSize: "0.82rem", color: textSecondary }}>
            <button onClick={() => setView("home")} style={{ background: "none", border: "none", cursor: "pointer", color: textSecondary, fontFamily: "inherit", fontSize: "0.82rem" }}>← All courses</button>
            <span>/</span>
            <span style={{ color: textPrimary, fontWeight: 600 }}>{course?.course_name}</span>
          </div>
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: textPrimary, marginBottom: 4 }}>{course?.course_name}</h1>
            <p style={{ fontSize: "0.82rem", color: textSecondary }}>👤 {course?.teacher_username} · {materials.length} materials · {lessons.length} lessons</p>
          </div>
          <div style={{ background: darkMode ? "rgba(251,146,60,0.1)" : "#fff7ed", border: "1px solid #fed7aa", borderRadius: 14, padding: "1rem 1.25rem", marginBottom: 20 }}>
            <p style={{ fontWeight: 700, fontSize: "0.88rem", color: "#ea580c", marginBottom: 4 }}>What to do on this page</p>
            <p style={{ fontSize: "0.82rem", color: darkMode ? "#fdba74" : "#92400e", margin: 0, lineHeight: 1.6 }}>
              First review each lesson section. Generate preview text if needed, approve the sections you like, then publish the approved sections for students.
            </p>
          </div>
          {materials.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: "0.72rem", fontWeight: 700, color: textSecondary, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Course Materials</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {materials.map((m: Material) => (
                  <div key={m.file_hash} style={{ background: cardBg, border: `1px solid ${borderColor}`, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.6rem 1rem" }}>
                    <span style={{ fontSize: "0.85rem", color: textPrimary }}>📄 {m.original_filename}</span>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDeleteMaterial(selectedCourseId, m.file_hash)}>Delete</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <p style={{ fontSize: "0.72rem", fontWeight: 700, color: textSecondary, textTransform: "uppercase", letterSpacing: "0.08em" }}>Lesson Review Wizard</p>
            <button className="btn btn-ghost btn-sm" onClick={() => { setView("home"); setHomeTab("upload"); }}>+ Upload another lesson</button>
          </div>
          {lessons.length === 0 ? (
            <div className="alert alert-info">No lessons yet. Upload a lesson PDF to get started.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {lessons.map((lesson) => (
                <LessonSectionReview
                  key={lesson.lesson_id}
                  lesson={lesson}
                  onPublished={loadCourses}
                  onOpenSection={(lesson, idx) => {
                    setActiveSection({ lesson, sectionIndex: idx });
                    setView("section");
                  }}
                  showFeedback={showFeedback}
                  darkMode={darkMode}
                  cardBg={cardBg}
                  textPrimary={textPrimary}
                  textSecondary={textSecondary}
                  borderColor={borderColor}
                />
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
    );
  }

  // ── Home ──
  const tabs: { id: HomeTab; label: string; icon: any }[] = [
    { id: "quick-start", label: "Quick Start", icon: Sparkles },
    { id: "courses", label: "My Courses", icon: BookMarked },
    { id: "create", label: "+ Create Course", icon: BookOpen },
    { id: "upload", label: "+ Upload Lesson", icon: Upload },
    { id: "upload_material", label: "+ Upload Material", icon: FileText },
  ];

  return (
    <div style={{ background: bg, minHeight: "100vh" }}>
      {/* Floating blobs */}
      <div style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
        <motion.div
          animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0], opacity: [0.25, 0.4, 0.25] }}
          transition={{ duration: 20, repeat: Infinity }}
          style={{ position: "absolute", top: -160, right: -160, width: 400, height: 400, background: "radial-gradient(circle, rgba(251,146,60,0.2), rgba(236,72,153,0.15))", borderRadius: "50%", filter: "blur(70px)" }}
        />
        <motion.div
          animate={{ scale: [1.2, 1, 1.2], rotate: [90, 0, 90], opacity: [0.3, 0.15, 0.3] }}
          transition={{ duration: 15, repeat: Infinity }}
          style={{ position: "absolute", bottom: -160, left: -160, width: 380, height: 380, background: "radial-gradient(circle, rgba(167,139,250,0.2), rgba(96,165,250,0.15))", borderRadius: "50%", filter: "blur(70px)" }}
        />
      </div>

      <div style={{ position: "relative", zIndex: 1, padding: "2rem 2rem", maxWidth: 1200, margin: "0 auto" }}>

        {/* Header */}
        <TeacherTopHeader />

        {/* Feedback */}
        <AnimatePresence>
          {feedback && <motion.div {...fadeUp} className={`alert alert-${feedback.type}`} style={{ marginBottom: 20 }}>{feedback.text}</motion.div>}
        </AnimatePresence>

        {/* Tab bar */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.1 } }}
          style={{
            display: "flex", gap: 6, padding: 8,
            background: darkMode ? "rgba(30,41,59,0.7)" : "rgba(255,255,255,0.6)",
            backdropFilter: "blur(20px)",
            borderRadius: 22,
            border: `1px solid ${darkMode ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.4)"}`,
            boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
            marginBottom: "2.5rem",
          }}
        >
          {tabs.map((t) => (
            <motion.button
              key={t.id}
              whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
              onClick={() => setHomeTab(t.id)}
              style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                padding: "13px 16px", borderRadius: 16, border: "none", cursor: "pointer",
                fontFamily: "inherit", fontSize: "0.9rem",
                fontWeight: homeTab === t.id ? 600 : 400,
                transition: "all 0.15s",
                background: homeTab === t.id ? "linear-gradient(135deg, #f97316, #ec4899)" : "transparent",
                color: homeTab === t.id ? "#fff" : textSecondary,
                boxShadow: homeTab === t.id ? "0 4px 16px rgba(249,115,22,0.4)" : "none",
              }}
            >
              <t.icon size={14} />
              {t.label}
            </motion.button>
          ))}
        </motion.div>

        {/* ── Quick Start ── */}
        {homeTab === "quick-start" && (
          <motion.div {...fadeUp}>
        {/* Flow Info */}
        <div
          style={{
            background: darkMode ? "rgba(59,130,246,0.10)" : "#eff6ff",
            border: darkMode ? "1px solid rgba(96,165,250,0.25)" : "1px solid #bfdbfe",
            borderRadius: 16,
            padding: "1rem 1.25rem",
            marginBottom: "1.25rem",
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              boxShadow: "0 4px 12px rgba(59,130,246,0.25)",
            }}
          >
            <Sparkles size={18} color="#fff" />
          </div>

          <div>
            <p
              style={{
                fontWeight: 800,
                fontSize: "0.92rem",
                color: darkMode ? "#bfdbfe" : "#1e40af",
                margin: "0 0 4px",
              }}
            >
              Lesson PDFs and course materials are used differently
            </p>

            <p
              style={{
                fontSize: "0.84rem",
                color: darkMode ? "#dbeafe" : "#1e3a8a",
                margin: 0,
                lineHeight: 1.6,
              }}
            >
              Lesson PDFs create structured, teacher-reviewed lesson pages. Course materials are extra supporting documents used for course-wide student chat and material search.
            </p>
          </div>
        </div>

            {/* Lesson Publishing Flow */}
            <div
              style={{
                background: cardBg,
                backdropFilter: "blur(20px)",
                borderRadius: 20,
                border: `1px solid ${borderColor}`,
                boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
                padding: "1.5rem 1.75rem",
                marginBottom: "1.5rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <div style={{ padding: 9, background: "linear-gradient(135deg, #fb923c, #ec4899)", borderRadius: 12 }}>
                  <TrendingUp size={18} color="#fff" />
                </div>
                <div>
                  <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: textPrimary, margin: 0 }}>
                    Lesson publishing flow
                  </h2>
                  <p style={{ color: textSecondary, fontSize: "0.86rem", margin: "4px 0 0", lineHeight: 1.55 }}>
                    Use this flow for structured lesson pages that teachers review, approve, and publish for students.
                  </p>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 10, marginTop: "1.5rem" }}>
                {lessonSteps.map((step, i) => (
                  <FlowStepCard
                    key={step.id}
                    step={step}
                    index={i}
                    darkMode={darkMode}
                    textPrimary={textPrimary}
                    textSecondary={textSecondary}
                    borderColor={borderColor}
                  />
                ))}
              </div>
            </div>

            {/* Course Material Support Flow */}
            <div
              style={{
                background: cardBg,
                backdropFilter: "blur(20px)",
                borderRadius: 20,
                border: `1px solid ${borderColor}`,
                boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
                padding: "1.5rem 1.75rem",
                marginBottom: "1.5rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <div style={{ padding: 9, background: "linear-gradient(135deg, #8b5cf6, #0ea5e9)", borderRadius: 12 }}>
                  <Layers size={18} color="#fff" />
                </div>
                <div>
                  <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: textPrimary, margin: 0 }}>
                    Course material support flow
                  </h2>
                  <p style={{ color: textSecondary, fontSize: "0.86rem", margin: "4px 0 0", lineHeight: 1.55 }}>
                    Use this flow for extra course PDFs that support student chat and course-wide material search.
                  </p>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, marginTop: "1.5rem" }}>
                {materialSteps.map((step, i) => (
                  <FlowStepCard
                    key={step.id}
                    step={step}
                    index={i}
                    darkMode={darkMode}
                    textPrimary={textPrimary}
                    textSecondary={textSecondary}
                    borderColor={borderColor}
                  />
                ))}
              </div>
            </div>

            {/* Stats + Courses */}
            <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16 }}>

              {/* Current progress */}
              <div style={{ background: cardBg, backdropFilter: "blur(20px)", borderRadius: 20, border: `1px solid ${borderColor}`, boxShadow: "0 4px 24px rgba(0,0,0,0.06)", padding: "1.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                  <div style={{ padding: 7, background: "linear-gradient(135deg, #60a5fa, #22d3ee)", borderRadius: 10 }}>
                    <Users size={15} color="#fff" />
                  </div>
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, color: textPrimary, margin: 0 }}>Current progress</h3>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { label: "Courses", value: courseList.length, gradient: "linear-gradient(135deg, #fb923c, #ec4899)", icon: BookOpen },
                    { label: "Lessons", value: totalLessons, gradient: "linear-gradient(135deg, #60a5fa, #22d3ee)", icon: FileText },
                    { label: "Materials", value: totalMaterials, gradient: "linear-gradient(135deg, #a78bfa, #ec4899)", icon: Layers },
                  ].map((stat, i) => (
                    <motion.div
                      key={stat.label}
                      initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0, transition: { delay: 0.15 + i * 0.06 } }}
                      whileHover={{ scale: 1.03 }}
                      style={{ background: darkMode ? "rgba(15,23,42,0.6)" : "#f9fafb", borderRadius: 13, padding: "11px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        <div style={{ padding: 6, background: stat.gradient, borderRadius: 8 }}>
                          <stat.icon size={13} color="#fff" />
                        </div>
                        <span style={{ fontSize: "0.85rem", color: textSecondary, fontWeight: 500 }}>{stat.label}</span>
                      </div>
                      <span style={{ fontSize: "1.6rem", fontWeight: 700, background: stat.gradient, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                        {stat.value}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Continue with course */}
              <div style={{ background: cardBg, backdropFilter: "blur(20px)", borderRadius: 20, border: `1px solid ${borderColor}`, boxShadow: "0 4px 24px rgba(0,0,0,0.06)", padding: "1.5rem" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, color: textPrimary, marginBottom: 16 }}>Continue with an existing course</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 12 }}>
                  {courseList.map(([id, course], i) => {
                    const lessons = Object.values(lessonMap[id] ?? {});
                    const mats = course.materials ?? [];
                    return (
                      <motion.div
                        key={id}
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, transition: { delay: i * 0.06 } }}
                        whileHover={{ scale: 1.03, y: -3 }}
                        onClick={() => { setSelectedCourseId(id); setView("course"); }}
                        style={{ background: darkMode ? "rgba(15,23,42,0.7)" : "linear-gradient(135deg, #fff, #f9fafb)", borderRadius: 16, border: `1px solid ${borderColor}`, boxShadow: "0 4px 16px rgba(0,0,0,0.06)", padding: "1.1rem", cursor: "pointer", position: "relative", overflow: "hidden" }}
                      >
                        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "linear-gradient(90deg, #34d399, #10b981)", width: lessons.length > 0 ? "65%" : "5%" }} />
                        <h4 style={{ fontSize: "0.9rem", fontWeight: 700, color: textPrimary, marginBottom: 7, marginTop: 6 }}>{course.course_name}</h4>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                          <div style={{ width: 22, height: 22, borderRadius: "50%", background: "linear-gradient(135deg, #fb923c, #ec4899)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.68rem", fontWeight: 700, color: "#fff" }}>
                            {course.teacher_username[0].toUpperCase()}
                          </div>
                          <span style={{ fontSize: "0.76rem", color: textSecondary }}>{course.teacher_username}</span>
                        </div>
                        {lessons.length > 0 && (
                          <span style={{ fontSize: "0.68rem", background: "rgba(16,185,129,0.1)", color: "#059669", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 99, padding: "2px 9px", fontWeight: 700 }}>
                            Lesson review is ready
                          </span>
                        )}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, margin: "10px 0" }}>
                          <div style={{ background: darkMode ? "rgba(251,146,60,0.1)" : "#fff7ed", borderRadius: 9, padding: "7px 9px", textAlign: "center" }}>
                            <div style={{ fontSize: "0.72rem", color: textSecondary }}>Lessons</div>
                            <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "#f97316" }}>{lessons.length}</div>
                          </div>
                          <div style={{ background: darkMode ? "rgba(167,139,250,0.1)" : "#f5f3ff", borderRadius: 9, padding: "7px 9px", textAlign: "center" }}>
                            <div style={{ fontSize: "0.72rem", color: textSecondary }}>Materials</div>
                            <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "#8b5cf6" }}>{mats.length}</div>
                          </div>
                        </div>
                        <div style={{ height: 4, background: darkMode ? "rgba(255,255,255,0.1)" : "#f3f4f6", borderRadius: 99, marginBottom: 10, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: lessons.length > 0 ? "65%" : "5%", background: "linear-gradient(90deg, #34d399, #10b981)", borderRadius: 99 }} />
                        </div>
                        <button style={{ width: "100%", padding: "9px", background: "linear-gradient(135deg, #f97316, #ec4899)", color: "#fff", border: "none", borderRadius: 11, fontSize: "0.83rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                          Open course →
                        </button>
                      </motion.div>
                    );
                  })}
                  <motion.div
                    whileHover={{ scale: 1.03 }}
                    onClick={() => setHomeTab("create")}
                    style={{ background: darkMode ? "rgba(15,23,42,0.4)" : "#f9fafb", borderRadius: 16, border: `1.5px dashed ${darkMode ? "#334155" : "#d1d5db"}`, padding: "1.1rem", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, minHeight: 170 }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: darkMode ? "#1e293b" : "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Plus size={18} color={textSecondary} />
                    </div>
                    <span style={{ fontSize: "0.85rem", color: textSecondary }}>New course</span>
                  </motion.div>
                </div>
              </div>
            </div>

            {/* Calendar */}
            <TeacherCalendar darkMode={darkMode} cardBg={cardBg} textPrimary={textPrimary} textSecondary={textSecondary} borderColor={borderColor} />

          </motion.div>
        )}

        {/* ── My Courses ── */}
        {homeTab === "courses" && (
          <motion.div {...fadeUp}>
            {courseList.length === 0 ? (
              <div style={{ textAlign: "center", padding: "4rem 1rem" }}>
                <div style={{ fontSize: "3rem", marginBottom: 14 }}>📭</div>
                <p style={{ fontWeight: 700, color: textPrimary, marginBottom: 8, fontSize: "1.1rem" }}>No courses yet</p>
                <p style={{ color: textSecondary, marginBottom: 20, fontSize: "0.88rem" }}>Create your first course to get started.</p>
                <button className="btn btn-primary" onClick={() => setHomeTab("create")}>+ Create Course</button>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
                {courseList.map(([id, course], i) => {
                  const lessons = Object.values(lessonMap[id] ?? {});
                  const mats = course.materials ?? [];
                  return (
                    <motion.div
                      key={id}
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, transition: { delay: i * 0.06 } }}
                      whileHover={{ scale: 1.03, y: -4 }}
                      onClick={() => { setSelectedCourseId(id); setView("course"); }}
                      style={{ background: cardBg, backdropFilter: "blur(10px)", borderRadius: 20, border: `1px solid ${borderColor}`, boxShadow: "0 4px 20px rgba(0,0,0,0.07)", padding: "1.4rem", cursor: "pointer", overflow: "hidden", position: "relative" }}
                    >
                      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "linear-gradient(90deg, #f97316, #ec4899)" }} />
                      <p style={{ fontWeight: 700, fontSize: "1rem", color: textPrimary, marginBottom: 4, marginTop: 6 }}>{course.course_name}</p>
                      <p style={{ fontSize: "0.78rem", color: textSecondary, marginBottom: 16 }}>👤 {course.teacher_username}</p>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                        <div style={{ background: darkMode ? "rgba(251,146,60,0.1)" : "#fff7ed", borderRadius: 10, padding: "10px", textAlign: "center" }}>
                          <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#f97316" }}>{lessons.length}</div>
                          <div style={{ fontSize: "0.7rem", color: textSecondary }}>Lessons</div>
                        </div>
                        <div style={{ background: darkMode ? "rgba(167,139,250,0.1)" : "#f5f3ff", borderRadius: 10, padding: "10px", textAlign: "center" }}>
                          <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#8b5cf6" }}>{mats.length}</div>
                          <div style={{ fontSize: "0.7rem", color: textSecondary }}>Materials</div>
                        </div>
                      </div>
                      <div style={{ fontSize: "0.82rem", color: "#f97316", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                        Open course <ChevronRight size={14} />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* ── Create ── */}
        {homeTab === "create" && (
          <motion.div {...fadeUp}>
            <div style={{ background: darkMode ? "rgba(251,146,60,0.08)" : "#fff7ed", border: "1px solid #fed7aa", borderRadius: 16, padding: "1rem 1.25rem", marginBottom: 20 }}>
              <p style={{ fontWeight: 700, fontSize: "0.88rem", color: "#ea580c", margin: "0 0 4px" }}>Step 1 of 5</p>
              <p style={{ fontSize: "0.83rem", color: darkMode ? "#fdba74" : "#92400e", margin: 0 }}>Create the course first. After that, you can upload lesson PDFs into it.</p>
            </div>
            <div style={{ maxWidth: 480 }}>
              <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label className="label">Course Name</label>
                  <input className="input" placeholder="e.g. Introduction to Quantum Physics" value={courseName} onChange={(e) => setCourseName(e.target.value)} required />
                </div>
                <button className="btn btn-primary" type="submit" disabled={loading} style={{ alignSelf: "flex-start" }}>
                  {loading ? "Creating…" : "Create Course →"}
                </button>
              </form>
            </div>
          </motion.div>
        )}

        {/* ── Upload Lesson ── */}
        {homeTab === "upload" && (
          <motion.div {...fadeUp}>
            {courseList.length === 0 ? (
              <div className="alert alert-warning">⚠️ Create a course first.</div>
            ) : (
              <>
                <div style={{ background: darkMode ? "rgba(251,146,60,0.08)" : "#fff7ed", border: "1px solid #fed7aa", borderRadius: 16, padding: "1rem 1.25rem", marginBottom: 20 }}>
                  <p style={{ fontWeight: 700, fontSize: "0.88rem", color: "#ea580c", margin: "0 0 4px" }}>Step 2 of 5</p>
                  <p style={{ fontSize: "0.83rem", color: darkMode ? "#fdba74" : "#92400e", margin: 0 }}>Upload a lesson PDF. The system will split it into sections automatically.</p>
                </div>
                <div style={{ maxWidth: 580 }}>
                  <form onSubmit={handleUpload} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div>
                      <label className="label">Select Course</label>
                      <select className="select" value={uploadCourseId} onChange={(e) => setUploadCourseId(e.target.value)}>
                        {courseList.map(([id, c]) => <option key={id} value={id}>{c.course_name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Week / Lesson Title</label>
                      <input className="input" placeholder="e.g. Week 1" value={weekTitle} onChange={(e) => setWeekTitle(e.target.value)} />
                      <p style={{ marginTop: 5, fontSize: "0.76rem", color: textSecondary }}>If you upload one file, this title will be used. Multiple files use their filenames.</p>
                    </div>
                    <div>
                      <label className="label">Upload PDF Files</label>
                      <div
                        style={{ border: "2px dashed #d1d5db", borderRadius: 18, padding: "2.5rem", textAlign: "center", background: darkMode ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.6)", cursor: "pointer", transition: "border-color 0.2s" }}
                        onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "#f97316"; }}
                        onDragLeave={(e) => { e.currentTarget.style.borderColor = "#d1d5db"; }}
                        onDrop={(e) => { e.preventDefault(); setFiles(e.dataTransfer.files); e.currentTarget.style.borderColor = "#d1d5db"; }}
                      >
                        <input type="file" accept=".pdf" multiple style={{ display: "none" }} id="lesson-upload" onChange={(e) => setFiles(e.target.files)} />
                        <label htmlFor="lesson-upload" style={{ cursor: "pointer" }}>
                          <Upload size={30} color="#9ca3af" style={{ margin: "0 auto 10px", display: "block" }} />
                          <p style={{ color: textSecondary, fontSize: "0.9rem", margin: 0 }}>
                            {files && files.length > 0 ? `${files.length} file(s) selected` : "Click to browse or drag & drop PDF files"}
                          </p>
                        </label>
                      </div>
                    </div>
                    {files && files.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        {Array.from(files).map((f, i) => (
                          <div key={i} style={{ background: "#fff7ed", borderRadius: 9, padding: "0.45rem 0.9rem", fontSize: "0.84rem", border: "1px solid #fed7aa", display: "flex", alignItems: "center", gap: 7 }}>
                            <FileText size={13} color="#f97316" /> {f.name}
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ background: darkMode ? "rgba(251,146,60,0.08)" : "#fff7ed", border: "1px solid #fed7aa", borderRadius: 12, padding: "0.75rem 1rem", fontSize: "0.82rem", color: "#ea580c" }}>
                      ✨ After upload, open the course and review the generated sections one by one.
                    </div>
                    <button className="btn btn-primary" type="submit" disabled={loading || !files || files.length === 0} style={{ alignSelf: "flex-start" }}>
                      {loading ? "Uploading & Analyzing…" : "⬆️ Upload Lesson(s)"}
                    </button>
                  </form>
                </div>
              </>
            )}
          </motion.div>
        )}

        {/* ── Upload Material ── */}
        {homeTab === "upload_material" && (
          <motion.div {...fadeUp}>
            {courseList.length === 0 ? (
              <div className="alert alert-warning">⚠️ Create a course first.</div>
            ) : (
              <>
                <div style={{ background: darkMode ? "rgba(255,255,255,0.05)" : "#f9fafb", border: `1px solid ${borderColor}`, borderRadius: 16, padding: "1rem 1.25rem", marginBottom: 20 }}>
                  <p style={{ fontWeight: 700, fontSize: "0.88rem", color: textSecondary, margin: "0 0 4px" }}>Optional step</p>
                  <p style={{ fontSize: "0.83rem", color: textSecondary, margin: 0 }}>Upload course materials for student chat support. This is separate from lesson tuning.</p>
                </div>
                <div style={{ maxWidth: 580 }}>
                  <form onSubmit={handleUploadMaterial} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div>
                      <label className="label">Select Course</label>
                      <select className="select" value={materialCourseId} onChange={(e) => setMaterialCourseId(e.target.value)}>
                        {courseList.map(([id, c]) => <option key={id} value={id}>{c.course_name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Upload PDF Files</label>
                      <div
                        style={{ border: "2px dashed #d1d5db", borderRadius: 18, padding: "2.5rem", textAlign: "center", background: darkMode ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.6)", cursor: "pointer", transition: "border-color 0.2s" }}
                        onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "#f97316"; }}
                        onDragLeave={(e) => { e.currentTarget.style.borderColor = "#d1d5db"; }}
                        onDrop={(e) => { e.preventDefault(); setMaterialFiles(e.dataTransfer.files); e.currentTarget.style.borderColor = "#d1d5db"; }}
                      >
                        <input type="file" accept=".pdf" multiple style={{ display: "none" }} id="material-upload" onChange={(e) => setMaterialFiles(e.target.files)} />
                        <label htmlFor="material-upload" style={{ cursor: "pointer" }}>
                          <Upload size={30} color="#9ca3af" style={{ margin: "0 auto 10px", display: "block" }} />
                          <p style={{ color: textSecondary, fontSize: "0.9rem", margin: 0 }}>
                            {materialFiles && materialFiles.length > 0 ? `${materialFiles.length} file(s) selected` : "Click to browse or drag & drop PDF files"}
                          </p>
                        </label>
                      </div>
                    </div>
                    <button className="btn btn-primary" type="submit" disabled={loading || !materialFiles || materialFiles.length === 0} style={{ alignSelf: "flex-start" }}>
                      {loading ? "Uploading…" : "⬆️ Upload Material(s)"}
                    </button>
                  </form>
                </div>
              </>
            )}
          </motion.div>
        )}

      </div>
    </div>
  );
}

// ── Teacher Calendar Component ────────────────────────────────────────────────
function TeacherCalendar({ darkMode, cardBg, textPrimary, textSecondary, borderColor }: {
  darkMode: boolean; cardBg: string; textPrimary: string; textSecondary: string; borderColor: string;
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const events = [
    { id: "1", title: "CE350 Linux Utilities", date: new Date(2026, 3, 23), time: "09:00-10:30", color: "#3b82f6" },
    { id: "2", title: "Assignment 2 Deadline", date: new Date(2026, 3, 25), time: "23:59", color: "#ef4444" },
    { id: "3", title: "Midterm Exam", date: new Date(2026, 3, 28), time: "10:00-12:00", color: "#8b5cf6" },
  ];

  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const dayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  const daysInMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const firstDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1).getDay();

  const isToday = (day: number) => {
    const t = new Date();
    return day === t.getDate() && currentDate.getMonth() === t.getMonth() && currentDate.getFullYear() === t.getFullYear();
  };

  const getEvents = (day: number) => events.filter(e =>
    e.date.getDate() === day && e.date.getMonth() === currentDate.getMonth() && e.date.getFullYear() === currentDate.getFullYear()
  );

  const days = [];
  for (let i = 0; i < firstDay(currentDate); i++) days.push(<div key={`e${i}`} />);
  for (let day = 1; day <= daysInMonth(currentDate); day++) {
    const todayFlag = isToday(day);
    const evts = getEvents(day);
    days.push(
      <button key={day} onClick={() => setSelectedDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), day))}
        style={{ aspectRatio: "1", borderRadius: 12, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "0.85rem", fontWeight: 600, position: "relative", transition: "all 0.15s",
          background: todayFlag ? "linear-gradient(135deg, #f97316, #ec4899)" : evts.length > 0 ? (darkMode ? "rgba(59,130,246,0.2)" : "#eff6ff") : "transparent",
          color: todayFlag ? "#fff" : evts.length > 0 ? "#3b82f6" : textPrimary,
          boxShadow: todayFlag ? "0 4px 12px rgba(249,115,22,0.35)" : "none",
        }}
        onMouseEnter={(e) => { if (!todayFlag) e.currentTarget.style.background = darkMode ? "rgba(255,255,255,0.08)" : "#f1f5f9"; }}
        onMouseLeave={(e) => { if (!todayFlag) e.currentTarget.style.background = evts.length > 0 ? (darkMode ? "rgba(59,130,246,0.2)" : "#eff6ff") : "transparent"; }}
      >
        {day}
        {evts.length > 0 && !todayFlag && (
          <div style={{ position: "absolute", bottom: 3, left: "50%", transform: "translateX(-50%)", width: 5, height: 5, borderRadius: "50%", background: "#3b82f6" }} />
        )}
      </button>
    );
  }

  const selectedEvents = selectedDate ? getEvents(selectedDate.getDate()) : [];

  return (
    <div style={{ background: cardBg, backdropFilter: "blur(20px)", borderRadius: 20, border: `1px solid ${borderColor}`, boxShadow: "0 4px 24px rgba(0,0,0,0.06)", padding: "1.5rem", marginTop: "1.25rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ padding: 8, background: "linear-gradient(135deg, #f97316, #ec4899)", borderRadius: 11 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <h3 style={{ fontSize: "1rem", fontWeight: 700, color: textPrimary, margin: 0 }}>Calendar</h3>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
            style={{ width: 32, height: 32, borderRadius: 10, border: `1px solid ${borderColor}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={textSecondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div style={{ textAlign: "center", minWidth: 130 }}>
            <p style={{ fontWeight: 700, fontSize: "0.9rem", color: textPrimary, margin: 0 }}>{monthNames[currentDate.getMonth()]}</p>
            <p style={{ fontSize: "0.75rem", color: textSecondary, margin: 0 }}>{currentDate.getFullYear()}</p>
          </div>
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
            style={{ width: 32, height: 32, borderRadius: 10, border: `1px solid ${borderColor}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={textSecondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      </div>

      {/* Day labels */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 6 }}>
        {dayNames.map((d) => (
          <div key={d} style={{ textAlign: "center", fontSize: "0.72rem", fontWeight: 700, color: textSecondary, padding: "4px 0" }}>{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: "1.25rem" }}>
        {days}
      </div>

      {/* Selected date events */}
      {selectedDate && (
        <div style={{ borderTop: `1px solid ${borderColor}`, paddingTop: "1rem", marginBottom: "1rem" }}>
          <p style={{ fontSize: "0.8rem", fontWeight: 700, color: textSecondary, marginBottom: 10 }}>
            Events on {selectedDate.toLocaleDateString()}
          </p>
          {selectedEvents.length > 0 ? selectedEvents.map((ev) => (
            <div key={ev.id} style={{ padding: "10px 12px", borderRadius: 12, marginBottom: 6, borderLeft: `4px solid ${ev.color}`, background: darkMode ? "rgba(255,255,255,0.05)" : "#f8fafc" }}>
              <p style={{ fontWeight: 600, color: textPrimary, fontSize: "0.85rem", margin: "0 0 3px" }}>{ev.title}</p>
              <p style={{ fontSize: "0.75rem", color: textSecondary, margin: 0 }}>🕐 {ev.time}</p>
            </div>
          )) : (
            <p style={{ fontSize: "0.82rem", color: textSecondary, textAlign: "center", padding: "1rem 0" }}>No events scheduled</p>
          )}
        </div>
      )}

      {/* Upcoming */}
      <div style={{ borderTop: `1px solid ${borderColor}`, paddingTop: "1rem" }}>
        <p style={{ fontSize: "0.8rem", fontWeight: 700, color: textSecondary, marginBottom: 10 }}>Upcoming Events</p>
        {events.map((ev) => (
          <div key={ev.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 12, marginBottom: 4, transition: "background 0.15s", cursor: "pointer" }}
            onMouseEnter={(e) => e.currentTarget.style.background = darkMode ? "rgba(255,255,255,0.05)" : "#f8fafc"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: ev.color, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 600, color: textPrimary, fontSize: "0.82rem", margin: "0 0 1px" }}>{ev.title}</p>
              <p style={{ fontSize: "0.72rem", color: textSecondary, margin: 0 }}>{ev.date.toLocaleDateString()} · {ev.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
