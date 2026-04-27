import { useEffect, useState } from "react";
import { lessons as lessonsApi } from "../services/api";
import type { Lesson, Section } from "../services/api";

interface SectionDetailPageProps {
  lesson: Lesson;
  sectionIndex: number;
  onBack: () => void;
  showFeedback: (type: "success" | "error" | "info", text: string) => void;
  onApproved: () => void;
}

// ─── Types for the rich JSON format ───────────────────────────────────────────

interface SlideBase {
  type: string;
  title: string;
  image_keyword?: string;
  highlight?: string;
}
interface IntroSlide extends SlideBase {
  type: "intro";
  subtitle: string;
  body: string;
}
interface ConceptSlide extends SlideBase {
  type: "concept" | "deep_dive" | "example";
  body: string;
}
interface ComparisonSlide extends SlideBase {
  type: "comparison";
  table: { headers: string[]; rows: string[][] };
}
interface SummarySlide extends SlideBase {
  type: "summary";
  points: string[];
  closing: string;
}
type Slide = IntroSlide | ConceptSlide | ComparisonSlide | SummarySlide;

interface LessonPageData {
  hero_keyword?: string;
  learning_objectives?: string[];
  slides: Slide[];
}

// ─── Unsplash image URL helper ─────────────────────────────────────────────────
function unsplashUrl(keyword: string, width = 800, height = 400, seed?: string): string {
  const q = encodeURIComponent(keyword);
  const s = seed || keyword;
  // Uses Unsplash Source (free, no API key needed)
  return `https://source.unsplash.com/${width}x${height}/?${q}&sig=${encodeURIComponent(s)}`;
}

// ─── Slide type accent colours ─────────────────────────────────────────────────
const SLIDE_ACCENTS: Record<string, { grad: string; light: string; icon: string }> = {
  intro:      { grad: "linear-gradient(135deg,#6366f1,#8b5cf6)", light: "#ede9fe", icon: "🚀" },
  concept:    { grad: "linear-gradient(135deg,#0ea5e9,#6366f1)", light: "#e0f2fe", icon: "💡" },
  deep_dive:  { grad: "linear-gradient(135deg,#f97316,#ef4444)", light: "#fff7ed", icon: "🔬" },
  example:    { grad: "linear-gradient(135deg,#10b981,#0ea5e9)", light: "#ecfdf5", icon: "📌" },
  comparison: { grad: "linear-gradient(135deg,#f59e0b,#f97316)", light: "#fffbeb", icon: "⚖️" },
  summary:    { grad: "linear-gradient(135deg,#ec4899,#f97316)", light: "#fdf2f8", icon: "✅" },
};

function accent(type: string) {
  return SLIDE_ACCENTS[type] || SLIDE_ACCENTS["concept"];
}

// ─── Individual slide renderers ────────────────────────────────────────────────

function SlideImage({ keyword, seed, height = 220 }: { keyword: string; seed?: string; height?: number }) {
  const [errored, setErrored] = useState(false);
  if (!keyword || errored) return null;
  return (
    <div style={{
      width: "100%", height, borderRadius: 14, overflow: "hidden",
      marginBottom: 20, position: "relative",
      boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
    }}>
      <img
        src={unsplashUrl(keyword, 900, height * 2, seed)}
        alt={keyword}
        onError={() => setErrored(true)}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.35) 100%)",
      }} />
    </div>
  );
}

function HighlightBox({ text, grad }: { text: string; grad: string }) {
  return (
    <div style={{
      marginTop: 18,
      padding: "14px 18px",
      borderRadius: 12,
      background: grad,
      color: "#fff",
      fontSize: "0.92rem",
      fontWeight: 600,
      lineHeight: 1.55,
      boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
    }}>
      <span style={{ opacity: 0.8, marginRight: 8 }}>💬</span>{text}
    </div>
  );
}

