import { useRef, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { Chat } from "../types";

interface ChatPageProps {
  chatId: string;
  chat: Chat;
  streaming: boolean;
  animateInitialMessage?: boolean;
  onSend: (content: string) => void;
  onRegenerate: () => void;
  onBack: () => void;
}

interface SlideBase { type: string; title: string; image_keyword?: string | null; highlight?: string; }
interface IntroSlide extends SlideBase { type: "intro"; subtitle: string; body: string; }
interface ConceptSlide extends SlideBase { type: "concept" | "deep_dive" | "example"; body: string; }
interface ComparisonSlide extends SlideBase { type: "comparison"; table: { headers: string[]; rows: string[][] }; }
interface SummarySlide extends SlideBase { type: "summary"; points: string[]; closing: string; }
type Slide = IntroSlide | ConceptSlide | ComparisonSlide | SummarySlide;
interface LessonPageData { hero_keyword?: string; learning_objectives?: string[]; slides: Slide[]; }
interface PublishedSection { title: string; draft: string; section_index: number; page_start: number; page_end: number; }

const SLIDE_ACCENTS: Record<string, { grad: string; light: string; icon: string }> = {
  intro:      { grad: "linear-gradient(135deg,#6366f1,#8b5cf6)", light: "#ede9fe", icon: "🚀" },
  concept:    { grad: "linear-gradient(135deg,#0ea5e9,#6366f1)", light: "#e0f2fe", icon: "💡" },
  deep_dive:  { grad: "linear-gradient(135deg,#f97316,#ef4444)", light: "#fff7ed", icon: "🔬" },
  example:    { grad: "linear-gradient(135deg,#10b981,#0ea5e9)", light: "#ecfdf5", icon: "📌" },
  comparison: { grad: "linear-gradient(135deg,#f59e0b,#f97316)", light: "#fffbeb", icon: "⚖️" },
  summary:    { grad: "linear-gradient(135deg,#ec4899,#f97316)", light: "#fdf2f8", icon: "✅" },
};
function accent(type: string) { return SLIDE_ACCENTS[type] || SLIDE_ACCENTS["concept"]; }

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
function extractSlides(raw: string): LessonPageData | null {
  if (!raw) return null;
  let text = raw.trim();
  if (text.includes("```")) {
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) text = fenceMatch[1].trim();
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed: LessonPageData = JSON.parse(text.slice(start, end + 1));
    if (parsed.slides && Array.isArray(parsed.slides) && parsed.slides.length > 0) return parsed;
    return null;
  } catch { return null; }
}

function extractSections(raw: string): PublishedSection[] | null {
  if (!raw) return null;
  let text = raw.trim();
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1) return null;
  try {
    const arr: PublishedSection[] = JSON.parse(text.slice(start, end + 1));
    if (Array.isArray(arr) && arr.length > 0 && arr[0].draft) return arr;
    return null;
  } catch { return null; }
}

function isJsonContent(content: string): boolean {
  const t = content.trim(); return t.startsWith("[") || t.startsWith("{");
}

// ─── Image components ─────────────────────────────────────────────────────────

