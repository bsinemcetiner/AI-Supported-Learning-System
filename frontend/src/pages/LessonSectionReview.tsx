import { useEffect, useState } from "react";
import { lessons as lessonsApi } from "../services/api";
import type { Lesson, Section } from "../services/api";

interface LessonSectionReviewProps {
  lesson: Lesson;
  onPublished: () => void;
  onOpenSection: (lesson: Lesson, sectionIndex: number) => void;
  showFeedback: (type: "success" | "error" | "info", text: string) => void;
}

export function LessonSectionReview({
  lesson,
  onPublished,
  onOpenSection,
  showFeedback,
}: LessonSectionReviewProps) {
  const [sections, setSections] = useState<Section[]>([]);
  const [totalSections, setTotalSections] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [loaded, setLoaded] = useState(false);

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
      showFeedback("success", `${result.section_count} section(s) published for students.`);
      onPublished();
    } catch (e: any) {
      showFeedback("error", e.message || "Could not publish sections.");
    } finally {
      setPublishing(false);
    }
  }

  const approvedCount = sections.filter((s) => s.approved).length;
  const draftCount = sections.filter((s) => !!s.draft?.trim()).length;
  const pendingCount = totalSections - approvedCount - (draftCount - approvedCount > 0 ? draftCount - approvedCount : 0);
  const allApproved = totalSections > 0 && approvedCount === totalSections;
  const progressPct = totalSections > 0 ? Math.round((approvedCount / totalSections) * 100) : 0;

  function getStatusText() {
    if (totalSections === 0) return null;
    if (approvedCount === 0 && draftCount === 0) return { icon: "⏱", text: "Start by opening a section and generating a preview.", color: "#92400e", bg: "#fef3c7", border: "#fde68a" };
    if (approvedCount === 0 && draftCount > 0) return { icon: "✨", text: "Some drafts are ready. Review them and approve the good ones.", color: "#1e40af", bg: "#eff6ff", border: "#bfdbfe" };
    if (approvedCount > 0 && !allApproved) return { icon: "⏱", text: "Some sections are approved. You can keep reviewing or publish approved ones now.", color: "#92400e", bg: "#fff7ed", border: "#fed7aa" };
    if (allApproved) return { icon: "✅", text: "All sections are approved. Ready to publish!", color: "#065f46", bg: "#ecfdf5", border: "#6ee7b7" };
    return null;
  }

  if (!loaded) {
    return (
      <div style={{ background: "#fff", borderRadius: 20, border: "1px solid rgba(0,0,0,0.07)", padding: "1.25rem 1.5rem", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
        <div style={{ fontWeight: 700, fontSize: "1rem", color: "#111827" }}>{lesson.week_title}</div>
        <div style={{ fontSize: "0.85rem", color: "#9ca3af", marginTop: 4 }}>Loading sections...</div>
      </div>
    );
  }

  const status = getStatusText();

  // İkon kutusu için renkler
  const iconGradient = "linear-gradient(135deg, #fb923c, #ec4899)";

  return (
    <div style={{ background: "#fff", borderRadius: 20, border: "1px solid rgba(0,0,0,0.07)", boxShadow: "0 4px 20px rgba(0,0,0,0.06)", overflow: "hidden", fontFamily: "inherit" }}>

      {/* Header */}
      <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid rgba(0,0,0,0.06)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: iconGradient, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
            </div>
            <div>
              <p style={{ fontSize: "1rem", fontWeight: 700, color: "#111827", margin: 0, lineHeight: 1.3 }}>{lesson.week_title}</p>
              <p style={{ fontSize: "0.8rem", color: "#9ca3af", margin: 0, marginTop: 2 }}>📄 {lesson.original_filename}</p>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, maxWidth: 260, height: 7, background: "#f3f4f6", borderRadius: 99, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${progressPct}%`,
                background: allApproved ? "linear-gradient(90deg, #10b981, #059669)" : approvedCount > 0 ? "linear-gradient(90deg, #f97316, #ec4899)" : "#e5e7eb",
                borderRadius: 99,
                transition: "width 0.4s ease",
              }} />
            </div>
            <span style={{ fontSize: "0.8rem", color: "#6b7280", whiteSpace: "nowrap", fontWeight: 500 }}>
              {approvedCount}/{totalSections} approved
            </span>
          </div>
        </div>

        {/* Publish button */}
        <button
          onClick={handlePublish}
          disabled={publishing || approvedCount === 0}
          style={{
            background: approvedCount === 0 ? "#f3f4f6" : allApproved ? "linear-gradient(135deg, #10b981, #059669)" : "linear-gradient(135deg, #f97316, #ec4899)",
            color: approvedCount === 0 ? "#9ca3af" : "#fff",
            border: "none", borderRadius: 14,
            padding: "11px 22px",
            fontSize: "0.9rem", fontWeight: 700,
            cursor: approvedCount === 0 ? "not-allowed" : "pointer",
            whiteSpace: "nowrap",
            transition: "all 0.2s",
            fontFamily: "inherit",
            boxShadow: approvedCount === 0 ? "none" : "0 4px 16px rgba(249,115,22,0.3)",
            display: "flex", alignItems: "center", gap: 8,
          }}
        >
          {publishing ? (
            "Publishing..."
          ) : approvedCount === 0 ? (
            "Approve first"
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
              Publish {approvedCount} Section{approvedCount > 1 ? "s" : ""}
            </>
          )}
        </button>
      </div>

      {/* Status message */}
      {status && (
        <div style={{ padding: "0.75rem 1.5rem", background: status.bg, borderBottom: `1px solid ${status.border}`, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "0.9rem" }}>{status.icon}</span>
          <span style={{ fontSize: "0.85rem", color: status.color, fontWeight: 500 }}>{status.text}</span>
        </div>
      )}

      {/* Stats pills */}
      <div style={{ padding: "0.9rem 1.5rem", borderBottom: "1px solid rgba(0,0,0,0.05)", display: "flex", gap: 8, flexWrap: "wrap" }}>
        {[
          { label: `Total: ${totalSections}`, bg: "#f3f4f6", color: "#374151", border: "#e5e7eb" },
          { label: `Approved: ${approvedCount}`, bg: "#ecfdf5", color: "#065f46", border: "#6ee7b7", icon: "✓" },
          { label: `Draft ready: ${draftCount}`, bg: "#eff6ff", color: "#1e40af", border: "#bfdbfe", icon: "✨" },
          { label: `Still pending: ${totalSections - approvedCount - draftCount + approvedCount}`, bg: "#fef3c7", color: "#92400e", border: "#fde68a", icon: "⏱" },
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

          const borderColor = isApproved ? "#10b981" : isReady ? "#60a5fa" : "rgba(0,0,0,0.07)";
          const bgColor = isApproved ? "#f0fdf4" : "#fff";
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
                border: `1.5px solid ${borderColor}`,
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
                e.currentTarget.style.borderColor = borderColor;
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
              <p style={{ fontSize: "1rem", fontWeight: 700, color: "#111827", margin: 0, lineHeight: 1.3 }}>
                {section.title}
              </p>

              {/* Summary */}
              {section.summary && (
                <p style={{ fontSize: "0.8rem", color: "#6b7280", margin: 0, lineHeight: 1.55 }}>
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
