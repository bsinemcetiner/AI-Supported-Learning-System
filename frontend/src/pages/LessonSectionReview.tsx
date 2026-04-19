import { useState, useEffect } from "react";
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

  useEffect(() => {
    loadSections();
  }, [lesson.lesson_id]);

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
      showFeedback("success", `${result.section_count} sections published for students!`);
      onPublished();
    } catch (e: any) {
      showFeedback("error", e.message || "Could not publish.");
    } finally {
      setPublishing(false);
    }
  }

  const approvedCount = sections.filter((s) => s.approved).length;
  const allApproved = totalSections > 0 && approvedCount === totalSections;
  const progressPct = totalSections > 0 ? Math.round((approvedCount / totalSections) * 100) : 0;

  if (!loaded) {
    return (
      <div style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: "var(--r-lg)",
        padding: "1rem 1.25rem",
      }}>
        <div style={{ fontWeight: 700 }}>{lesson.week_title}</div>
        <div style={{ fontSize: "0.8rem", color: "var(--text-soft)", marginTop: 4 }}>Loading sections...</div>
      </div>
    );
  }

  return (
    <div style={{
      background: "var(--card)",
      border: "1px solid var(--line)",
      borderRadius: "var(--r-lg)",
      overflow: "hidden",
    }}>

      {/* Header */}
      <div style={{
        padding: "14px 18px",
        borderBottom: "1px solid var(--line)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 12,
      }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text)", margin: "0 0 2px" }}>
            {lesson.week_title}
          </p>
          <p style={{ fontSize: "0.78rem", color: "var(--text-soft)", margin: 0 }}>
            📄 {lesson.original_filename}
          </p>

          {/* Progress bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
            <div style={{
              flex: 1,
              maxWidth: 200,
              height: 6,
              background: "var(--bg3)",
              borderRadius: 99,
              overflow: "hidden",
            }}>
              <div style={{
                height: "100%",
                width: `${progressPct}%`,
                background: allApproved ? "#1D9E75" : approvedCount > 0 ? "#E8510A" : "var(--bg3)",
                borderRadius: 99,
                transition: "width 0.4s ease",
              }} />
            </div>
            <span style={{ fontSize: "0.75rem", color: "var(--text-soft)", whiteSpace: "nowrap" }}>
              {approvedCount} / {totalSections} approved
            </span>
          </div>
        </div>

        <button
          onClick={handlePublish}
          disabled={publishing || approvedCount === 0}
          style={{
            background: approvedCount === 0 ? "var(--bg2)" : allApproved ? "#1D9E75" : "var(--orange)",
            color: approvedCount === 0 ? "var(--text-soft)" : "#fff",
            border: "none",
            borderRadius: "var(--r-md)",
            padding: "8px 18px",
            fontSize: "0.85rem",
            fontWeight: 600,
            cursor: approvedCount === 0 ? "not-allowed" : "pointer",
            whiteSpace: "nowrap",
            transition: "all 0.2s",
            fontFamily: "inherit",
          }}
        >
          {publishing
            ? "Publishing..."
            : approvedCount === 0
            ? "Publish"
            : `🚀 Publish ${approvedCount} Section${approvedCount > 1 ? "s" : ""}`}
        </button>
      </div>

      {/* Section Cards Grid */}
      <div style={{
        padding: "14px 18px",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
        gap: 10,
      }}>
        {sections.map((section, index) => {
          const hasDraft = !!section.draft?.trim();
          const isApproved = section.approved;
          const isReady = hasDraft && !isApproved;

          const borderColor = isApproved ? "#5DCAA5" : isReady ? "#85B7EB" : "var(--line)";
          const bgColor = isApproved ? "#E1F5EE" : "var(--card)";
          const badgeBg = isApproved ? "#E1F5EE" : isReady ? "#E6F1FB" : "var(--bg3)";
          const badgeColor = isApproved ? "#085041" : isReady ? "#0C447C" : "var(--text-soft)";
          const badgeText = isApproved ? "Approved" : isReady ? "Ready" : "Pending";
          const hintColor = isApproved ? "#0F6E56" : "var(--orange)";

          return (
            <div
              key={index}
              onClick={() => onOpenSection(lesson, index)}
              style={{
                background: bgColor,
                border: `1px solid ${borderColor}`,
                borderRadius: "var(--r-md)",
                padding: "14px 16px",
                cursor: "pointer",
                transition: "transform 0.15s, border-color 0.15s",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.borderColor = "var(--orange)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.borderColor = borderColor;
              }}
            >
              {/* Üst satır */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.7rem", color: "var(--text-soft)", fontWeight: 600 }}>
                  Section {index + 1} · p.{section.page_start}–{section.page_end}
                </span>
                <span style={{
                  fontSize: "0.68rem",
                  fontWeight: 500,
                  borderRadius: 99,
                  padding: "2px 8px",
                  background: badgeBg,
                  color: badgeColor,
                }}>
                  {badgeText}
                </span>
              </div>

              {/* Başlık */}
              <p style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text)", margin: 0, lineHeight: 1.3 }}>
                {section.title}
              </p>

              {/* Özet */}
              {section.summary && (
                <p style={{ fontSize: "0.75rem", color: "var(--text-soft)", margin: 0, lineHeight: 1.5 }}>
                  {section.summary}
                </p>
              )}

              {/* Hint */}
              <p style={{ fontSize: "0.7rem", color: hintColor, fontWeight: 600, margin: "4px 0 0" }}>
                Click to edit →
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