function HeroImage({ keyword }: { keyword: string }) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    fetchUnsplashUrl(keyword).then((url) => { setImgUrl(url); setLoading(false); });
  }, [keyword]);
  if (loading) return (
    <div style={{ width: "100%", height: 240, borderRadius: 14, marginBottom: 20, background: "linear-gradient(90deg,#f3f4f6 25%,#e5e7eb 50%,#f3f4f6 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }}>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    </div>
  );
  if (!imgUrl) return null;
  return (
    <div style={{ width: "100%", height: 240, borderRadius: 14, overflow: "hidden", marginBottom: 20, position: "relative", boxShadow: "0 8px 32px rgba(0,0,0,0.14)" }}>
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
    <div style={{ float: "right", width: 190, height: 130, borderRadius: 12, marginLeft: 18, marginBottom: 10, background: "linear-gradient(90deg,#f3f4f6 25%,#e5e7eb 50%,#f3f4f6 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />
  );
  if (!imgUrl) return null;
  return (
    <div style={{ float: "right", width: 190, height: 130, borderRadius: 12, overflow: "hidden", marginLeft: 18, marginBottom: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.12)" }}>
      <img src={imgUrl} alt={keyword} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
    </div>
  );
}

function HighlightBox({ text, grad }: { text: string; grad: string }) {
  return (
    <div style={{ marginTop: 14, padding: "12px 16px", borderRadius: 10, background: grad, color: "#fff", fontSize: "0.88rem", fontWeight: 600, lineHeight: 1.5, clear: "both" }}>
      <span style={{ opacity: 0.8, marginRight: 8 }}>💬</span>{text}
    </div>
  );
}

function SlideCard({ slide, index }: { slide: Slide; index: number }) {
  const ac = accent(slide.type);
  return (
    <div style={{ background: "#fff", borderRadius: 16, overflow: "hidden", border: "1px solid rgba(0,0,0,0.07)", boxShadow: "0 2px 16px rgba(0,0,0,0.05)", marginBottom: 16 }}>
      <div style={{ background: ac.grad, padding: "12px 18px", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: "1.2rem" }}>{ac.icon}</span>
        <div>
          <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.7)", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" }}>
            Slide {index + 1} · {slide.type.replace("_", " ")}
          </div>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: "1rem", lineHeight: 1.25 }}>{slide.title}</div>
        </div>
      </div>
      <div style={{ padding: "18px 20px" }}>
        {slide.type === "intro" && (() => {
          const s = slide as IntroSlide;
          return (<>
            {s.image_keyword && <HeroImage keyword={s.image_keyword} />}
            <p style={{ fontSize: "0.95rem", color: "#6366f1", fontWeight: 700, margin: "0 0 8px" }}>{s.subtitle}</p>
            <p style={{ fontSize: "0.9rem", color: "#374151", lineHeight: 1.8, margin: 0 }}>{s.body}</p>
          </>);
        })()}
        {slide.type === "concept" && (() => {
          const s = slide as ConceptSlide;
          return (<>
            <p style={{ fontSize: "0.9rem", color: "#374151", lineHeight: 1.85, margin: 0 }}>{s.body}</p>
            {s.highlight && <HighlightBox text={s.highlight} grad={ac.grad} />}
          </>);
        })()}
        {slide.type === "deep_dive" && (() => {
          const s = slide as ConceptSlide;
          return (<div style={{ overflow: "hidden" }}>
            {s.image_keyword && <SideImage keyword={s.image_keyword} />}
            <p style={{ fontSize: "0.9rem", color: "#374151", lineHeight: 1.85, margin: 0 }}>{s.body}</p>
            {s.highlight && <HighlightBox text={s.highlight} grad={ac.grad} />}
          </div>);
        })()}
        {slide.type === "example" && (() => {
          const s = slide as ConceptSlide;
          return (<>
            <p style={{ fontSize: "0.9rem", color: "#374151", lineHeight: 1.85, margin: 0 }}>{s.body}</p>
            {s.highlight && <HighlightBox text={s.highlight} grad={ac.grad} />}
          </>);
        })()}
        {slide.type === "comparison" && (() => {
          const s = slide as ComparisonSlide;
          return (<>
            {s.table && (
              <div style={{ overflowX: "auto", marginBottom: 12 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                  <thead><tr>{s.table.headers.map((h, i) => (
                    <th key={i} style={{ background: ac.grad, color: "#fff", padding: "9px 12px", textAlign: "left", fontWeight: 700, fontSize: "0.8rem" }}>{h}</th>
                  ))}</tr></thead>
                  <tbody>{s.table.rows.map((row, ri) => (
                    <tr key={ri} style={{ background: ri % 2 === 0 ? "#f9fafb" : "#fff" }}>
                      {row.map((cell, ci) => (
                        <td key={ci} style={{ padding: "8px 12px", color: ci === 0 ? "#111827" : "#374151", fontWeight: ci === 0 ? 600 : 400, borderBottom: "1px solid #f3f4f6" }}>{cell}</td>
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
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
              {(s.points || []).map((pt, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", background: ac.light, borderRadius: 10 }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: ac.grad, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.72rem", fontWeight: 800, flexShrink: 0 }}>{i + 1}</div>
                  <span style={{ fontSize: "0.88rem", color: "#374151", lineHeight: 1.6 }}>{pt}</span>
                </div>
              ))}
            </div>
            {s.closing && <div style={{ padding: "12px 16px", borderRadius: 10, background: ac.grad, color: "#fff", fontSize: "0.88rem", fontWeight: 600, lineHeight: 1.5 }}><span style={{ marginRight: 8 }}>🎯</span>{s.closing}</div>}
          </>);
        })()}
      </div>
    </div>
  );
}

function LearningObjectives({ objectives }: { objectives: string[] }) {
  return (
    <div style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", borderRadius: 14, padding: "14px 18px", marginBottom: 16, color: "#fff" }}>
      <div style={{ fontWeight: 800, fontSize: "0.78rem", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10, opacity: 0.85 }}>🎯 Learning Objectives</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {objectives.map((obj, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <div style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(255,255,255,0.25)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.68rem", fontWeight: 800, flexShrink: 0 }}>{i + 1}</div>
            <span style={{ fontSize: "0.86rem", lineHeight: 1.5 }}>{obj}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RichLessonView({ content }: { content: string }) {
  // Try published sections array first
  const sections = extractSections(content);
  if (sections) {
    return (
      <div>
        {sections.map((sec, si) => {
          const data = extractSlides(sec.draft);
          return (
            <div key={si} style={{ marginBottom: 32 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, paddingBottom: 12, borderBottom: "2px solid #f3f4f6" }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: "linear-gradient(135deg,#f97316,#ec4899)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: "0.9rem" }}>{si + 1}</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "#111827" }}>{sec.title}</div>
                  <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>p.{sec.page_start}–{sec.page_end}</div>
                </div>
              </div>
              {data ? (
                <>
                  {data.learning_objectives && data.learning_objectives.length > 0 && <LearningObjectives objectives={data.learning_objectives} />}
                  {data.slides.map((slide, i) => <SlideCard key={i} slide={slide} index={i} />)}
                </>
              ) : (
                <div style={{ fontSize: "0.9rem", color: "#374151", lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{sec.draft}</div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Try single slide JSON
  const data = extractSlides(content);
  if (data) {
    return (
      <div>
        {data.learning_objectives && data.learning_objectives.length > 0 && <LearningObjectives objectives={data.learning_objectives} />}
        {data.slides.map((slide, i) => <SlideCard key={i} slide={slide} index={i} />)}
      </div>
    );
  }

  // Fallback markdown
  return (
    <ReactMarkdown components={{
      p: ({ children }) => <p style={{ margin: "0.35rem 0", lineHeight: 1.65 }}>{children}</p>,
      h1: ({ children }) => <h1 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0.7rem 0 0.35rem" }}>{children}</h1>,
      h2: ({ children }) => <h2 style={{ fontSize: "1rem", fontWeight: 700, margin: "0.6rem 0 0.3rem" }}>{children}</h2>,
      ul: ({ children }) => <ul style={{ paddingLeft: "1.3rem", margin: "0.35rem 0" }}>{children}</ul>,
      li: ({ children }) => <li style={{ marginBottom: "0.2rem" }}>{children}</li>,
      strong: ({ children }) => <strong style={{ fontWeight: 700 }}>{children}</strong>,
    }}>{content}</ReactMarkdown>
  );
}

export default function ChatPage({ chatId, chat, streaming, animateInitialMessage = false, onSend, onRegenerate, onBack }: ChatPageProps) {
  const [input, setInput] = useState("");
  const [animatedFirstMessage, setAnimatedFirstMessage] = useState("");
  const [animatedChatId, setAnimatedChatId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messages = chat.messages ?? [];
  const hasExchange = messages.length >= 2 && messages.at(-1)?.role === "assistant" && messages.at(-2)?.role === "user";

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length, messages.at(-1)?.content, animatedFirstMessage]);

  useEffect(() => {
    const firstAssistantMessage = messages.find((m) => m.role === "assistant")?.content || "";
    if (!firstAssistantMessage || !animateInitialMessage || isJsonContent(firstAssistantMessage)) {
      setAnimatedFirstMessage(""); setAnimatedChatId(null); return;
    }
    if (animatedChatId === chatId) return;
    setAnimatedChatId(chatId); setAnimatedFirstMessage("");
    let i = 0;
    const interval = setInterval(() => {
      i += 8;
      setAnimatedFirstMessage(firstAssistantMessage.slice(0, i));
      if (i >= firstAssistantMessage.length) { clearInterval(interval); setAnimatedFirstMessage(firstAssistantMessage); }
    }, 18);
    return () => clearInterval(interval);
  }, [chatId, messages.length, animateInitialMessage]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const val = input.trim();
    if (!val || streaming) return;
    setInput(""); onSend(val);
  }

  const courseLabel = chat.course_id ? chat.course_id.split("::")[1] ?? chat.course_id : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#f8fafc" }}>
      <div style={{ padding: "1rem 1.5rem", background: "#fff", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onBack} style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid #e5e7eb", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <div style={{ width: 40, height: 40, borderRadius: 14, background: "linear-gradient(135deg,#f97316,#ec4899)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: "0.95rem", color: "#111827", margin: 0 }}>{chat.title || "Learning Chat"}</p>
            <p style={{ fontSize: "0.75rem", color: "#9ca3af", margin: 0 }}>
              {courseLabel && <span>{courseLabel} · </span>}
              <span style={{ color: "#f97316", fontWeight: 600 }}>{chat.mode}</span>
              {chat.tone && <span> · {chat.tone}</span>}
            </p>
          </div>
        </div>
        {hasExchange && !streaming && (
          <button onClick={onRegenerate} style={{ padding: "7px 14px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff", color: "#374151", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
            Regenerate
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem", display: "flex", flexDirection: "column", gap: 16 }}>
        {messages.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 16, padding: "3rem 1rem" }}>
            <div style={{ width: 72, height: 72, borderRadius: 22, background: "linear-gradient(135deg,#f97316,#ec4899)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 24px rgba(249,115,22,0.3)" }}>
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "1.2rem", fontWeight: 700, color: "#111827", margin: "0 0 6px" }}>Your conversation starts here</p>
              <p style={{ fontSize: "0.9rem", color: "#9ca3af", margin: 0 }}>Ask anything about this lesson.</p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          const firstAssistantIndex = messages.findIndex((m) => m.role === "assistant");
          const isFirstAssistant = msg.role === "assistant" && firstAssistantIndex === i;
          const displayContent = isFirstAssistant && animatedChatId === chatId && !isJsonContent(msg.content || "") ? animatedFirstMessage : msg.content;

          if (isFirstAssistant) return (
            <div key={i} style={{ width: "100%" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: "linear-gradient(135deg,#f97316,#ec4899)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z" /></svg>
                </div>
                <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em" }}>Lesson Content</span>
              </div>
              <RichLessonView content={displayContent || ""} />
            </div>
          );

          return (
            <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
              {msg.role === "assistant" && (
                <div style={{ width: 32, height: 32, borderRadius: 10, background: "linear-gradient(135deg,#f97316,#ec4899)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginRight: 10, marginTop: 2 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z" /></svg>
                </div>
              )}
              <div style={{ maxWidth: "75%", padding: "12px 16px", borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px", background: msg.role === "user" ? "linear-gradient(135deg,#f97316,#ec4899)" : "#fff", color: msg.role === "user" ? "#fff" : "#111827", fontSize: "0.92rem", lineHeight: 1.65, boxShadow: msg.role === "user" ? "0 4px 14px rgba(249,115,22,0.3)" : "0 1px 6px rgba(0,0,0,0.06)", border: msg.role === "assistant" ? "1px solid #f3f4f6" : "none" }}>
                {displayContent ? (
                  msg.role === "user" ? <p style={{ margin: 0 }}>{displayContent}</p> : (
                    <ReactMarkdown components={{
                      p: ({ children }) => <p style={{ margin: "0.35rem 0", lineHeight: 1.65 }}>{children}</p>,
                      h1: ({ children }) => <h1 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0.7rem 0 0.35rem", color: "#111827" }}>{children}</h1>,
                      h2: ({ children }) => <h2 style={{ fontSize: "1rem", fontWeight: 700, margin: "0.7rem 0 0.35rem", color: "#111827" }}>{children}</h2>,
                      ul: ({ children }) => <ul style={{ paddingLeft: "1.3rem", margin: "0.35rem 0" }}>{children}</ul>,
                      ol: ({ children }) => <ol style={{ paddingLeft: "1.3rem", margin: "0.35rem 0" }}>{children}</ol>,
                      li: ({ children }) => <li style={{ marginBottom: "0.2rem" }}>{children}</li>,
                      code: ({ children }) => <code style={{ background: "#f3f4f6", padding: "0.12rem 0.35rem", borderRadius: 6, fontSize: "0.85rem", fontFamily: "monospace", color: "#374151" }}>{children}</code>,
                      strong: ({ children }) => <strong style={{ fontWeight: 700, color: "#111827" }}>{children}</strong>,
                    }}>{displayContent}</ReactMarkdown>
                  )
                ) : streaming && i === messages.length - 1 ? <span style={{ color: "#9ca3af", fontSize: "1.2rem" }}>▌</span> : null}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div style={{ padding: "1rem 1.5rem", background: "#fff", borderTop: "1px solid #f3f4f6" }}>
        <form onSubmit={handleSubmit} style={{ display: "flex", alignItems: "flex-end", gap: 10, background: "#f8fafc", borderRadius: 20, border: "1.5px solid #e5e7eb", padding: "8px 8px 8px 16px" }}>
          <textarea placeholder="Ask something about this lesson…" value={input} rows={1} disabled={streaming}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(e as any); } }}
            style={{ flex: 1, resize: "none", border: "none", background: "transparent", outline: "none", fontSize: "0.95rem", color: "#111827", fontFamily: "inherit", lineHeight: 1.5, maxHeight: 120, padding: "4px 0" }} />
          <button type="submit" disabled={streaming || !input.trim()} style={{ width: 40, height: 40, borderRadius: 14, border: "none", background: streaming || !input.trim() ? "#e5e7eb" : "linear-gradient(135deg,#f97316,#ec4899)", display: "flex", alignItems: "center", justifyContent: "center", cursor: streaming || !input.trim() ? "not-allowed" : "pointer", flexShrink: 0, boxShadow: streaming || !input.trim() ? "none" : "0 4px 14px rgba(249,115,22,0.35)" }}>
            {streaming ? <div style={{ width: 16, height: 16, border: "2px solid #9ca3af", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>}
          </button>
        </form>
        <p style={{ fontSize: "0.72rem", color: "#9ca3af", textAlign: "center", marginTop: 8 }}>Press Enter to send · Shift+Enter for new line</p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}