function SlideCard({ slide, index }: { slide: Slide; index: number }) {
  const ac = accent(slide.type);

  return (
    <div style={{
      background: "#fff",
      borderRadius: 20,
      overflow: "hidden",
      border: "1px solid rgba(0,0,0,0.07)",
      boxShadow: "0 2px 20px rgba(0,0,0,0.06)",
      marginBottom: 24,
    }}>
      {/* Slide header band */}
      <div style={{
        background: ac.grad,
        padding: "14px 22px",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <span style={{ fontSize: "1.3rem" }}>{ac.icon}</span>
        <div>
          <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.75)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Slide {index + 1} · {slide.type.replace("_", " ")}
          </div>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: "1.1rem", lineHeight: 1.25 }}>
            {slide.title}
          </div>
        </div>
      </div>

      {/* Slide body */}
      <div style={{ padding: "22px 24px" }}>

        {/* INTRO */}
        {slide.type === "intro" && (() => {
          const s = slide as IntroSlide;
          return (
            <>
              <SlideImage keyword={s.image_keyword || "education learning"} seed={s.title} />
              <p style={{ fontSize: "1rem", color: "#6366f1", fontWeight: 700, marginBottom: 10 }}>{s.subtitle}</p>
              <p style={{ fontSize: "0.92rem", color: "#374151", lineHeight: 1.75, margin: 0 }}>{s.body}</p>
            </>
          );
        })()}

        {/* CONCEPT / DEEP_DIVE / EXAMPLE */}
        {(slide.type === "concept" || slide.type === "deep_dive" || slide.type === "example") && (() => {
          const s = slide as ConceptSlide;
          return (
            <>
              <SlideImage keyword={s.image_keyword || slide.title} seed={s.title} />
              <p style={{ fontSize: "0.93rem", color: "#374151", lineHeight: 1.8, margin: 0 }}>{s.body}</p>
              {s.highlight && <HighlightBox text={s.highlight} grad={ac.grad} />}
            </>
          );
        })()}

        {/* COMPARISON */}
        {slide.type === "comparison" && (() => {
          const s = slide as ComparisonSlide;
          return (
            <>
              <SlideImage keyword={s.image_keyword || "comparison diagram"} seed={s.title} height={160} />
              {s.table && (
                <div style={{ overflowX: "auto", marginBottom: 16 }}>
                  <table style={{
                    width: "100%", borderCollapse: "collapse",
                    fontSize: "0.88rem",
                  }}>
                    <thead>
                      <tr>
                        {s.table.headers.map((h, i) => (
                          <th key={i} style={{
                            background: ac.grad, color: "#fff",
                            padding: "10px 14px", textAlign: "left",
                            fontWeight: 700, fontSize: "0.83rem",
                            borderRadius: i === 0 ? "10px 0 0 0" : i === s.table.headers.length - 1 ? "0 10px 0 0" : 0,
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {s.table.rows.map((row, ri) => (
                        <tr key={ri} style={{ background: ri % 2 === 0 ? "#f9fafb" : "#fff" }}>
                          {row.map((cell, ci) => (
                            <td key={ci} style={{
                              padding: "9px 14px",
                              color: ci === 0 ? "#111827" : "#374151",
                              fontWeight: ci === 0 ? 600 : 400,
                              borderBottom: "1px solid #f3f4f6",
                            }}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {s.highlight && <HighlightBox text={s.highlight} grad={ac.grad} />}
            </>
          );
        })()}

        {/* SUMMARY */}
        {slide.type === "summary" && (() => {
          const s = slide as SummarySlide;
          return (
            <>
              <SlideImage keyword={s.image_keyword || "knowledge achievement"} seed={s.title} height={160} />
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
                {(s.points || []).map((pt, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "flex-start", gap: 12,
                    padding: "11px 14px",
                    background: ac.light,
                    borderRadius: 12,
                    borderLeft: `4px solid`,
                    borderLeftColor: "transparent",
                    backgroundImage: `${ac.light}`,
                  }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: "50%",
                      background: ac.grad, color: "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "0.75rem", fontWeight: 800, flexShrink: 0,
                    }}>{i + 1}</div>
                    <span style={{ fontSize: "0.91rem", color: "#374151", lineHeight: 1.6 }}>{pt}</span>
                  </div>
                ))}
              </div>
              {s.closing && (
                <div style={{
                  padding: "14px 18px", borderRadius: 12,
                  background: ac.grad, color: "#fff",
                  fontSize: "0.92rem", fontWeight: 600, lineHeight: 1.55,
                }}>
                  <span style={{ marginRight: 8 }}>🎯</span>{s.closing}
                </div>
              )}
            </>
          );
        })()}
      </div>
    </div>
  );
}

// ─── Rich preview renderer ─────────────────────────────────────────────────────

function RichPreview({ raw }: { raw: string }) {
  const [data, setData] = useState<LessonPageData | null>(null);
  const [parseError, setParseError] = useState(false);

  useEffect(() => {
    if (!raw) { setData(null); setParseError(false); return; }
    try {
      let cleaned = raw.trim();
      // Strip markdown code fences if present
      if (cleaned.includes("```")) {
        const parts = cleaned.split("```");
        for (let p of parts) {
          p = p.trim();
          if (p.startsWith("json")) p = p.slice(4).trim();
          if (p.startsWith("{")) { cleaned = p; break; }
        }
      }
      // Find first { and last } to extract JSON
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");
      if (start !== -1 && end !== -1) {
        cleaned = cleaned.slice(start, end + 1);
      }
      const parsed: LessonPageData = JSON.parse(cleaned);
      if (parsed.slides && Array.isArray(parsed.slides)) {
        setData(parsed);
        setParseError(false);
      } else {
        setParseError(true);
      }
    } catch {
      setParseError(true);
    }
  }, [raw]);

  // Fallback: show raw text if JSON parse fails
  if (parseError) {
    return (
      <div style={{
        background: "var(--bg2)", borderRadius: 14,
        padding: "1.25rem", fontSize: "0.9rem",
        lineHeight: 1.75, whiteSpace: "pre-wrap",
        overflowY: "auto", maxHeight: 460,
        color: "var(--text-mid)",
      }}>
        {raw}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div>
      {/* Learning objectives banner */}
      {data.learning_objectives && data.learning_objectives.length > 0 && (
        <div style={{
          background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
          borderRadius: 16, padding: "18px 22px", marginBottom: 24,
          color: "#fff",
        }}>
          <div style={{ fontWeight: 800, fontSize: "0.85rem", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12, opacity: 0.85 }}>
            🎯 Learning Objectives
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.learning_objectives.map((obj, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: "50%",
                  background: "rgba(255,255,255,0.25)", color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.72rem", fontWeight: 800, flexShrink: 0, marginTop: 1,
                }}>{i + 1}</div>
                <span style={{ fontSize: "0.91rem", lineHeight: 1.55 }}>{obj}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Slides */}
      {data.slides.map((slide, i) => (
        <SlideCard key={i} slide={slide} index={i} />
      ))}
    </div>
  );
}

// ─── Streaming preview (shows raw text while streaming, rich after done) ───────

function StreamingOrRich({ draft, isGenerating }: { draft: string; isGenerating: boolean }) {
  if (!draft && !isGenerating) return null;

  if (isGenerating) {
    return (
      <div style={{
        background: "var(--bg2)", borderRadius: 14,
        padding: "1.25rem", fontSize: "0.9rem",
        lineHeight: 1.75, whiteSpace: "pre-wrap",
        overflowY: "auto", maxHeight: 420,
        color: "var(--text-mid)",
      }}>
        {draft || "▌"}
        {isGenerating && (
          <span style={{
            display: "inline-block", width: 8, height: 16,
            background: "var(--orange, #f97316)",
            marginLeft: 2, verticalAlign: "text-bottom",
            animation: "blink 0.9s step-end infinite",
          }} />
        )}
        <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
      </div>
    );
  }

  return <RichPreview raw={draft} />;
}

// ─── Main component ────────────────────────────────────────────────────────────

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

  useEffect(() => { loadSection(); }, [lesson.lesson_id, sectionIndex]);

  async function loadSection() {
    try {
      const data = await lessonsApi.getSections(lesson.lesson_id);
      const sec = data.sections[sectionIndex];
      if (!sec) return;
      setSection(sec);
      setDraft(sec.draft || "");
      setPromptDraft(
        lesson.preview_question ||
        "Create a comprehensive, visually rich educational lesson page based on the provided content."
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
      showFeedback("error", e.message || "Could not save prompt.");
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
      setSection((prev) => (prev ? { ...prev, draft: full, approved: false } : prev));
      showFeedback("success", "Preview generated successfully.");
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
      setSection((prev) => (prev ? { ...prev, approved: true } : prev));
      showFeedback("success", `Section ${sectionIndex + 1} approved.`);
      onApproved();
    } catch (e: any) {
      showFeedback("error", e.message || "Could not approve section.");
    } finally {
      setIsApproving(false);
    }
  }

  function getStatusBlock() {
    if (section?.approved) return {
      title: "This section is approved",
      text: "You can still review the preview below, but this section is already marked ready for publishing.",
      bg: "#E1F5EE", border: "#5DCAA5",
    };
    if (draft.trim()) return {
      title: "Preview is ready",
      text: "Review the slides below. If they look good, approve the section. If not, add feedback and regenerate.",
      bg: "#FFF4EA", border: "var(--orange-md)",
    };
    return {
      title: "Next step: generate preview",
      text: "Click Generate Preview to create a rich, visual lesson page for this section.",
      bg: "var(--bg2)", border: "var(--line)",
    };
  }

  if (!loaded || !section) {
    return <div style={{ padding: "2rem", color: "var(--text-soft)" }}>Loading section...</div>;
  }

  const status = getStatusBlock();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Top nav */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <button className="btn btn-ghost" onClick={onBack}>← Back</button>
        <div>
          <div style={{ fontSize: "0.78rem", color: "var(--text-soft)", marginBottom: 2 }}>
            {lesson.week_title} · Section {sectionIndex + 1} · Page {section.page_start}–{section.page_end}
          </div>
          <h2 style={{ fontSize: "1.45rem", margin: 0 }}>{section.title}</h2>
        </div>
        {section.approved && (
          <span style={{
            marginLeft: "auto", fontSize: "0.82rem",
            background: "#E1F5EE", color: "#0F6E56",
            borderRadius: "99px", padding: "4px 14px", fontWeight: 700,
          }}>✅ Approved</span>
        )}
      </div>

      {/* Status card */}
      <div className="card" style={{ padding: "1rem 1.1rem", background: status.bg, border: `1px solid ${status.border}` }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>{status.title}</div>
        <div style={{ fontSize: "0.84rem", color: "var(--text-mid)", lineHeight: 1.6 }}>{status.text}</div>
      </div>

      {/* Page content preview */}
      <div className="card" style={{ padding: "0.9rem 1.25rem" }}>
        <div className="label" style={{ marginBottom: 6 }}>Page Content Preview</div>
        <div style={{ fontSize: "0.82rem", color: "var(--text-soft)", lineHeight: 1.6 }}>
          {section.text_preview}...
        </div>
      </div>

      {/* Prompt + Feedback */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="card" style={{ padding: "1rem 1.25rem" }}>
          <div className="label" style={{ marginBottom: 8 }}>Preview Prompt</div>
          <textarea
            className="input" rows={5} value={promptDraft}
            onChange={(e) => setPromptDraft(e.target.value)}
            style={{ resize: "vertical", fontSize: "0.85rem" }}
          />
          <button
            className="btn btn-ghost" onClick={handleSavePrompt}
            disabled={isSavingPrompt} style={{ marginTop: 8, fontSize: "0.82rem" }}
          >
            {isSavingPrompt ? "Saving..." : "Save Prompt"}
          </button>
        </div>
        <div className="card" style={{ padding: "1rem 1.25rem" }}>
          <div className="label" style={{ marginBottom: 8 }}>Teacher Feedback</div>
          <textarea
            className="input" rows={5}
            placeholder="e.g. Add more real-world examples, simplify language, include a table comparing X and Y..."
            value={feedbackDraft}
            onChange={(e) => setFeedbackDraft(e.target.value)}
            style={{ resize: "vertical", fontSize: "0.85rem" }}
          />
          <p style={{ fontSize: "0.75rem", color: "var(--text-soft)", marginTop: 6 }}>
            This feedback will be applied the next time you generate the preview.
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          className="btn btn-primary" onClick={handleGenerate}
          disabled={isGenerating || isApproving}
          style={{ flex: 1, justifyContent: "center", minWidth: 220 }}
        >
          {isGenerating ? "Generating..." : draft ? "🔄 Regenerate Preview" : "✨ Generate Preview"}
        </button>
        <button
          className="btn btn-primary" onClick={handleApprove}
          disabled={isGenerating || isApproving || !draft.trim() || section.approved}
          style={{
            flex: 1, justifyContent: "center", minWidth: 220,
            background: section.approved ? "var(--bg2)" : "#1f8f5f",
            color: section.approved ? "var(--text-soft)" : "#fff",
          }}
        >
          {isApproving ? "Approving..." : section.approved ? "✅ Approved" : "✅ Approve Section"}
        </button>
      </div>

      {/* Preview area */}
      {(draft || isGenerating) && (
        <div className="card" style={{ padding: "1rem 1.25rem" }}>
          <div className="label" style={{ marginBottom: 14 }}>
            AI Preview
            {isGenerating && (
              <span style={{ marginLeft: 8, fontSize: "0.72rem", color: "var(--orange)", fontWeight: 400 }}>
                generating...
              </span>
            )}
          </div>
          <StreamingOrRich draft={draft} isGenerating={isGenerating} />
        </div>
      )}

      {!draft && !isGenerating && (
        <div className="card" style={{ padding: "2rem 1.25rem", textAlign: "center" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 10 }}>✨</div>
          <p style={{ color: "var(--text-soft)", fontSize: "0.9rem" }}>
            No preview yet. Click <b>Generate Preview</b> to create a rich visual lesson page.
          </p>
        </div>
      )}
    </div>
  );
}