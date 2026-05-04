import { useEffect, useState } from "react";
import { lessons as lessonsApi } from "../services/api";
import type { Lesson, Section } from "../services/api";

interface LessonSectionReviewProps {
  lesson: Lesson;
  onPublished: () => void;
  onDeleted: (lessonId: string) => void;
  onOpenSection: (lesson: Lesson, sectionIndex: number) => void;
  showFeedback: (type: "success" | "error" | "info", text: string) => void;
  darkMode: boolean;
  cardBg: string;
  textPrimary: string;
  textSecondary: string;
  borderColor: string;
}

export function LessonSectionReview({
  lesson,
  onPublished,
  onDeleted,
  onOpenSection,
  showFeedback,
  darkMode,
  cardBg,
  textPrimary,
  textSecondary,
  borderColor,
}: LessonSectionReviewProps) {
  const [sections, setSections] = useState<Section[]>([]);
  const [totalSections, setTotalSections] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [publishedCount, setPublishedCount] = useState(0);

  useEffect(() => { loadSections(); }, [lesson.lesson_id]);

  async function loadSections() {
    try {
      const data = await lessonsApi.getSections(lesson.lesson_id);
      setSections(data.sections);
      setTotalSections(data.total);
      setLoaded(true);
    } catch (e: any) {
      showFeedback("error", e.message || "Could not load sections.");
    }
  }

  async function handlePublish() {
    setPublishing(true);
    try {
      const result = await lessonsApi.publishSections(lesson.lesson_id);
      setPublishedCount(approvedCount);
      showFeedback("success", `${result.section_count} section(s) published for students.`);
      onPublished();
    } catch (e: any) {
      showFeedback("error", e.message || "Could not publish sections.");
    } finally {
      setPublishing(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await lessonsApi.delete(lesson.lesson_id);
      setDeleted(true);
      setTimeout(() => onDeleted(lesson.lesson_id), 1200);
    } catch (e: any) {
      showFeedback("error", e.message || "Could not delete lesson.");
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  const approvedCount = sections.filter((s) => s.approved).length;
  const draftCount = sections.filter((s) => !!s.draft?.trim()).length;
  const readyOnlyCount = sections.filter((s) => !!s.draft?.trim() && !s.approved).length;
  const pendingCount = totalSections - approvedCount - readyOnlyCount;
  const allApproved = totalSections > 0 && approvedCount === totalSections;
  const progressPct = totalSections > 0 ? Math.round((approvedCount / totalSections) * 100) : 0;
  const hasPublishedSections = publishedCount > 0;
  const allCurrentApprovedPublished = approvedCount > 0 && publishedCount >= approvedCount;

  function getStatusText() {
  if (totalSections === 0) return null;

  if (approvedCount === 0 && draftCount === 0) {
    return {
      icon: "⏱",
      text: "Start by opening a section and generating a preview.",
      color: darkMode ? "#fde68a" : "#92400e",
      bg: darkMode ? "rgba(251,191,36,0.10)" : "#fef3c7",
      border: darkMode ? "rgba(251,191,36,0.25)" : "#fde68a",
    };
  }

  if (approvedCount === 0 && draftCount > 0) {
    return {
      icon: "✨",
      text: "Some drafts are ready. Review them and approve the good ones.",
      color: darkMode ? "#bfdbfe" : "#1e40af",
      bg: darkMode ? "rgba(59,130,246,0.12)" : "#eff6ff",
      border: darkMode ? "rgba(59,130,246,0.25)" : "#bfdbfe",
    };
  }

  if (approvedCount > 0 && !allApproved) {
    return {
      icon: "⏱",
      text: "Some sections are approved. You can keep reviewing or publish approved ones now.",
      color: darkMode ? "#fdba74" : "#92400e",
      bg: darkMode ? "rgba(251,146,60,0.10)" : "#fff7ed",
      border: darkMode ? "rgba(251,146,60,0.30)" : "#fed7aa",
    };
  }

  if (allApproved) {
    return {
      icon: "✅",
      text: "All sections are approved. Ready to publish!",
      color: darkMode ? "#86efac" : "#065f46",
      bg: darkMode ? "rgba(16,185,129,0.12)" : "#ecfdf5",
      border: darkMode ? "rgba(16,185,129,0.30)" : "#6ee7b7",
    };
  }

  return null;
}

  if (!loaded) {
  return (
    <div
      style={{
        background: cardBg,
        borderRadius: 20,
        border: `1px solid ${borderColor}`,
        padding: "1.25rem 1.5rem",
        boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
      }}
    >
      <div style={{ fontWeight: 700, fontSize: "1rem", color: textPrimary }}>
        {lesson.week_title}
      </div>
      <div style={{ fontSize: "0.85rem", color: textSecondary, marginTop: 4 }}>
        Loading sections...
      </div>
    </div>
  );
}

  const status = getStatusText();

  // İkon kutusu için renkler
  const iconGradient = "linear-gradient(135deg, #fb923c, #ec4899)";

  if (deleted) {
    return (
      <div style={{
        background: cardBg,
        borderRadius: 20,
        border: "1px solid #86efac",
        boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
        overflow: "hidden",
        fontFamily: "inherit",
        padding: "1.25rem 1.5rem",
        display: "flex",
        alignItems: "center",
        gap: 12,
        opacity: 0,
        transform: "scale(0.97)",
        transition: "all 0.35s ease",
      }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "#16a34a" }}>
          "{lesson.week_title}" deleted.
        </span>
      </div>
    );
  }

  return (

      <div
        style={{
          background: cardBg,
          borderRadius: 20,
          border: `1px solid ${borderColor}`,
          boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
          overflow: "hidden",
          fontFamily: "inherit",
        }}
      >

      {/* Header */}
      <div style={{ padding: "1.25rem 1.5rem", borderBottom: `1px solid ${borderColor}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: iconGradient, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
            </div>
            <div>
              <p style={{ fontSize: "1rem", fontWeight: 700, color: textPrimary, margin: 0, lineHeight: 1.3 }}>{lesson.week_title}</p>
              <p style={{ fontSize: "0.8rem", color: textSecondary, margin: 0, marginTop: 2 }}>📄 {lesson.original_filename}</p>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, maxWidth: 260, height: 7, background: darkMode ? "rgba(255,255,255,0.12)" : "#f3f4f6", borderRadius: 99, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${progressPct}%`,
                background: allApproved ? "linear-gradient(90deg, #10b981, #059669)" : approvedCount > 0 ? "linear-gradient(90deg, #f97316, #ec4899)" : "#e5e7eb",
                borderRadius: 99,
                transition: "width 0.4s ease",
              }} />
            </div>
            <span style={{ fontSize: "0.8rem", color: textSecondary, whiteSpace: "nowrap", fontWeight: 500 }}>
              {approvedCount}/{totalSections} approved
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {/* Delete button / confirm */}
          {confirmDelete ? (
            <div style={{ display: "flex", gap: 6, alignItems: "center", background: darkMode ? "rgba(239,68,68,0.15)" : "#fff1f2", border: "1px solid #fca5a5", borderRadius: 14, padding: "8px 14px" }}>
              <span style={{ fontSize: "0.82rem", color: "#dc2626", fontWeight: 600 }}>Delete this lesson?</span>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{ background: "#dc2626", color: "#fff", border: "none", borderRadius: 10, padding: "6px 14px", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
              >
                {deleting ? "Deleting..." : "Yes, delete"}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                style={{ background: "transparent", color: "#6b7280", border: "1px solid #d1d5db", borderRadius: 10, padding: "6px 12px", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              title="Delete this lesson"
              style={{
                background: "transparent",
                color: darkMode ? "#f87171" : "#dc2626",
                border: `1px solid ${darkMode ? "rgba(248,113,113,0.35)" : "#fca5a5"}`,
                borderRadius: 12,
                padding: "9px 14px",
                fontSize: "0.82rem", fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", gap: 6,
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = darkMode ? "rgba(239,68,68,0.15)" : "#fff1f2"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
              Delete
            </button>
          )}

          {/* Publish button */}
          <button
          onClick={handlePublish}
          disabled={publishing || approvedCount === 0 || allCurrentApprovedPublished}
          style={{
            background:
              approvedCount === 0
                ? "#f3f4f6"
                : allCurrentApprovedPublished
                ? "linear-gradient(135deg, #10b981, #059669)"
                : allApproved
                ? "linear-gradient(135deg, #10b981, #059669)"
                : "linear-gradient(135deg, #f97316, #ec4899)",

            color: approvedCount === 0 ? "#9ca3af" : "#fff",
            border: "none", borderRadius: 14,
            padding: "11px 22px",
            fontSize: "0.9rem", fontWeight: 700,
            cursor:
              approvedCount === 0 || allCurrentApprovedPublished
                ? "not-allowed"
                : "pointer",
            whiteSpace: "nowrap",
            transition: "all 0.2s",
            fontFamily: "inherit",
            boxShadow:
              approvedCount === 0 || allCurrentApprovedPublished
                ? "none"
                : "0 4px 16px rgba(249,115,22,0.3)",
            display: "flex", alignItems: "center", gap: 8,
          }}
        >
         {publishing ? (
          "Publishing..."
        ) : approvedCount === 0 ? (
          "Approve first"
        ) : allCurrentApprovedPublished ? (
          <>✅ Published {publishedCount} Section{publishedCount > 1 ? "s" : ""}</>
        ) : hasPublishedSections && approvedCount > publishedCount ? (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
            Publish {approvedCount - publishedCount} New Section{approvedCount - publishedCount > 1 ? "s" : ""}
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
            Publish {approvedCount} Section{approvedCount > 1 ? "s" : ""}
          </>
        )}
        </button>
        </div>
      </div>

      {/* Status message */}
      {status && (
        <div style={{ padding: "0.75rem 1.5rem", background: status.bg, borderBottom: `1px solid ${status.border}`, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "0.9rem" }}>{status.icon}</span>
          <span style={{ fontSize: "0.85rem", color: status.color, fontWeight: 500 }}>{status.text}</span>
        </div>
      )}

      {/* Stats pills */}
      <div style={{ padding: "0.9rem 1.5rem", borderBottom:  `1px solid ${borderColor}`, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {[
  {
    label: `Total: ${totalSections}`,
    bg: darkMode ? "rgba(148,163,184,0.12)" : "#f3f4f6",
    color: darkMode ? "#cbd5e1" : "#374151",
    border: darkMode ? "rgba(148,163,184,0.25)" : "#e5e7eb",
  },
  {
    label: `Approved: ${approvedCount}`,
    bg: darkMode ? "rgba(16,185,129,0.12)" : "#ecfdf5",
    color: darkMode ? "#86efac" : "#065f46",
    border: darkMode ? "rgba(16,185,129,0.30)" : "#6ee7b7",
  },
  {
    label: `Draft ready: ${readyOnlyCount}`,
    bg: darkMode ? "rgba(59,130,246,0.12)" : "#eff6ff",
    color: darkMode ? "#bfdbfe" : "#1e40af",
    border: darkMode ? "rgba(59,130,246,0.30)" : "#bfdbfe",
  },
  {
    label: `Still pending: ${pendingCount}`,
    bg: darkMode ? "rgba(251,191,36,0.12)" : "#fef3c7",
    color: darkMode ? "#fde68a" : "#92400e",
    border: darkMode ? "rgba(251,191,36,0.30)" : "#fde68a",
  },
].map((pill) => (
          <span key={pill.label} style={{
            background: pill.bg, color: pill.color,
            border: `1px solid ${pill.border}`,
            borderRadius: 99, padding: "5px 13px",
            fontSize: "0.8rem", fontWeight: 600,
          }}>
            {pill.label}
          </span>
        ))}
      </div>

      {/* Section cards */}
      <div style={{ padding: "1.25rem 1.5rem", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
        {sections.map((section, index) => {
          const hasDraft = !!section.draft?.trim();
          const isApproved = section.approved;
          const isReady = hasDraft && !isApproved;

          const sectionBorderColor = isApproved
          ? "#10b981"
          : isReady
          ? "#60a5fa"
          : borderColor;

        const bgColor = isApproved
          ? darkMode
            ? "rgba(16,185,129,0.12)"
            : "#f0fdf4"
          : darkMode
          ? "rgba(15,23,42,0.55)"
          : "#fff";
          const badgeBg = isApproved ? "#dcfce7" : isReady ? "#dbeafe" : "#f3f4f6";
          const badgeColor = isApproved ? "#166534" : isReady ? "#1e40af" : "#6b7280";
          const badgeText = isApproved ? "Approved" : isReady ? "Draft ready" : "Needs preview";
          const hintText = isApproved ? "Review content →" : isReady ? "Approve or improve →" : "Generate preview →";
          const hintColor = isApproved ? "#10b981" : "#f97316";

          return (
            <div
              key={index}
              onClick={() => onOpenSection(lesson, index)}
              style={{
                background: bgColor,
                border: `1.5px solid ${sectionBorderColor}`,
                borderRadius: 16,
                padding: "1rem 1.1rem",
                cursor: "pointer",
                transition: "transform 0.15s, box-shadow 0.15s, border-color 0.15s",
                display: "flex", flexDirection: "column", gap: 7,
                position: "relative",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.09)";
                if (!isApproved) e.currentTarget.style.borderColor = "#f97316";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.borderColor = sectionBorderColor;
              }}
            >
              {/* Approved checkmark */}
              {isApproved && (
                <div style={{ position: "absolute", top: 10, right: 10, width: 22, height: 22, borderRadius: "50%", background: "#10b981", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
              )}

              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: "0.72rem", color: "#9ca3af", fontWeight: 600 }}>
                  Section {index + 1} · p.{section.page_start}–{section.page_end}
                </span>
                {!isApproved && (
                  <span style={{ fontSize: "0.68rem", fontWeight: 700, borderRadius: 99, padding: "2px 9px", background: badgeBg, color: badgeColor, whiteSpace: "nowrap" }}>
                    {badgeText}
                  </span>
                )}
              </div>

              {/* Title */}
              <p style={{ fontSize: "1rem", fontWeight: 700, color: textPrimary, margin: 0, lineHeight: 1.3 }}>
                {section.title}
              </p>

              {/* Summary */}
              {section.summary && (
                <p style={{ fontSize: "0.8rem", color: textSecondary, margin: 0, lineHeight: 1.55 }}>
                  {section.summary.length > 70 ? section.summary.slice(0, 70) + "..." : section.summary}
                </p>
              )}

              {/* Hint */}
              <div style={{ marginTop: 4, fontSize: "0.78rem", color: hintColor, fontWeight: 700 }}>
                {hintText}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
