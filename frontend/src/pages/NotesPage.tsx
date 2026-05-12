import { useEffect, useState, useRef, useCallback } from "react";

const API = "http://127.0.0.1:8011/api";

interface Note {
  id: number;
  course_id: string | null;
  lesson_id: string | null;
  section_index: number | null;
  course_name: string | null;
  lesson_title: string | null;
  section_title: string | null;
  content: string;
  created_at: string;
  updated_at: string;
}

interface NotesPageProps {
  darkMode?: boolean;
}

function parseDate(dateStr: string): Date {
  if (!dateStr) return new Date(0);
  if (dateStr.endsWith("Z") || dateStr.includes("+")) return new Date(dateStr);
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
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return date.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

function formatDate(dateStr: string): string {
  return parseDate(dateStr).toLocaleString("tr-TR", {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
}

function noteLabel(note: Note): string {
  return note.section_title ?? "Full Lesson";
}

interface LessonGroup {
  lesson_title: string;
  lesson_id: string;
  notes: Note[];
}

interface CourseGroup {
  course_name: string;
  lessons: LessonGroup[];
}

function groupNotes(notes: Note[]): Record<string, CourseGroup> {
  const courseMap: Record<string, CourseGroup> = {};
  for (const note of notes) {
    const courseKey = note.course_id ?? "__no_course__";
    const lessonKey = note.lesson_id ?? "__no_lesson__";
    if (!courseMap[courseKey]) {
      courseMap[courseKey] = {
        course_name: note.course_name ?? note.course_id ?? "General Notes",
        lessons: [],
      };
    }
    let lesson = courseMap[courseKey].lessons.find((l) => l.lesson_id === lessonKey);
    if (!lesson) {
      lesson = { lesson_title: note.lesson_title ?? note.lesson_id ?? "General", lesson_id: lessonKey, notes: [] };
      courseMap[courseKey].lessons.push(lesson);
    }
    lesson.notes.push(note);
  }
  for (const course of Object.values(courseMap)) {
    for (const lesson of course.lessons) {
      lesson.notes.sort((a, b) => {
        const la = noteLabel(a), lb = noteLabel(b);
        if (la === "Full Lesson") return 1;
        if (lb === "Full Lesson") return -1;
        return la.localeCompare(lb);
      });
    }
  }
  return courseMap;
}

// ── PDF export via window.print() ────────────────────────────────────────────

function exportAsPdf(notesToExport: Note[]) {
  const grouped = groupNotes(notesToExport);
  const exportDate = new Date().toLocaleString("tr-TR");

  let body = "";

  for (const courseGroup of Object.values(grouped)) {
    body += `<div class="course-block">
      <div class="course-title">${escHtml(courseGroup.course_name)}</div>`;

    for (const lesson of courseGroup.lessons) {
      body += `<div class="lesson-block">
        <div class="lesson-title">📖 ${escHtml(lesson.lesson_title)}</div>`;

      for (const note of lesson.notes) {
        const label = noteLabel(note);
        const content = (note.content || "").replace(/\n/g, "<br>");
        body += `<div class="note-block">
          <div class="note-header">
            <span class="note-label">${escHtml(label)}</span>
            <span class="note-date">Last edited: ${formatDate(note.updated_at)}</span>
          </div>
          <div class="note-content">${content || '<span class="empty">Empty note</span>'}</div>
        </div>`;
      }

      body += `</div>`; // lesson-block
    }

    body += `</div>`; // course-block
  }

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<title>My Notes — ${exportDate}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 13px;
    color: #111827;
    background: #fff;
    padding: 32px 40px;
    line-height: 1.6;
  }
  .page-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 28px;
    padding-bottom: 14px;
    border-bottom: 2px solid #f97316;
  }
  .page-title { font-size: 22px; font-weight: 800; color: #0f172a; }
  .page-meta { font-size: 11px; color: #94a3b8; }
  .course-block { margin-bottom: 28px; }
  .course-title {
    font-size: 10px; font-weight: 800; color: #f97316;
    text-transform: uppercase; letter-spacing: 0.1em;
    padding: 4px 10px; background: #fff7ed;
    border-radius: 6px; display: inline-block;
    margin-bottom: 12px;
  }
  .lesson-block { margin-left: 8px; margin-bottom: 18px; }
  .lesson-title {
    font-size: 13px; font-weight: 700; color: #1e293b;
    margin-bottom: 10px;
    padding-bottom: 5px;
    border-bottom: 1px solid #e2e8f0;
  }
  .note-block {
    margin-left: 12px; margin-bottom: 14px;
    border-left: 3px solid #fed7aa;
    padding-left: 12px;
    page-break-inside: avoid;
  }
  .note-header {
    display: flex; align-items: baseline;
    justify-content: space-between;
    gap: 12px; margin-bottom: 6px;
  }
  .note-label { font-size: 12px; font-weight: 700; color: #f97316; }
  .note-date { font-size: 10px; color: #94a3b8; white-space: nowrap; }
  .note-content {
    font-size: 12.5px; color: #374151;
    line-height: 1.7; white-space: pre-wrap;
  }
  .empty { color: #cbd5e1; font-style: italic; }
  @media print {
    body { padding: 20px 28px; }
    @page { margin: 1.5cm; size: A4; }
    .note-block { page-break-inside: avoid; }
    .lesson-block { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="page-header">
    <span class="page-title">My Notes</span>
    <span class="page-meta">Exported: ${exportDate} · ${notesToExport.length} note${notesToExport.length !== 1 ? "s" : ""}</span>
  </div>
  ${body}
</body>
</html>`;

  const printWin = window.open("", "_blank", "width=800,height=900");
  if (!printWin) return;
  printWin.document.write(html);
  printWin.document.close();
  printWin.focus();
  // slight delay so styles render before print dialog
  setTimeout(() => {
    printWin.print();
    printWin.close();
  }, 400);
}

function escHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function NotesPage({ darkMode = false }: NotesPageProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [expandedLessons, setExpandedLessons] = useState<Set<string>>(new Set());

  // Selection mode
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const dm = darkMode;
  const bg = dm ? "#0f172a" : "#f8fafc";
  const cardBg = dm ? "#1e293b" : "#ffffff";
  const sideBg = dm ? "#111827" : "#ffffff";
  const textPrimary = dm ? "#f1f5f9" : "#0f172a";
  const textSec = dm ? "#94a3b8" : "#64748b";
  const textMuted = dm ? "#475569" : "#94a3b8";
  const border = dm ? "#1e293b" : "#f1f5f9";
  const inputBg = dm ? "#1e293b" : "#f9fafb";
  const inputBorder = dm ? "#334155" : "#e2e8f0";
  const menuBorder = dm ? "#334155" : "#e2e8f0";

  const token = () => localStorage.getItem("token");

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch(`${API}/notes/`, { headers: { Authorization: `Bearer ${token()}` } });
      if (!res.ok) return;
      const data = await res.json();
      setNotes(data.notes ?? []);
      setExpandedLessons(new Set());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [editContent]);

  const selectedNote = notes.find((n) => n.id === selectedNoteId) ?? null;

  function toggleLesson(lessonId: string) {
    setExpandedLessons((prev) => {
      const next = new Set(prev);
      if (next.has(lessonId)) next.delete(lessonId);
      else next.add(lessonId);
      return next;
    });
  }

  function handleSelectNote(note: Note) {
    if (selectMode) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(note.id)) next.delete(note.id);
        else next.add(note.id);
        return next;
      });
      return;
    }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSelectedNoteId(note.id);
    setEditContent(note.content);
    setSaveStatus("saved");
  }

  function toggleSelectMode() {
    setSelectMode((v) => {
      if (v) setSelectedIds(new Set());
      return !v;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(filteredNotes.map((n) => n.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function saveNote(noteId: number, content: string) {
    setSaveStatus("saving");
    try {
      await fetch(`${API}/notes/${noteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ content }),
      });
      setNotes((prev) => prev.map((n) => n.id === noteId ? { ...n, content, updated_at: new Date().toISOString() } : n));
      setSaveStatus("saved");
    } catch {
      setSaveStatus("unsaved");
    }
  }

  function handleEditChange(value: string) {
    setEditContent(value);
    setSaveStatus("unsaved");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (selectedNoteId !== null) {
      saveTimerRef.current = setTimeout(() => saveNote(selectedNoteId, value), 900);
    }
  }

  async function handleDelete(noteId: number, e: React.MouseEvent) {
    e.stopPropagation();
    setDeletingId(noteId);
    try {
      await fetch(`${API}/notes/${noteId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token()}` } });
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      if (selectedNoteId === noteId) { setSelectedNoteId(null); setEditContent(""); }
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(noteId); return next; });
    } finally {
      setDeletingId(null);
    }
  }

  function handleExportSelected() {
    const toExport = notes.filter((n) => selectedIds.has(n.id));
    if (!toExport.length) return;
    exportAsPdf(toExport);
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  const filteredNotes = notes.filter((n) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (n.content ?? "").toLowerCase().includes(q) ||
      (n.course_name ?? "").toLowerCase().includes(q) ||
      (n.lesson_title ?? "").toLowerCase().includes(q) ||
      (n.section_title ?? "").toLowerCase().includes(q)
    );
  });

  const grouped = groupNotes(filteredNotes);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: textMuted, flexDirection: "column", gap: 12 }}>
        <div style={{ width: 40, height: 40, border: `3px solid ${dm ? "#334155" : "#e2e8f0"}`, borderTopColor: "#f97316", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <p style={{ fontSize: "0.88rem" }}>Loading notes…</p>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100%", background: bg, overflow: "hidden" }}>

      {/* ── Left Panel ── */}
      <div style={{ width: 310, minWidth: 310, borderRight: `1px solid ${border}`, display: "flex", flexDirection: "column", background: sideBg, overflow: "hidden" }}>

        {/* Header */}
        <div style={{ padding: "1.25rem 1.25rem 0.9rem", borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
          {/* Title row */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 11, background: "linear-gradient(135deg, #f97316, #ec4899)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 4px 10px rgba(249,115,22,0.3)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ fontWeight: 800, fontSize: "1rem", color: textPrimary, margin: 0 }}>My Notes</h2>
              <p style={{ fontSize: "0.68rem", color: textMuted, margin: 0 }}>{notes.length} note{notes.length !== 1 ? "s" : ""}</p>
            </div>

            {/* Select button only */}
            {notes.length > 0 && (
              <button
                onClick={toggleSelectMode}
                style={{
                  height: 30, padding: "0 12px", borderRadius: 9, fontSize: "0.72rem", fontWeight: 700,
                  border: `1.5px solid ${selectMode ? "#f97316" : menuBorder}`,
                  background: selectMode ? "rgba(249,115,22,0.1)" : "transparent",
                  color: selectMode ? "#f97316" : textMuted,
                  cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s", flexShrink: 0,
                }}
                onMouseEnter={(e) => { if (!selectMode) { e.currentTarget.style.borderColor = "#f97316"; e.currentTarget.style.color = "#f97316"; } }}
                onMouseLeave={(e) => { if (!selectMode) { e.currentTarget.style.borderColor = menuBorder; e.currentTarget.style.color = textMuted; } }}
              >
                {selectMode ? "Cancel" : "Select"}
              </button>
            )}
          </div>

          {/* Select mode toolbar */}
          {selectMode && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", background: dm ? "rgba(249,115,22,0.08)" : "#fff7ed", borderRadius: 10, marginBottom: 8, border: `1px solid ${dm ? "rgba(249,115,22,0.2)" : "#fed7aa"}` }}>
              <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "#f97316", flex: 1 }}>
                {selectedIds.size} selected
              </span>
              <button onClick={selectAll}
                style={{ fontSize: "0.69rem", fontWeight: 600, color: textSec, background: "transparent", border: "none", cursor: "pointer", padding: "2px 6px", borderRadius: 6, fontFamily: "inherit" }}
                onMouseEnter={(e) => e.currentTarget.style.color = "#f97316"}
                onMouseLeave={(e) => e.currentTarget.style.color = textSec}
              >All</button>
              <button onClick={clearSelection}
                style={{ fontSize: "0.69rem", fontWeight: 600, color: textSec, background: "transparent", border: "none", cursor: "pointer", padding: "2px 6px", borderRadius: 6, fontFamily: "inherit" }}
                onMouseEnter={(e) => e.currentTarget.style.color = "#ef4444"}
                onMouseLeave={(e) => e.currentTarget.style.color = textSec}
              >Clear</button>
              {selectedIds.size > 0 && (
                <button onClick={handleExportSelected}
                  style={{ fontSize: "0.69rem", fontWeight: 700, color: "#fff", background: "linear-gradient(135deg,#f97316,#ec4899)", border: "none", cursor: "pointer", padding: "4px 10px", borderRadius: 7, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  PDF
                </button>
              )}
            </div>
          )}

          {/* Search */}
          <div style={{ position: "relative" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search notes…"
              style={{ width: "100%", padding: "9px 10px 9px 30px", border: `1.5px solid ${inputBorder}`, borderRadius: 12, fontSize: "0.82rem", fontFamily: "inherit", color: textPrimary, background: inputBg, outline: "none", boxSizing: "border-box" as const, transition: "border-color 0.15s" }}
              onFocus={(e) => e.target.style.borderColor = "#f97316"}
              onBlur={(e) => e.target.style.borderColor = inputBorder} />
          </div>
        </div>

        {/* Note tree */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0.75rem" }}>
          {Object.keys(grouped).length === 0 ? (
            <div style={{ textAlign: "center", padding: "2rem 1rem", color: textMuted }}>
              <div style={{ fontSize: "2.5rem", marginBottom: 10 }}>📝</div>
              <p style={{ fontWeight: 600, color: textSec, fontSize: "0.9rem", marginBottom: 6 }}>No notes yet</p>
              <p style={{ fontSize: "0.78rem", lineHeight: 1.5 }}>Open a chat and click <strong>Notes</strong> to start.</p>
            </div>
          ) : Object.entries(grouped).map(([courseKey, courseGroup]) => (
            <div key={courseKey} style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 6px", marginBottom: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "linear-gradient(135deg, #f97316, #ec4899)", flexShrink: 0 }} />
                <span style={{ fontSize: "0.65rem", fontWeight: 800, color: "#f97316", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {courseGroup.course_name}
                </span>
              </div>

              {courseGroup.lessons.map((lesson) => {
                const isOpen = expandedLessons.has(lesson.lesson_id);
                const lessonSelectedCount = lesson.notes.filter((n) => selectedIds.has(n.id)).length;
                return (
                  <div key={lesson.lesson_id} style={{ marginBottom: 3, marginLeft: 8 }}>
                    <button
                      onClick={() => toggleLesson(lesson.lesson_id)}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", gap: 8,
                        padding: "8px 10px", borderRadius: 11,
                        border: `1.5px solid ${isOpen ? (dm ? "#334155" : "#e2e8f0") : "transparent"}`,
                        background: isOpen ? (dm ? "rgba(249,115,22,0.08)" : "rgba(249,115,22,0.04)") : "transparent",
                        cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "all 0.15s",
                      }}
                      onMouseEnter={(e) => { if (!isOpen) e.currentTarget.style.background = dm ? "rgba(255,255,255,0.04)" : "#f8fafc"; }}
                      onMouseLeave={(e) => { if (!isOpen) e.currentTarget.style.background = "transparent"; }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                        stroke={isOpen ? "#f97316" : textMuted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                        style={{ flexShrink: 0, transition: "transform 0.2s", transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}>
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                      <span style={{ fontSize: "0.8rem", fontWeight: 700, color: isOpen ? textPrimary : textSec, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        📖 {lesson.lesson_title}
                      </span>
                      {selectMode && lessonSelectedCount > 0 && (
                        <span style={{ fontSize: "0.6rem", fontWeight: 700, color: "#fff", background: "#f97316", padding: "1px 5px", borderRadius: 99, flexShrink: 0 }}>
                          {lessonSelectedCount}
                        </span>
                      )}
                      <span style={{ fontSize: "0.62rem", fontWeight: 700, color: isOpen ? "#f97316" : textMuted, background: isOpen ? "rgba(249,115,22,0.12)" : (dm ? "#1e293b" : "#f1f5f9"), padding: "1px 6px", borderRadius: 99, flexShrink: 0 }}>
                        {lesson.notes.length}
                      </span>
                    </button>

                    {isOpen && (
                      <div style={{ marginLeft: 20, marginTop: 4, marginBottom: 6 }}>
                        {lesson.notes.map((note) => {
                          const isEditing = note.id === selectedNoteId && !selectMode;
                          const isChecked = selectedIds.has(note.id);
                          const label = noteLabel(note);
                          const preview = note.content.trim().slice(0, 60) || "Empty note…";
                          return (
                            <div key={note.id}
                              onClick={() => handleSelectNote(note)}
                              style={{
                                padding: "8px 10px", borderRadius: 10, marginBottom: 3, cursor: "pointer",
                                border: `1.5px solid ${isChecked ? "#f97316" : isEditing ? "#fed7aa" : (dm ? "#1e293b" : "#f1f5f9")}`,
                                background: isChecked
                                  ? (dm ? "rgba(249,115,22,0.15)" : "rgba(249,115,22,0.08)")
                                  : isEditing
                                  ? (dm ? "rgba(249,115,22,0.12)" : "linear-gradient(135deg, rgba(249,115,22,0.06), rgba(236,72,153,0.04))")
                                  : "transparent",
                                transition: "all 0.15s",
                                display: "flex", alignItems: "flex-start", gap: 8,
                              }}
                              onMouseEnter={(e) => { if (!isEditing && !isChecked) e.currentTarget.style.background = dm ? "rgba(249,115,22,0.06)" : "#fafafa"; }}
                              onMouseLeave={(e) => { if (!isEditing && !isChecked) e.currentTarget.style.background = "transparent"; }}
                            >
                              {selectMode && (
                                <div style={{
                                  width: 16, height: 16, borderRadius: 5, flexShrink: 0, marginTop: 2,
                                  border: `2px solid ${isChecked ? "#f97316" : textMuted}`,
                                  background: isChecked ? "#f97316" : "transparent",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  transition: "all 0.12s",
                                }}>
                                  {isChecked && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                                </div>
                              )}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: "0.72rem", fontWeight: 700, color: isChecked ? "#f97316" : isEditing ? "#ea580c" : "#f97316", marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {label}
                                </div>
                                <div style={{ fontSize: "0.74rem", color: textPrimary, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }}>
                                  {preview}
                                </div>
                                <div style={{ fontSize: "0.63rem", color: textMuted, marginTop: 4 }}>{timeAgo(note.updated_at)}</div>
                              </div>
                              {!selectMode && (
                                <button onClick={(e) => handleDelete(note.id, e)}
                                  style={{ width: 20, height: 20, borderRadius: 6, border: "none", background: "transparent", color: textMuted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "0.7rem", fontWeight: 700, transition: "all 0.15s", opacity: 0.5 }}
                                  onMouseEnter={(e) => { e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.background = "#fef2f2"; e.currentTarget.style.opacity = "1"; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.color = textMuted; e.currentTarget.style.background = "transparent"; e.currentTarget.style.opacity = "0.5"; }}>
                                  ✕
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* ── Right Panel: Editor ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {selectedNote && !selectMode ? (
          <>
            <div style={{ padding: "1.25rem 2rem 1rem", borderBottom: `1px solid ${border}`, background: cardBg, flexShrink: 0 }}>
              {/* Breadcrumb */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                {selectedNote.course_name && (
                  <>
                    <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#f97316", background: "rgba(249,115,22,0.1)", padding: "2px 8px", borderRadius: 99 }}>
                      {selectedNote.course_name}
                    </span>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={textMuted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </>
                )}
                {selectedNote.lesson_title && (
                  <>
                    <span style={{ fontSize: "0.72rem", color: textSec, fontWeight: 600 }}>{selectedNote.lesson_title}</span>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={textMuted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </>
                )}
                <span style={{ fontSize: "0.72rem", color: textSec, fontWeight: 600 }}>{selectedNote.section_title ?? "Full Lesson"}</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <p style={{ fontSize: "0.75rem", color: textMuted, margin: 0 }}>Last edited {formatDate(selectedNote.updated_at)}</p>
                  {saveStatus === "saving" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 5, color: "#f97316", fontSize: "0.72rem", fontWeight: 600 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", border: "2px solid #f97316", borderTopColor: "transparent", animation: "spin 0.6s linear infinite" }} />
                      Saving…
                    </div>
                  )}
                  {saveStatus === "saved" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 5, color: "#10b981", fontSize: "0.72rem", fontWeight: 600 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      Saved
                    </div>
                  )}
                  {saveStatus === "unsaved" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 5, color: textMuted, fontSize: "0.72rem" }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#f97316" }} />
                      Unsaved
                    </div>
                  )}
                </div>

                {/* Export this note as PDF */}
                <button
                  onClick={() => exportAsPdf([selectedNote])}
                  title="Export as PDF"
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "6px 12px", borderRadius: 9,
                    border: `1.5px solid ${inputBorder}`,
                    background: cardBg, color: textSec,
                    fontSize: "0.78rem", fontWeight: 600,
                    cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s", flexShrink: 0,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#f97316"; e.currentTarget.style.color = "#f97316"; e.currentTarget.style.background = "rgba(249,115,22,0.06)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = inputBorder; e.currentTarget.style.color = textSec; e.currentTarget.style.background = cardBg; }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Export PDF
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem 2rem", background: bg }}>
              <textarea
                ref={textareaRef}
                value={editContent}
                onChange={(e) => handleEditChange(e.target.value)}
                placeholder="Start writing your notes here…"
                style={{
                  width: "100%", minHeight: 300,
                  background: cardBg, border: `1.5px solid ${inputBorder}`,
                  borderRadius: 16, padding: "1.25rem 1.5rem",
                  fontSize: "0.95rem", lineHeight: 1.75,
                  color: textPrimary, fontFamily: "inherit",
                  outline: "none", resize: "none",
                  boxSizing: "border-box" as const, transition: "border-color 0.15s",
                  boxShadow: dm ? "none" : "0 1px 6px rgba(0,0,0,0.04)",
                }}
                onFocus={(e) => e.target.style.borderColor = "#f97316"}
                onBlur={(e) => e.target.style.borderColor = inputBorder}
              />
              <p style={{ fontSize: "0.72rem", color: textMuted, marginTop: 8, textAlign: "right" }}>
                {editContent.length} characters · changes save automatically
              </p>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14, color: textMuted, padding: "2rem" }}>
            {selectMode ? (
              <>
                <div style={{ width: 80, height: 80, borderRadius: 24, background: dm ? "rgba(249,115,22,0.1)" : "#fff7ed", border: `2px solid ${dm ? "rgba(249,115,22,0.3)" : "#fed7aa"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.85 }}>
                    <polyline points="9 11 12 14 22 4"/>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                  </svg>
                </div>
                <p style={{ fontWeight: 700, fontSize: "1rem", color: textSec, margin: 0 }}>
                  {selectedIds.size > 0 ? `${selectedIds.size} note${selectedIds.size !== 1 ? "s" : ""} selected` : "Select notes to export"}
                </p>
                <p style={{ fontSize: "0.82rem", color: textMuted, textAlign: "center", maxWidth: 300, lineHeight: 1.6, margin: 0 }}>
                  Tick notes in the list, then export as PDF.
                </p>
                {selectedIds.size > 0 && (
                  <button onClick={handleExportSelected}
                    style={{ padding: "10px 24px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#f97316,#ec4899)", color: "#fff", fontSize: "0.88rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 14px rgba(249,115,22,0.3)" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Export {selectedIds.size} note{selectedIds.size !== 1 ? "s" : ""} as PDF
                  </button>
                )}
              </>
            ) : (
              <>
                <div style={{ width: 80, height: 80, borderRadius: 24, background: dm ? "rgba(249,115,22,0.1)" : "#fff7ed", border: `2px dashed ${dm ? "rgba(249,115,22,0.3)" : "#fed7aa"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
                    <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                  </svg>
                </div>
                <p style={{ fontWeight: 700, fontSize: "1rem", color: textSec, margin: 0 }}>Select a note to edit</p>
                <p style={{ fontSize: "0.82rem", color: textMuted, textAlign: "center", maxWidth: 320, lineHeight: 1.6, margin: 0 }}>
                  Changes save automatically. Open a lesson chat to start taking notes.
                </p>
              </>
            )}
          </div>
        )}
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}