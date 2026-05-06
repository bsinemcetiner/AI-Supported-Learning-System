import { useEffect, useState } from "react";
import { lessons as lessonsApi, API_ORIGIN } from "../services/api";
import type { Lesson, Section } from "../services/api";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

interface SectionDetailPageProps {
  lesson: Lesson;
  sectionIndex: number;
  onBack: () => void;
  showFeedback: (type: "success" | "error" | "info", text: string) => void;
  onApproved: () => void;
  darkMode: boolean;
  cardBg: string;
  textPrimary: string;
  textSecondary: string;
  borderColor: string;
}

interface SlideBase { type: string; title: string; image_keyword?: string | null; highlight?: string; }
interface IntroSlide extends SlideBase { type: "intro"; subtitle: string; body: string; }
interface ConceptSlide extends SlideBase { type: "concept" | "deep_dive" | "example"; body: string; code?: string; code_language?: string; }
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

function buildPdfUrl(storedPath?: string | null, pageStart?: number): string | null {
  if (!storedPath) return null;

  const cleanPath = storedPath.trim().replaceAll("\\", "/");
  if (!cleanPath) return null;

  const pdfPath = cleanPath
    .replace(/^lesson_materials\//, "lesson_pdfs/")
    .replace(/\.txt$/i, ".pdf");

  if (!pdfPath.toLowerCase().endsWith(".pdf")) {
    return null;
  }

  const baseUrl =
    pdfPath.startsWith("http://") || pdfPath.startsWith("https://")
      ? pdfPath
      : pdfPath.startsWith("/")
      ? `${API_ORIGIN}${pdfPath}`
      : `${API_ORIGIN}/${pdfPath}`;

  const page = pageStart && pageStart > 0 ? pageStart : 1;

  return `${encodeURI(baseUrl)}#page=${page}&zoom=85`;
}

// ─── Robust JSON extractor ────────────────────────────────────────────────────
function extractJson(raw: string): LessonPageData | null {
  if (!raw) return null;

  let text = raw
    .trim()
    .replace(/^\uFEFF/, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");

  // Remove markdown fence if the whole response is fenced
  const outerFence = text.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/i);
  if (outerFence) text = outerFence[1].trim();

  // Extract the first balanced JSON object while respecting strings
  const start = text.indexOf("{");
  if (start === -1) return null;

  let inString = false;
  let escaped = false;
  let depth = 0;
  let end = -1;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      escaped = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (ch === "{") depth++;
      if (ch === "}") depth--;

      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  if (end === -1) return null;

  let jsonText = text.slice(start, end + 1).trim();

  // Remove common invalid JSON issues
  jsonText = jsonText
    .replace(/,\s*}/g, "}")
    .replace(/,\s*]/g, "]");

  try {
    const parsed = JSON.parse(jsonText) as LessonPageData;

    if (!parsed || !Array.isArray(parsed.slides) || parsed.slides.length === 0) {
      return null;
    }

    parsed.slides = parsed.slides.map((slide: any) => {
      if (!slide.type) slide.type = "concept";
      if (!slide.title) slide.title = "Untitled Slide";

      if (typeof slide.body === "string") {
        slide.body = slide.body.replace(/\\n/g, "\n");
      }

      if (typeof slide.code === "string") {
        slide.code = slide.code.replace(/\\n/g, "\n");
      }

      return slide;
    });

    return parsed;
  } catch (err) {
    console.error("[RichPreview] JSON parse failed:", err);
    console.log("[RichPreview] Raw preview:", raw);
    return null;
  }
}

// ─── Code block component ─────────────────────────────────────────────────────
function CodeBlock({ code, language = "text" }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", marginTop: 14, marginBottom: 6 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#1e1e2e", padding: "6px 14px" }}>
        <span style={{ fontSize: "0.7rem", color: "#7c7f93", fontWeight: 600, letterSpacing: "0.05em" }}>{language}</span>
        <button
          onClick={handleCopy}
          style={{ fontSize: "0.7rem", fontWeight: 700, color: copied ? "#10b981" : "#94a3b8", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
          {copied ? "✓ Copied!" : "Copy"}
        </button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        customStyle={{ margin: 0, borderRadius: 0, fontSize: "0.85rem", padding: "16px 18px" }}
        showLineNumbers={true}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

// ─── Body renderer — splits plain text and inline code blocks ────────────────
function renderBody(text: string) {
  const normalized = text.replace(/\\n/g, "\n");
  const parts = normalized.split(/(```[\w]*\n[\s\S]*?```)/g);
  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/^```([\w]*)\n([\s\S]*?)```$/);
        if (match) {
          const lang = match[1].trim() || "text";
          const code = match[2].trimEnd();
          return <CodeBlock key={i} code={code} language={lang} />;
        }
        return part.trim()
          ? <p key={i} style={{ fontSize: "0.93rem", color: "#374151", lineHeight: 1.85, margin: "0 0 8px" }}>{part.trim()}</p>
          : null;
      })}
    </>
  );
}

