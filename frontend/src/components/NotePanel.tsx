import { useEffect, useRef, useState } from "react";

const API = "http://127.0.0.1:8011/api";

interface Note {
  id: number;
  content: string;
  updated_at: string;
}

interface NotePanelProps {
  chatId: string;
  courseId: string | null;
  lessonId: string | null | undefined;
  sectionIndex: number | null | undefined;
  courseName?: string | null;
  lessonTitle?: string | null;
  // sectionTitle is fetched internally from sectionIndex
  darkMode?: boolean;
  onClose: () => void;
}

function parseDate(dateStr: string): Date {
  if (!dateStr) return new Date(0);
  // Already has timezone info
  if (dateStr.endsWith("Z") || dateStr.includes("+")) return new Date(dateStr);
  // No timezone — PostgreSQL returned naive datetime, treat as UTC
  return new Date(dateStr + "Z");
}

function timeAgo(dateStr: string): string {
  const date = parseDate(dateStr);
  const diff = Date.now() - date.getTime();
  if (diff < 0) return "just now";
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotePanel({
  courseId, lessonId, sectionIndex,
  courseName, lessonTitle,
  darkMode = false, onClose,
}: NotePanelProps) {
  const [note, setNote] = useState<Note | null>(null);
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [loading, setLoading] = useState(true);
  // Resolved section title fetched from backend
  const [resolvedSectionTitle, setResolvedSectionTitle] = useState<string | null>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Guard against duplicate creates (React StrictMode / concurrent renders)
  const creatingRef = useRef(false);
  const mountedRef = useRef(true);

  const dm = darkMode;
  const panelBg = dm ? "#1e293b" : "#ffffff";
  const headerBg = dm ? "#111827" : "#f8fafc";
  const textPrimary = dm ? "#f1f5f9" : "#0f172a";
  const textMuted = dm ? "#475569" : "#94a3b8";
  const border = dm ? "#334155" : "#e2e8f0";
  const inputBg = dm ? "#0f172a" : "#f9fafb";
  const inputBorder = dm ? "#334155" : "#e2e8f0";

  const token = () => localStorage.getItem("token");

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.max(textareaRef.current.scrollHeight, 180) + "px";
    }
  }, [content]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Step 1: fetch section title from backend if sectionIndex is set
  useEffect(() => {
    if (sectionIndex == null || !lessonId) {
      setResolvedSectionTitle(null);
      return;
    }
    fetch(`${API}/lessons/${lessonId}/sections`, {
      headers: { Authorization: `Bearer ${token()}` },
    })
      .then((r) => r.json())
      .then((data) => {
        const sections = data.sections ?? [];
        const sec = sections[sectionIndex];
        if (sec && mountedRef.current) {
          setResolvedSectionTitle(sec.title ?? `Section ${sectionIndex + 1}`);
        }
      })
      .catch(() => {
        if (mountedRef.current) setResolvedSectionTitle(`Section ${sectionIndex + 1}`);
      });
  }, [lessonId, sectionIndex]);

  // Step 2: load or create note — runs once after sectionTitle resolves (or immediately if no section)
  useEffect(() => {
    // If sectionIndex is set, wait for resolvedSectionTitle to be known
    if (sectionIndex != null && lessonId && resolvedSectionTitle === null) return;

    const effectiveSectionTitle = sectionIndex != null ? resolvedSectionTitle : null;

    async function load() {
      if (creatingRef.current) return;
      setLoading(true);

      try {
        const params = new URLSearchParams();
        if (lessonId) params.set("lesson_id", lessonId);
        else if (courseId) params.set("course_id", courseId);
        if (sectionIndex != null) params.set("section_index", String(sectionIndex));

        const res = await fetch(`${API}/notes/by-context?${params}`, {
          headers: { Authorization: `Bearer ${token()}` },
        });
        const data = await res.json();

        if (!mountedRef.current) return;

        if (data.note) {
          // Update section title if it was missing
          if (effectiveSectionTitle && !data.note.section_title) {
            await fetch(`${API}/notes/${data.note.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
              body: JSON.stringify({
                content: data.note.content,
                section_title: effectiveSectionTitle,
                lesson_title: lessonTitle,
                course_name: courseName,
              }),
            });
          }
          setNote(data.note);
          setContent(data.note.content);
          setStatus(data.note.content ? "saved" : "idle");
        } else {
          // Create new note — guard against duplicates
          if (creatingRef.current) return;
          creatingRef.current = true;
          try {
            const createRes = await fetch(`${API}/notes/`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
              body: JSON.stringify({
                course_id: courseId,
                lesson_id: lessonId,
                section_index: sectionIndex ?? null,
                course_name: courseName,
                lesson_title: lessonTitle,
                section_title: effectiveSectionTitle,
                content: "",
              }),
            });
            const newNote = await createRes.json();
            if (mountedRef.current) {
              setNote(newNote);
              setContent("");
              setStatus("idle");
            }
          } finally {
            creatingRef.current = false;
          }
        }
      } catch {
        if (mountedRef.current) setStatus("error");
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    }

    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedSectionTitle, lessonId, courseId, sectionIndex]);

  async function save(noteId: number, text: string) {
    setStatus("saving");
    try {
      await fetch(`${API}/notes/${noteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          content: text,
          course_name: courseName,
          lesson_title: lessonTitle,
          section_title: resolvedSectionTitle,
        }),
      });
      setNote((prev) => prev ? { ...prev, content: text, updated_at: new Date().toISOString() } : prev);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  function handleChange(value: string) {
    setContent(value);
    setStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (note) {
      saveTimer.current = setTimeout(() => save(note.id, value), 900);
    }
  }

  // Display label in header
  const contextLabel = resolvedSectionTitle
    ? resolvedSectionTitle
    : sectionIndex != null
    ? `Section ${sectionIndex + 1}`
    : lessonTitle
    ? `${lessonTitle} — Full Lesson`
    : courseName ?? "Note";

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      width: 320, minWidth: 320, height: "100%",
      background: panelBg,
      borderLeft: `1px solid ${border}`,
      boxShadow: dm ? "-4px 0 20px rgba(0,0,0,0.4)" : "-4px 0 20px rgba(148,163,184,0.12)",
      fontFamily: "inherit",
    }}>
      {/* Header */}
      <div style={{ padding: "1rem 1.25rem 0.75rem", background: headerBg, borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 9, background: "linear-gradient(135deg,#f97316,#ec4899)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 3px 8px rgba(249,115,22,0.3)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
            </div>
            <span style={{ fontWeight: 700, fontSize: "0.9rem", color: textPrimary }}>Notes</span>
          </div>
          <button onClick={onClose}
            style={{ width: 26, height: 26, borderRadius: 8, border: "none", background: "transparent", color: textMuted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem", fontWeight: 700, transition: "all 0.15s" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = dm ? "#1e293b" : "#f3f4f6"; e.currentTarget.style.color = textPrimary; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = textMuted; }}>
            ✕
          </button>
        </div>

        {/* Breadcrumb: lesson title > section */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
          {lessonTitle && (
            <>
              <span style={{ fontSize: "0.65rem", color: textMuted, fontWeight: 500 }}>{lessonTitle}</span>
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={textMuted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </>
          )}
          <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#f97316", background: "rgba(249,115,22,0.1)", padding: "2px 8px", borderRadius: 99 }}>
            {resolvedSectionTitle ?? (sectionIndex != null ? `Section ${sectionIndex + 1}` : "Full Lesson")}
          </span>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "1rem" }}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: 10, color: textMuted }}>
            <div style={{ width: 24, height: 24, border: `2px solid ${dm ? "#334155" : "#e2e8f0"}`, borderTopColor: "#f97316", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
            <p style={{ fontSize: "0.78rem" }}>Loading note…</p>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={`Notes for ${contextLabel}…\n\nChanges save automatically.`}
            autoFocus
            style={{
              width: "100%", minHeight: 180,
              background: inputBg, border: `1.5px solid ${inputBorder}`,
              borderRadius: 14, padding: "0.9rem 1rem",
              fontSize: "0.88rem", lineHeight: 1.7,
              color: textPrimary, fontFamily: "inherit",
              outline: "none", resize: "none",
              boxSizing: "border-box" as const, transition: "border-color 0.15s",
            }}
            onFocus={(e) => e.target.style.borderColor = "#f97316"}
            onBlur={(e) => e.target.style.borderColor = inputBorder}
          />
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: "0.6rem 1.25rem", borderTop: `1px solid ${border}`, flexShrink: 0, background: headerBg, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "0.68rem", color: textMuted }}>
          {note ? `Updated ${timeAgo(note.updated_at)}` : ""}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {status === "saving" && (
            <>
              <div style={{ width: 7, height: 7, borderRadius: "50%", border: "2px solid #f97316", borderTopColor: "transparent", animation: "spin 0.6s linear infinite" }} />
              <span style={{ fontSize: "0.68rem", color: "#f97316", fontWeight: 600 }}>Saving…</span>
            </>
          )}
          {status === "saved" && (
            <>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              <span style={{ fontSize: "0.68rem", color: "#10b981", fontWeight: 600 }}>Saved</span>
            </>
          )}
          {status === "error" && <span style={{ fontSize: "0.68rem", color: "#ef4444", fontWeight: 600 }}>Save failed</span>}
          {status === "idle" && <span style={{ fontSize: "0.68rem", color: textMuted }}>Start typing to save</span>}
        </div>
      </div>
    </div>
  );
}