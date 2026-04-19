import { useState, useEffect } from "react";
import { lessons as lessonsApi } from "../services/api";
import type { Lesson, Section } from "../services/api";

interface SectionDetailPageProps {
  lesson: Lesson;
  sectionIndex: number;
  onBack: () => void;
  showFeedback: (type: "success" | "error" | "info", text: string) => void;
  onApproved: () => void;
}

export function SectionDetailPage({
  lesson,
  sectionIndex,
  onBack,
  showFeedback,
  onApproved,
}: SectionDetailPageProps) {
  const [section, setSection] = useState<Section | null>(null);
  const [promptDraft, setPromptDraft] = useState("");
  const [feedbackDraft, setFeedbackDraft] = useState("");
  const [draft, setDraft] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadSection();
  }, [lesson.lesson_id, sectionIndex]);

  async function loadSection() {
    try {
      const data = await lessonsApi.getSections(lesson.lesson_id);
      const sec = data.sections[sectionIndex];
      if (!sec) return;
      setSection(sec);
      setDraft(sec.draft || "");
      setPromptDraft(
        lesson.preview_question ||
          "Teach this lesson section as a natural spoken teaching script. Do not use bullet points unless absolutely necessary. Explain it clearly, conversationally, and in a teacher-like tone."
      );
      setLoaded(true);
    } catch (e: any) {
      showFeedback("error", e.message || "Could not load section.");
    }
  }

  async function handleSavePrompt() {
    setIsSavingPrompt(true);
    try {
      await lessonsApi.updatePreviewQuestion(lesson.lesson_id, promptDraft);
      showFeedback("success", "Preview prompt saved.");
    } catch (e: any) {
      showFeedback("error", e.message);
    } finally {
      setIsSavingPrompt(false);
    }
  }

  async function handleGenerate() {
    setIsGenerating(true);
    setDraft("");

    if (feedbackDraft.trim()) {
      try {
        await lessonsApi.saveFeedback(lesson.lesson_id, feedbackDraft);
        setFeedbackDraft("");
      } catch {}
    }

    try {
      let full = "";
      for await (const delta of lessonsApi.generateSectionStream(lesson.lesson_id, sectionIndex)) {
        full += delta;
        setDraft(full);
      }
      setSection((prev) => prev ? { ...prev, draft: full, approved: false } : prev);
      showFeedback("success", "Section generated successfully.");
    } catch (e: any) {
      showFeedback("error", e.message || "Generation failed.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleApprove() {
    if (!draft.trim()) {
      showFeedback("error", "Generate a preview first.");
      return;
    }
    setIsApproving(true);
    try {
      await lessonsApi.approveSection(lesson.lesson_id, sectionIndex);
      setSection((prev) => prev ? { ...prev, approved: true } : prev);
      showFeedback("success", `Section ${sectionIndex + 1} approved!`);
      onApproved();
    } catch (e: any) {
      showFeedback("error", e.message || "Could not approve.");
    } finally {
      setIsApproving(false);
    }
  }

  if (!loaded || !section) {
    return (
      <div style={{ padding: "2rem", color: "var(--text-soft)" }}>Loading section...</div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <button className="btn btn-ghost" onClick={onBack}>← Back</button>
        <div>
          <div style={{ fontSize: "0.78rem", color: "var(--text-soft)", marginBottom: 2 }}>
            {lesson.week_title} · Section {sectionIndex + 1} · Page {section.page_start}–{section.page_end}
          </div>
          <h2 style={{ fontSize: "1.4rem", margin: 0 }}>{section.title}</h2>
        </div>
        {section.approved && (
          <span style={{ marginLeft: "auto", fontSize: "0.82rem", background: "#E1F5EE", color: "#0F6E56", borderRadius: "99px", padding: "4px 14px", fontWeight: 600 }}>
            ✅ Approved
          </span>
        )}
      </div>

      {/* Sayfa İçeriği Önizleme */}
      <div className="card" style={{ padding: "0.9rem 1.25rem" }}>
        <div className="label" style={{ marginBottom: 6 }}>Page Content Preview</div>
        <div style={{ fontSize: "0.82rem", color: "var(--text-soft)", lineHeight: 1.6 }}>
          {section.text_preview}...
        </div>
      </div>

      {/* Prompt + Feedback yan yana */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        <div className="card" style={{ padding: "1rem 1.25rem" }}>
          <div className="label" style={{ marginBottom: 8 }}>Preview Prompt</div>
          <textarea
            className="input"
            rows={5}
            value={promptDraft}
            onChange={(e) => setPromptDraft(e.target.value)}
            style={{ resize: "vertical", fontSize: "0.85rem" }}
          />
          <button
            className="btn btn-ghost"
            onClick={handleSavePrompt}
            disabled={isSavingPrompt}
            style={{ marginTop: 8, fontSize: "0.82rem" }}
          >
            {isSavingPrompt ? "Saving..." : "Save Prompt"}
          </button>
        </div>

        <div className="card" style={{ padding: "1rem 1.25rem" }}>
          <div className="label" style={{ marginBottom: 8 }}>Teacher Feedback</div>
          <textarea
            className="input"
            rows={5}
            placeholder="e.g. Explain more deeply, add real-life examples, simplify the language..."
            value={feedbackDraft}
            onChange={(e) => setFeedbackDraft(e.target.value)}
            style={{ resize: "vertical", fontSize: "0.85rem" }}
          />
          <p style={{ fontSize: "0.75rem", color: "var(--text-soft)", marginTop: 6 }}>
            Feedback will be applied on next Generate.
          </p>
        </div>

      </div>

      {/* Butonlar */}
      <div style={{ display: "flex", gap: 10 }}>
        <button
          className="btn btn-primary"
          onClick={handleGenerate}
          disabled={isGenerating || isApproving}
          style={{ flex: 1, justifyContent: "center" }}
        >
          {isGenerating ? "Generating..." : draft ? "🔄 Regenerate" : "✨ Generate Preview"}
        </button>
        <button
          className="btn btn-primary"
          onClick={handleApprove}
          disabled={isGenerating || isApproving || !draft.trim() || section.approved}
          style={{
            flex: 1,
            justifyContent: "center",
            background: section.approved ? "var(--bg2)" : "#1f8f5f",
            color: section.approved ? "var(--text-soft)" : "#fff",
          }}
        >
          {isApproving ? "Approving..." : section.approved ? "✅ Approved" : "✅ Approve Section"}
        </button>
      </div>

      {/* AI Preview - tam genişlikte, sabit yükseklik */}
      {(draft || isGenerating) && (
        <div className="card" style={{ padding: "1rem 1.25rem" }}>
          <div className="label" style={{ marginBottom: 10 }}>
            AI Preview
            {isGenerating && (
              <span style={{ marginLeft: 8, fontSize: "0.72rem", color: "var(--orange)", fontWeight: 400 }}>
                generating...
              </span>
            )}
          </div>
          <div style={{
            background: "var(--bg2)",
            borderRadius: "var(--r-md)",
            padding: "1.25rem",
            fontSize: "0.9rem",
            lineHeight: 1.75,
            whiteSpace: "pre-wrap",
            overflowY: "auto",
            maxHeight: "420px",
            color: "var(--text-mid)",
          }}>
            {draft || "▌"}
          </div>
        </div>
      )}

      {/* Henüz generate edilmemişse placeholder */}
      {!draft && !isGenerating && (
        <div className="card" style={{ padding: "2rem 1.25rem", textAlign: "center" }}>
          <div style={{ fontSize: "2rem", marginBottom: 8 }}>✨</div>
          <p style={{ color: "var(--text-soft)", fontSize: "0.9rem" }}>
            No preview yet. Click <b>Generate Preview</b> to start.
          </p>
        </div>
      )}

    </div>
  );
}
