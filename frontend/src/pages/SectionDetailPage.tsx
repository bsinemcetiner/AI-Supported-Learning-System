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

interface SlideBase { type: string; title: string; image_keyword?: string | null; highlight?: string; }
interface IntroSlide extends SlideBase { type: "intro"; subtitle: string; body: string; }
interface ConceptSlide extends SlideBase { type: "concept" | "deep_dive" | "example"; body: string; }
interface ComparisonSlide extends SlideBase { type: "comparison"; table: { headers: string[]; rows: string[][] }; }
interface SummarySlide extends SlideBase { type: "summary"; points: string[]; closing: string; }
type Slide = IntroSlide | ConceptSlide | ComparisonSlide | SummarySlide;
interface LessonPageData { hero_keyword?: string; learning_objectives?: string[]; slides: Slide[]; }

const UNSPLASH_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY as string;
const imageCache: Record<string, string> = {};

async function fetchUnsplashUrl(keyword: string): Promise<string | null> {
  if (!UNSPLASH_KEY || !keyword) return null;
  if (imageCache[keyword]) return imageCache[keyword];
  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(keyword)}&per_page=5&orientation=landscape&content_filter=high`,
      { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` } }
    );
    const data = await res.json();
    const results = data?.results || [];
    if (results.length === 0) return null;
    const pick = results[Math.floor(Math.random() * results.length)];
    const url = pick?.urls?.regular || null;
    if (url) imageCache[keyword] = url;
    return url;
  } catch { return null; }
}

// ─── Robust JSON extractor ────────────────────────────────────────────────────
function extractJson(raw: string): LessonPageData | null {
  if (!raw) return null;
  let text = raw.trim();

  // 1. Strip markdown code fences
  if (text.includes("```")) {
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) text = fenceMatch[1].trim();
  }

  // 2. Find outermost { ... }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  text = text.slice(start, end + 1);

  // 3. Parse
  try {
    const parsed: LessonPageData = JSON.parse(text);
    if (parsed.slides && Array.isArray(parsed.slides) && parsed.slides.length > 0) return parsed;
    return null;
  } catch (err) {
    console.error("[RichPreview] JSON parse failed:", err, "\nFirst 300 chars:", text.slice(0, 300));
    return null;
  }
}

const SLIDE_ACCENTS: Record<string, { grad: string; light: string; icon: string }> = {
  intro:      { grad: "linear-gradient(135deg,#6366f1,#8b5cf6)", light: "#ede9fe", icon: "🚀" },
  concept:    { grad: "linear-gradient(135deg,#0ea5e9,#6366f1)", light: "#e0f2fe", icon: "💡" },
  deep_dive:  { grad: "linear-gradient(135deg,#f97316,#ef4444)", light: "#fff7ed", icon: "🔬" },
  example:    { grad: "linear-gradient(135deg,#10b981,#0ea5e9)", light: "#ecfdf5", icon: "📌" },
  comparison: { grad: "linear-gradient(135deg,#f59e0b,#f97316)", light: "#fffbeb", icon: "⚖️" },
  summary:    { grad: "linear-gradient(135deg,#ec4899,#f97316)", light: "#fdf2f8", icon: "✅" },
};
function accent(type: string) { return SLIDE_ACCENTS[type] || SLIDE_ACCENTS["concept"]; }

function HeroImage({ keyword }: { keyword: string }) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    fetchUnsplashUrl(keyword).then((url) => { setImgUrl(url); setLoading(false); });
  }, [keyword]);
  if (loading) return (
    <div style={{ width: "100%", height: 260, borderRadius: 14, marginBottom: 22, background: "linear-gradient(90deg,#f3f4f6 25%,#e5e7eb 50%,#f3f4f6 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }}>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    </div>
  );
  if (!imgUrl) return null;
  return (
    <div style={{ width: "100%", height: 260, borderRadius: 14, overflow: "hidden", marginBottom: 22, position: "relative", boxShadow: "0 8px 32px rgba(0,0,0,0.14)" }}>
      <img src={imgUrl} alt={keyword} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, transparent 40%, rgba(0,0,0,0.3) 100%)" }} />
    </div>
  );
}