const SCHEMA_SAFE_SUFFIX = `
Keep the output as valid JSON only. Do not use markdown fences. Do not add comments. Do not add fields outside the expected slide schema. Use only these slide types: "intro", "concept", "deep_dive", "example", "comparison", "summary". Escape all quotes and newlines properly inside JSON strings.
`.trim();

const PROMPT_HELPERS = {
  examples: `
Add at least one slide with type "example".
The example slide must use this JSON shape:
{ "type": "example", "title": "...", "body": "...", "highlight": "..." }
The body must explain a realistic student-friendly scenario related to this section.
Keep the body as plain text, not markdown.
${SCHEMA_SAFE_SUFFIX}
`.trim(),

  simple: `
Use simple undergraduate-level language in every slide body.
Avoid unnecessary jargon. If a technical term is necessary, briefly explain it in the same sentence.
Keep explanations conversational and teacher-like.
Do not change the JSON structure.
${SCHEMA_SAFE_SUFFIX}
`.trim(),

  table: `
Include exactly one slide with type "comparison".
The comparison slide must use this JSON shape:
{ "type": "comparison", "title": "...", "table": { "headers": ["Concept", "Purpose", "Example", "Result"], "rows": [["...", "...", "...", "..."]] } }
Keep all table cells short.
Do not use markdown inside table cells.
${SCHEMA_SAFE_SUFFIX}
`.trim(),

  code: `
For programming topics, include at least one slide with type "example".
The code example slide must use this JSON shape:
{ "type": "example", "title": "...", "body": "...", "code": "...", "code_language": "..." }
Put the explanation only in the "body" field.
Put only the source code in the "code" field.
Do not place markdown code fences inside the body or code field.
Escape double quotes inside code strings with backslash.
Escape newlines inside code strings as \\n.
For C# code, use "csharp" as code_language, not "c#" or "c #".
The code must be short, correct, and idiomatic for the programming language or technology discussed in this section.
Set "code_language" to the correct syntax-highlighting language name, such as "csharp", "java", "python", "javascript", "typescript", "sql", "html", "css", or "bash".
${SCHEMA_SAFE_SUFFIX}
`.trim(),

  visual: `
Make the lesson more visual using only the existing JSON schema.
Add meaningful "image_keyword" values to the intro slide and suitable deep_dive slides.
Add short "highlight" fields to concept, deep_dive, or example slides when helpful.
Use clear slide titles and short slide bodies.
Do not create image URLs. Only provide image_keyword text.
Do not add new fields such as image_url, visual_layout, icons, colors, or design_notes.
${SCHEMA_SAFE_SUFFIX}
`.trim(),

  shorter: `
Keep the lesson concise.
Each slide body must be around 2 to 4 sentences maximum.
Avoid long paragraphs.
If the topic is large, split it into multiple clear slides instead of writing one long slide.
Keep the JSON structure valid.
${SCHEMA_SAFE_SUFFIX}
`.trim(),
};

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
            {renderBody(s.body)}
          </>);
        })()}
        {slide.type === "concept" && (() => {
          const s = slide as ConceptSlide;
          return (<>
            {renderBody(s.body)}
            {s.code && <CodeBlock code={s.code.replace(/\\n/g, "\n")} language={s.code_language || "text"} />}
            {s.highlight && <HighlightBox text={s.highlight} grad={ac.grad} />}
          </>);
        })()}
        {slide.type === "deep_dive" && (() => {
          const s = slide as ConceptSlide;
          return (<div style={{ overflow: "hidden" }}>
            {s.image_keyword && <SideImage keyword={s.image_keyword} />}
            {renderBody(s.body)}
            {s.code && <CodeBlock code={s.code.replace(/\\n/g, "\n")} language={s.code_language || "text"} />}
            {s.highlight && <HighlightBox text={s.highlight} grad={ac.grad} />}
          </div>);
        })()}
        {slide.type === "example" && (() => {
          const s = slide as ConceptSlide;
          return (<>
            {renderBody(s.body)}
            {s.code && <CodeBlock code={s.code.replace(/\\n/g, "\n")} language={s.code_language || "text"} />}
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

  if (!data) {
    return (
      <div
        style={{
          background: "var(--bg2)",
          borderRadius: 14,
          padding: "1.25rem",
          fontSize: "0.9rem",
          lineHeight: 1.75,
          color: "var(--text-mid)",
        }}
      >
        <div
          style={{
            padding: "0.85rem 1rem",
            borderRadius: 12,
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            color: "#9a3412",
            fontWeight: 700,
            marginBottom: 12,
          }}
        >
          ⚠️ The AI preview could not be converted into slide cards. Please regenerate the preview.
        </div>

        <details>
          <summary
            style={{
              cursor: "pointer",
              fontWeight: 700,
              color: "#f97316",
              marginBottom: 10,
            }}
          >
            Show raw AI output
          </summary>

          <pre
            style={{
              whiteSpace: "pre-wrap",
              overflowY: "auto",
              maxHeight: 420,
              margin: 0,
              fontFamily: "monospace",
              fontSize: "0.82rem",
            }}
          >
            {raw}
          </pre>
        </details>
      </div>
    );
  }
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

export function SectionDetailPage({ lesson, sectionIndex, onBack, showFeedback, onApproved, darkMode, cardBg, textPrimary, textSecondary, borderColor, }: SectionDetailPageProps) {
  const [section, setSection] = useState<Section | null>(null);
  const [promptDraft, setPromptDraft] = useState("");
  const [draft, setDraft] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [isPromptDirty, setIsPromptDirty] = useState(false);

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
        setIsPromptDirty(false);
        setLoaded(true);
    } catch (e: any) { showFeedback("error", e.message || "Could not load section."); }
  }

  async function handleSavePrompt() {
    setIsSavingPrompt(true);
    try {
      await lessonsApi.updatePreviewQuestion(lesson.lesson_id, promptDraft);
      setIsPromptDirty(false);
      showFeedback("success", "Preview prompt saved.");
    }
    catch (e: any) { showFeedback("error", e.message || "Could not save prompt."); }
    finally { setIsSavingPrompt(false); }
  }

  async function handleGenerate() {
  if (isPromptDirty) {
      showFeedback("info", "Please save the prompt before generating or regenerating the preview.");
      return;
    }

    setIsGenerating(true);
    setDraft("");

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
function appendToPrompt(text: string) {
  setPromptDraft((prev) => {
    const cleanPrev = prev.trim();
    const cleanText = text.trim();

    if (cleanPrev.includes(cleanText)) return cleanPrev;

    return `${cleanPrev}${cleanPrev ? "\n\n" : ""}${cleanText}`;
  });
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
    if (section?.approved) {
      return {
        title: "This section is approved",
        text: "You can still review the preview below, but this section is already marked ready for publishing.",
        bg: darkMode ? "rgba(16,185,129,0.12)" : "#E1F5EE",
        border: darkMode ? "rgba(16,185,129,0.30)" : "#5DCAA5",
        titleColor: darkMode ? "#86efac" : "#0F6E56",
        textColor: darkMode ? "#bbf7d0" : "#0F6E56",
      };
    }
    if (draft.trim()) {
      return {
        title: "Preview is ready",
        text: "Review the slides below. If they look good, approve the section. If not, add feedback and regenerate.",
        bg: darkMode ? "rgba(251,146,60,0.10)" : "#FFF4EA",
        border: darkMode ? "rgba(251,146,60,0.30)" : "var(--orange-md)",
        titleColor: darkMode ? "#fdba74" : "#9a3412",
        textColor: darkMode ? "#fed7aa" : "#92400e",
      };
    }
    return {
      title: "Next step: generate preview",
      text: "Click Generate Preview to create a rich, visual lesson page for this section.",
      bg: darkMode ? "rgba(15,23,42,0.70)" : "var(--bg2)",
      border: darkMode ? "rgba(255,255,255,0.12)" : "var(--line)",
      titleColor: textPrimary,
      textColor: textSecondary,
    };
  }

  if (!loaded || !section) return <div style={{ padding: "2rem", color: "var(--text-soft)" }}>Loading section...</div>;
  const status = getStatusBlock();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <button className="btn btn-ghost" onClick={onBack}>← Back</button>
        <div>
          <div style={{ fontSize: "0.78rem", color: textSecondary, marginBottom: 2 }}>{lesson.week_title} · Section {sectionIndex + 1} · Page {section.page_start}–{section.page_end}</div>
          <h2 style={{ fontSize: "1.45rem", margin: 0, color: textPrimary }}>{section.title}</h2>
        </div>
        {section.approved && <span style={{ marginLeft: "auto", fontSize: "0.82rem", background: "#E1F5EE", color: "#0F6E56", borderRadius: "99px", padding: "4px 14px", fontWeight: 700 }}>✅ Approved</span>}
      </div>

      <div className="card" style={{ padding: "1rem 1.1rem", background: status.bg, border: `1px solid ${status.border}` }}>
        <div style={{ fontWeight: 700, marginBottom: 6, color: status.titleColor }}>{status.title}</div>
        <div style={{ fontSize: "0.84rem", color: status.textColor, lineHeight: 1.6 }}>{status.text}</div>
      </div>

     {(() => {
      const pdfUrl = buildPdfUrl(lesson.stored_path, section.page_start);
      console.log("lesson.stored_path:", lesson.stored_path);
      console.log("generated pdfUrl:", pdfUrl);
      const pageLabel =
        section.page_start === section.page_end
          ? `page ${section.page_start}`
          : `pages ${section.page_start}–${section.page_end}`;

      return (
        <div
          className="card"
          style={{
            padding: "0.95rem 1.15rem",
            background: darkMode ? "rgba(15,23,42,0.45)" : "#fffaf5",
            border: darkMode
              ? "1px solid rgba(251,146,60,0.22)"
              : "1px solid #fed7aa",
            borderRadius: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 12,
                background: "linear-gradient(135deg,#f97316,#ec4899)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                fontSize: "1rem",
                fontWeight: 800,
              }}
            >
              📖
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: "0.78rem",
                  fontWeight: 800,
                  color: textPrimary,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  marginBottom: 3,
                }}
              >
                Original PDF Pages
              </div>

              <div
                style={{
                  fontSize: "0.8rem",
                  color: textSecondary,
                  lineHeight: 1.55,
                  marginBottom: 10,
                }}
              >
                This section was extracted from <b>{pageLabel}</b>. Open the source pages to compare the AI preview with the original material.
              </div>

              {pdfUrl ? (
                <details>
                  <summary
                    style={{
                      cursor: "pointer",
                      fontSize: "0.82rem",
                      fontWeight: 800,
                      color: "#f97316",
                      userSelect: "none",
                    }}
                  >
                    Open source PDF at {pageLabel}
                  </summary>

                  <div
                    style={{
                      marginTop: 12,
                      borderRadius: 14,
                      overflow: "hidden",
                      border: `1px solid ${borderColor}`,
                      background: "#fff",
                    }}
                  >
                    <iframe
                      title={`Original PDF ${pageLabel}`}
                      src={pdfUrl}
                      style={{
                        width: "100%",
                        height: 520,
                        border: "none",
                        display: "block",
                      }}
                    />
                  </div>
                </details>
              ) : (
                <div
                  style={{
                    fontSize: "0.8rem",
                    color: "#ef4444",
                    fontWeight: 700,
                  }}
                >
                  Original PDF preview is not available for this section. You can still review the extracted source text below.
                </div>
              )}

              {section.text_preview?.trim() && (
                <details style={{ marginTop: 10 }}>
                  <summary
                    style={{
                      cursor: "pointer",
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      color: textSecondary,
                      userSelect: "none",
                    }}
                  >
                    Show extracted text
                  </summary>

                  <div
                    style={{
                      marginTop: 10,
                      padding: "0.85rem 0.95rem",
                      borderRadius: 12,
                      background: darkMode ? "rgba(15,23,42,0.75)" : "#fff",
                      border: `1px solid ${borderColor}`,
                      fontSize: "0.82rem",
                      color: textSecondary,
                      lineHeight: 1.65,
                      whiteSpace: "pre-wrap",
                      maxHeight: 180,
                      overflowY: "auto",
                    }}
                  >
                    {section.text_preview}
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    })()}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="card" style={{ padding: "1rem 1.25rem", background: cardBg, border: `1px solid ${borderColor}` }}>
          <div className="label" style={{ marginBottom: 8 }}>Preview Prompt</div>
          <textarea
            className="input"
            rows={5}
            value={promptDraft}
            onChange={(e) => {
              setPromptDraft(e.target.value);
              setIsPromptDirty(true);
            }}
            style={{ resize: "vertical", fontSize: "0.85rem", background: darkMode ? "rgba(15,23,42,0.65)" : "#fff", color: textPrimary, border: `1px solid ${borderColor}` }}
          />
          <div
              style={{
                marginTop: 8,
                padding: "9px 11px",
                borderRadius: 12,
                background: darkMode ? "rgba(249,115,22,0.14)" : "#fff7ed",
                border: darkMode ? "1px solid rgba(251,146,60,0.35)" : "1px solid #fed7aa",
                color: darkMode ? "#fdba74" : "#9a3412",
                fontSize: "0.76rem",
                fontWeight: 700,
                lineHeight: 1.5,
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
              }}
            >
              <span style={{ fontSize: "0.9rem", lineHeight: 1.3 }}>⚠️</span>
              <span>
                Please save the prompt before generating/regenerating. Unsaved prompt changes will not be used.
              </span>
           </div>
          <button className="btn btn-ghost" onClick={handleSavePrompt} disabled={isSavingPrompt} style={{ marginTop: 8, fontSize: "0.82rem" }}>
            {isSavingPrompt ? "Saving..." : "Save Prompt"}
          </button>
        </div>
        <div className="card" style={{ padding: "1rem 1.25rem", background: cardBg, border: `1px solid ${borderColor}` }}>
          <div className="label" style={{ marginBottom: 8 }}>Quick Prompt Helpers</div>

          <p style={{ fontSize: "0.78rem", color: textSecondary, lineHeight: 1.55, marginTop: 0 }}>
            Use these shortcuts to quickly improve the preview style. They will be added to the prompt on the left.
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => appendToPrompt(PROMPT_HELPERS.examples)}
              style={{ fontSize: "0.78rem" }}
            >
              🧩 More examples
            </button>

            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => appendToPrompt(PROMPT_HELPERS.simple)}
              style={{ fontSize: "0.78rem" }}
            >
              🌱 Simpler language
            </button>

            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => appendToPrompt(PROMPT_HELPERS.table)}
              style={{ fontSize: "0.78rem" }}
            >
              📊 Add table
            </button>

            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => appendToPrompt(PROMPT_HELPERS.code)}
              style={{ fontSize: "0.78rem" }}
            >
              💻 Code examples
            </button>

            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => appendToPrompt(PROMPT_HELPERS.visual)}
              style={{ fontSize: "0.78rem" }}
            >
              🎨 More visual
            </button>

            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => appendToPrompt(PROMPT_HELPERS.shorter)}
              style={{ fontSize: "0.78rem" }}
            >
              ✂️ Shorter slides
            </button>
          </div>

          <div
            style={{
              marginTop: 16,
              padding: "0.85rem 0.95rem",
              borderRadius: 14,
              background: darkMode ? "rgba(15,23,42,0.55)" : "var(--bg2)",
              border: `1px solid ${borderColor}`,
            }}
          >
            <div style={{ fontSize: "0.78rem", fontWeight: 800, color: textPrimary, marginBottom: 4 }}>
              Recommended flow
            </div>
            <div style={{ fontSize: "0.75rem", color: textSecondary, lineHeight: 1.55 }}>
              Edit the prompt, generate the preview, review the AI lesson page, then approve the section.
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="btn btn-primary" onClick={handleGenerate} disabled={isGenerating || isApproving || isPromptDirty} style={{ flex: 1, justifyContent: "center", minWidth: 220 }}>
          {isGenerating
          ? "Generating..."
          : isPromptDirty
          ? "Save prompt first"
          : draft
          ? "🔄 Regenerate Preview"
          : "✨ Generate Preview"}
        </button>
        <button className="btn btn-primary" onClick={handleApprove} disabled={isGenerating || isApproving || !draft.trim() || section.approved}
          style={{ flex: 1, justifyContent: "center", minWidth: 220, background: section.approved ? "var(--bg2)" : "#1f8f5f", color: section.approved ? "var(--text-soft)" : "#fff" }}>
          {isApproving ? "Approving..." : section.approved ? "✅ Approved" : "✅ Approve Section"}
        </button>
      </div>

      {(draft || isGenerating) && (
        <div className="card" style={{ padding: "1rem 1.25rem", background: cardBg, border: `1px solid ${borderColor}` }}>
          <div className="label" style={{ marginBottom: 14 }}>
            AI Preview
            {isGenerating && <span style={{ marginLeft: 8, fontSize: "0.72rem", color: "var(--orange)", fontWeight: 400 }}>generating...</span>}
          </div>
          <StreamingOrRich draft={draft} isGenerating={isGenerating} />
        </div>
      )}

      {!draft && !isGenerating && (
        <div className="card" style={{ padding: "2rem 1.25rem", textAlign: "center", background: cardBg, border: `1px solid ${borderColor}` }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 10 }}>✨</div>
          <p style={{ color: "var(--text-soft)", fontSize: "0.9rem" }}>No preview yet. Click <b>Generate Preview</b> to create a rich visual lesson page.</p>
        </div>
      )}
    </div>
  );
}