function SideImage({ keyword }: { keyword: string }) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    fetchUnsplashUrl(keyword).then((url) => { setImgUrl(url); setLoading(false); });
  }, [keyword]);
  if (loading) return (
    <div style={{ float: "right", width: 200, height: 140, borderRadius: 12, marginLeft: 20, marginBottom: 12, background: "linear-gradient(90deg,#f3f4f6 25%,#e5e7eb 50%,#f3f4f6 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />
  );
  if (!imgUrl) return null;
  return (
    <div style={{ float: "right", width: 200, height: 140, borderRadius: 12, overflow: "hidden", marginLeft: 20, marginBottom: 12, boxShadow: "0 4px 16px rgba(0,0,0,0.12)" }}>
      <img src={imgUrl} alt={keyword} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
    </div>
  );
}

function HighlightBox({ text, grad }: { text: string; grad: string }) {
  return (
    <div style={{ marginTop: 18, padding: "14px 18px", borderRadius: 12, background: grad, color: "#fff", fontSize: "0.92rem", fontWeight: 600, lineHeight: 1.55, boxShadow: "0 4px 16px rgba(0,0,0,0.15)", clear: "both" }}>
      <span style={{ opacity: 0.8, marginRight: 8 }}>💬</span>{text}
    </div>
  );
}

function SlideCard({ slide, index }: { slide: Slide; index: number }) {
  const ac = accent(slide.type);
  return (
    <div style={{ background: "#fff", borderRadius: 20, overflow: "hidden", border: "1px solid rgba(0,0,0,0.07)", boxShadow: "0 2px 20px rgba(0,0,0,0.06)", marginBottom: 24 }}>
      <div style={{ background: ac.grad, padding: "14px 22px", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: "1.3rem" }}>{ac.icon}</span>
        <div>
          <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.75)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Slide {index + 1} · {slide.type.replace("_", " ")}
          </div>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: "1.1rem", lineHeight: 1.25 }}>{slide.title}</div>
        </div>
      </div>
      <div style={{ padding: "22px 24px" }}>
        {slide.type === "intro" && (() => {
          const s = slide as IntroSlide;
          return (<>
            {s.image_keyword && <HeroImage keyword={s.image_keyword} />}
            <p style={{ fontSize: "1rem", color: "#6366f1", fontWeight: 700, marginBottom: 10 }}>{s.subtitle}</p>
            <p style={{ fontSize: "0.92rem", color: "#374151", lineHeight: 1.8, margin: 0 }}>{s.body}</p>
          </>);
        })()}
        {slide.type === "concept" && (() => {
          const s = slide as ConceptSlide;
          return (<>
            <p style={{ fontSize: "0.93rem", color: "#374151", lineHeight: 1.85, margin: 0 }}>{s.body}</p>
            {s.highlight && <HighlightBox text={s.highlight} grad={ac.grad} />}
          </>);
        })()}
        {slide.type === "deep_dive" && (() => {
          const s = slide as ConceptSlide;
          return (<div style={{ overflow: "hidden" }}>
            {s.image_keyword && <SideImage keyword={s.image_keyword} />}
            <p style={{ fontSize: "0.93rem", color: "#374151", lineHeight: 1.85, margin: 0 }}>{s.body}</p>
            {s.highlight && <HighlightBox text={s.highlight} grad={ac.grad} />}
          </div>);
        })()}
        {slide.type === "example" && (() => {
          const s = slide as ConceptSlide;
          return (<>
            <p style={{ fontSize: "0.93rem", color: "#374151", lineHeight: 1.85, margin: 0 }}>{s.body}</p>
            {s.highlight && <HighlightBox text={s.highlight} grad={ac.grad} />}
          </>);
        })()}
        {slide.type === "comparison" && (() => {
          const s = slide as ComparisonSlide;
          return (<>
            {s.table && (
              <div style={{ overflowX: "auto", marginBottom: 16 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
                  <thead><tr>{s.table.headers.map((h, i) => (
                    <th key={i} style={{ background: ac.grad, color: "#fff", padding: "10px 14px", textAlign: "left", fontWeight: 700, fontSize: "0.83rem", borderRadius: i === 0 ? "10px 0 0 0" : i === s.table.headers.length - 1 ? "0 10px 0 0" : 0 }}>{h}</th>
                  ))}</tr></thead>
                  <tbody>{s.table.rows.map((row, ri) => (
                    <tr key={ri} style={{ background: ri % 2 === 0 ? "#f9fafb" : "#fff" }}>
                      {row.map((cell, ci) => (
                        <td key={ci} style={{ padding: "9px 14px", color: ci === 0 ? "#111827" : "#374151", fontWeight: ci === 0 ? 600 : 400, borderBottom: "1px solid #f3f4f6" }}>{cell}</td>
                      ))}
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
            {(slide as any).highlight && <HighlightBox text={(slide as any).highlight} grad={ac.grad} />}
          </>);
        })()}
        {slide.type === "summary" && (() => {
          const s = slide as SummarySlide;
          return (<>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
              {(s.points || []).map((pt, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "11px 14px", background: ac.light, borderRadius: 12 }}>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", background: ac.grad, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: 800, flexShrink: 0 }}>{i + 1}</div>
                  <span style={{ fontSize: "0.91rem", color: "#374151", lineHeight: 1.6 }}>{pt}</span>
                </div>
              ))}
            </div>
            {s.closing && <div style={{ padding: "14px 18px", borderRadius: 12, background: ac.grad, color: "#fff", fontSize: "0.92rem", fontWeight: 600, lineHeight: 1.55 }}><span style={{ marginRight: 8 }}>🎯</span>{s.closing}</div>}
          </>);
        })()}
      </div>
    </div>
  );
}

function RichPreview({ raw }: { raw: string }) {
  const data = extractJson(raw);

  // Still streaming or genuinely unparseable — show raw
  if (!data) return (
    <div style={{ background: "var(--bg2)", borderRadius: 14, padding: "1.25rem", fontSize: "0.9rem", lineHeight: 1.75, whiteSpace: "pre-wrap", overflowY: "auto", maxHeight: 460, color: "var(--text-mid)" }}>{raw}</div>
  );

  return (
    <div>
      {data.learning_objectives && data.learning_objectives.length > 0 && (
        <div style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", borderRadius: 16, padding: "18px 22px", marginBottom: 24, color: "#fff" }}>
          <div style={{ fontWeight: 800, fontSize: "0.85rem", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12, opacity: 0.85 }}>🎯 Learning Objectives</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.learning_objectives.map((obj, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(255,255,255,0.25)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.72rem", fontWeight: 800, flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
                <span style={{ fontSize: "0.91rem", lineHeight: 1.55 }}>{obj}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {data.slides.map((slide, i) => <SlideCard key={i} slide={slide} index={i} />)}
    </div>
  );
}

function StreamingOrRich({ draft, isGenerating }: { draft: string; isGenerating: boolean }) {
  if (!draft && !isGenerating) return null;
  if (isGenerating) return (
    <div style={{ background: "var(--bg2)", borderRadius: 14, padding: "1.25rem", fontSize: "0.9rem", lineHeight: 1.75, whiteSpace: "pre-wrap", overflowY: "auto", maxHeight: 420, color: "var(--text-mid)" }}>
      {draft || "▌"}
      <span style={{ display: "inline-block", width: 8, height: 16, background: "var(--orange,#f97316)", marginLeft: 2, verticalAlign: "text-bottom", animation: "blink 0.9s step-end infinite" }} />
      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}`}</style>
    </div>
  );
  return <RichPreview raw={draft} />;
}

export function SectionDetailPage({ lesson, sectionIndex, onBack, showFeedback, onApproved }: SectionDetailPageProps) {
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
      setPromptDraft(lesson.preview_question || "Create a comprehensive, visually rich educational lesson page based on the provided content.");
      setLoaded(true);
    } catch (e: any) { showFeedback("error", e.message || "Could not load section."); }
  }

  async function handleSavePrompt() {
    setIsSavingPrompt(true);
    try { await lessonsApi.updatePreviewQuestion(lesson.lesson_id, promptDraft); showFeedback("success", "Preview prompt saved."); }
    catch (e: any) { showFeedback("error", e.message || "Could not save prompt."); }
    finally { setIsSavingPrompt(false); }
  }

  async function handleGenerate() {
    setIsGenerating(true); setDraft("");
    if (feedbackDraft.trim()) { try { await lessonsApi.saveFeedback(lesson.lesson_id, feedbackDraft); setFeedbackDraft(""); } catch {} }
    try {
      let full = "";
      for await (const delta of lessonsApi.generateSectionStream(lesson.lesson_id, sectionIndex)) { full += delta; setDraft(full); }
      setSection((prev) => (prev ? { ...prev, draft: full, approved: false } : prev));
      showFeedback("success", "Preview generated successfully.");
    } catch (e: any) { showFeedback("error", e.message || "Generation failed."); }
    finally { setIsGenerating(false); }
  }

  async function handleApprove() {
    if (!draft.trim()) { showFeedback("error", "Generate a preview first."); return; }
    setIsApproving(true);
    try {
      await lessonsApi.approveSection(lesson.lesson_id, sectionIndex);
      setSection((prev) => (prev ? { ...prev, approved: true } : prev));
      showFeedback("success", `Section ${sectionIndex + 1} approved.`);
      onApproved();
    } catch (e: any) { showFeedback("error", e.message || "Could not approve section."); }
    finally { setIsApproving(false); }
  }

  function getStatusBlock() {
    if (section?.approved) return { title: "This section is approved", text: "You can still review the preview below, but this section is already marked ready for publishing.", bg: "#E1F5EE", border: "#5DCAA5" };
    if (draft.trim()) return { title: "Preview is ready", text: "Review the slides below. If they look good, approve the section. If not, add feedback and regenerate.", bg: "#FFF4EA", border: "var(--orange-md)" };
    return { title: "Next step: generate preview", text: "Click Generate Preview to create a rich, visual lesson page for this section.", bg: "var(--bg2)", border: "var(--line)" };
  }

  if (!loaded || !section) return <div style={{ padding: "2rem", color: "var(--text-soft)" }}>Loading section...</div>;
  const status = getStatusBlock();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <button className="btn btn-ghost" onClick={onBack}>← Back</button>
        <div>
          <div style={{ fontSize: "0.78rem", color: "var(--text-soft)", marginBottom: 2 }}>{lesson.week_title} · Section {sectionIndex + 1} · Page {section.page_start}–{section.page_end}</div>
          <h2 style={{ fontSize: "1.45rem", margin: 0 }}>{section.title}</h2>
        </div>
        {section.approved && <span style={{ marginLeft: "auto", fontSize: "0.82rem", background: "#E1F5EE", color: "#0F6E56", borderRadius: "99px", padding: "4px 14px", fontWeight: 700 }}>✅ Approved</span>}
      </div>

      <div className="card" style={{ padding: "1rem 1.1rem", background: status.bg, border: `1px solid ${status.border}` }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>{status.title}</div>
        <div style={{ fontSize: "0.84rem", color: "var(--text-mid)", lineHeight: 1.6 }}>{status.text}</div>
      </div>

      <div className="card" style={{ padding: "0.9rem 1.25rem" }}>
        <div className="label" style={{ marginBottom: 6 }}>Page Content Preview</div>
        <div style={{ fontSize: "0.82rem", color: "var(--text-soft)", lineHeight: 1.6 }}>{section.text_preview}...</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="card" style={{ padding: "1rem 1.25rem" }}>
          <div className="label" style={{ marginBottom: 8 }}>Preview Prompt</div>
          <textarea className="input" rows={5} value={promptDraft} onChange={(e) => setPromptDraft(e.target.value)} style={{ resize: "vertical", fontSize: "0.85rem" }} />
          <button className="btn btn-ghost" onClick={handleSavePrompt} disabled={isSavingPrompt} style={{ marginTop: 8, fontSize: "0.82rem" }}>{isSavingPrompt ? "Saving..." : "Save Prompt"}</button>
        </div>
        <div className="card" style={{ padding: "1rem 1.25rem" }}>
          <div className="label" style={{ marginBottom: 8 }}>Teacher Feedback</div>
          <textarea className="input" rows={5} placeholder="e.g. Add more real-world examples, simplify language, include a table comparing X and Y..." value={feedbackDraft} onChange={(e) => setFeedbackDraft(e.target.value)} style={{ resize: "vertical", fontSize: "0.85rem" }} />
          <p style={{ fontSize: "0.75rem", color: "var(--text-soft)", marginTop: 6 }}>This feedback will be applied the next time you generate the preview.</p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="btn btn-primary" onClick={handleGenerate} disabled={isGenerating || isApproving} style={{ flex: 1, justifyContent: "center", minWidth: 220 }}>
          {isGenerating ? "Generating..." : draft ? "🔄 Regenerate Preview" : "✨ Generate Preview"}
        </button>
        <button className="btn btn-primary" onClick={handleApprove} disabled={isGenerating || isApproving || !draft.trim() || section.approved}
          style={{ flex: 1, justifyContent: "center", minWidth: 220, background: section.approved ? "var(--bg2)" : "#1f8f5f", color: section.approved ? "var(--text-soft)" : "#fff" }}>
          {isApproving ? "Approving..." : section.approved ? "✅ Approved" : "✅ Approve Section"}
        </button>
      </div>

      {(draft || isGenerating) && (
        <div className="card" style={{ padding: "1rem 1.25rem" }}>
          <div className="label" style={{ marginBottom: 14 }}>
            AI Preview
            {isGenerating && <span style={{ marginLeft: 8, fontSize: "0.72rem", color: "var(--orange)", fontWeight: 400 }}>generating...</span>}
          </div>
          <StreamingOrRich draft={draft} isGenerating={isGenerating} />
        </div>
      )}

      {!draft && !isGenerating && (
        <div className="card" style={{ padding: "2rem 1.25rem", textAlign: "center" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 10 }}>✨</div>
          <p style={{ color: "var(--text-soft)", fontSize: "0.9rem" }}>No preview yet. Click <b>Generate Preview</b> to create a rich visual lesson page.</p>
        </div>
      )}
    </div>
  );
}