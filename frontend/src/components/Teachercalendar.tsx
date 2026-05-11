import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { events as eventsApi } from "../services/api";
import type { CalendarEvent } from "../services/api";

const COLORS = [
  { label: "Blue",   value: "#3b82f6" },
  { label: "Red",    value: "#ef4444" },
  { label: "Purple", value: "#8b5cf6" },
  { label: "Green",  value: "#10b981" },
  { label: "Orange", value: "#f97316" },
  { label: "Pink",   value: "#ec4899" },
];

const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const dayNames   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

export function TeacherCalendar({ darkMode, cardBg, textPrimary, textSecondary, borderColor }: {
  darkMode: boolean; cardBg: string; textPrimary: string; textSecondary: string; borderColor: string;
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [myEvents, setMyEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const [fTitle, setFTitle] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fDate, setFDate] = useState("");
  const [fTime, setFTime] = useState("");
  const [fColor, setFColor] = useState("#3b82f6");
  const [fShared, setFShared] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadEvents() {
    setLoading(true);
    try { setMyEvents(await eventsApi.getMine()); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadEvents(); }, []);

  function openCreateForm(date?: Date) {
    setEditingEvent(null);
    setFTitle(""); setFDesc(""); setFTime(""); setFColor("#3b82f6"); setFShared(false);
    setFDate(date ? dateStr(date) : "");
    setShowForm(true);
  }

  function openEditForm(ev: CalendarEvent) {
    setEditingEvent(ev);
    setFTitle(ev.title); setFDesc(ev.description); setFDate(ev.event_date);
    setFTime(ev.event_time); setFColor(ev.color); setFShared(ev.is_shared);
    setShowForm(true);
  }

  async function handleSave() {
    if (!fTitle.trim() || !fDate) { setError("Title and date are required."); return; }
    setSaving(true); setError("");
    try {
      if (editingEvent) {
        await eventsApi.update(editingEvent.id, { title: fTitle, description: fDesc, event_date: fDate, event_time: fTime, color: fColor, is_shared: fShared });
      } else {
        await eventsApi.create({ title: fTitle, description: fDesc, event_date: fDate, event_time: fTime, color: fColor, is_shared: fShared });
      }
      setShowForm(false); setEditingEvent(null);
      await loadEvents();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Delete this event?")) return;
    try { await eventsApi.delete(id); await loadEvents(); }
    catch (e: any) { setError(e.message); }
  }

  async function toggleShare(ev: CalendarEvent) {
    try { await eventsApi.update(ev.id, { is_shared: !ev.is_shared }); await loadEvents(); }
    catch (e: any) { setError(e.message); }
  }

  function dateStr(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function parseDate(s: string) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  const daysInMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const firstDay    = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1).getDay();

  const isToday = (day: number) => {
    const t = new Date();
    return day === t.getDate() && currentDate.getMonth() === t.getMonth() && currentDate.getFullYear() === t.getFullYear();
  };

  const curMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;
  const eventsThisMonth = myEvents.filter(e => e.event_date.startsWith(curMonthStr));

  function getEventsForDay(day: number) {
    const ds = `${curMonthStr}-${String(day).padStart(2, "0")}`;
    return eventsThisMonth.filter(e => e.event_date === ds);
  }

  const selectedEvents = selectedDate ? getEventsForDay(selectedDate.getDate()) : [];

  const upcoming = [...myEvents]
    .filter(e => e.event_date >= dateStr(new Date()))
    .sort((a, b) => a.event_date.localeCompare(b.event_date))
    .slice(0, 5);

  const cells: JSX.Element[] = [];
  for (let i = 0; i < firstDay(currentDate); i++) cells.push(<div key={`e${i}`} />);
  for (let day = 1; day <= daysInMonth(currentDate); day++) {
    const todayFlag = isToday(day);
    const evts = getEventsForDay(day);
    const ds = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    cells.push(
      <button key={day}
        onClick={() => { setSelectedDate(ds); openCreateForm(ds); }}
        onContextMenu={(e) => { e.preventDefault(); setSelectedDate(ds); }}
        style={{
          height: 36, borderRadius: 8, border: "none", cursor: "pointer",
          fontFamily: "inherit", fontSize: "0.8rem", fontWeight: 600,
          position: "relative", transition: "all 0.15s",
          background: todayFlag ? "linear-gradient(135deg, #f97316, #ec4899)"
            : evts.length > 0 ? (darkMode ? "rgba(59,130,246,0.2)" : "#eff6ff")
            : "transparent",
          color: todayFlag ? "#fff" : evts.length > 0 ? "#3b82f6" : textPrimary,
          boxShadow: todayFlag ? "0 3px 10px rgba(249,115,22,0.35)" : "none",
        }}
        onMouseEnter={(e) => { if (!todayFlag) e.currentTarget.style.background = darkMode ? "rgba(255,255,255,0.08)" : "#f1f5f9"; }}
        onMouseLeave={(e) => { if (!todayFlag) e.currentTarget.style.background = evts.length > 0 ? (darkMode ? "rgba(59,130,246,0.2)" : "#eff6ff") : "transparent"; }}
        title="Click to add event"
      >
        {day}
        {evts.length > 0 && (
          <div style={{ position: "absolute", bottom: 2, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 2 }}>
            {evts.slice(0, 3).map((ev, i) => (
              <div key={i} style={{ width: 4, height: 4, borderRadius: "50%", background: ev.color }} />
            ))}
          </div>
        )}
      </button>
    );
  }

  return (
    <div style={{ background: cardBg, backdropFilter: "blur(20px)", borderRadius: 20, border: `1px solid ${borderColor}`, boxShadow: "0 4px 24px rgba(0,0,0,0.06)", padding: "1.25rem", marginTop: "1.25rem" }}>
      {error && (
        <div style={{ background: "#fee2e2", color: "#dc2626", borderRadius: 10, padding: "7px 12px", fontSize: "0.82rem", marginBottom: 10 }}>
          {error} <button onClick={() => setError("")} style={{ marginLeft: 8, background: "none", border: "none", cursor: "pointer", color: "#dc2626" }}>✕</button>
        </div>
      )}

      {/* Two-column layout: calendar left, upcoming + selected right */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20 }}>

        {/* LEFT: calendar */}
        <div>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ padding: 7, background: "linear-gradient(135deg, #f97316, #ec4899)", borderRadius: 10 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </div>
              <span style={{ fontSize: "0.95rem", fontWeight: 700, color: textPrimary }}>Calendar</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
                style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${borderColor}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={textSecondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: textPrimary, minWidth: 110, textAlign: "center" }}>
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </span>
              <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
                style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${borderColor}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={textSecondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
              <button onClick={() => openCreateForm()}
                style={{ padding: "5px 12px", borderRadius: 8, background: "linear-gradient(135deg, #f97316, #ec4899)", color: "#fff", border: "none", cursor: "pointer", fontSize: "0.78rem", fontWeight: 700, fontFamily: "inherit" }}>
                + New
              </button>
            </div>
          </div>

          {/* Day labels */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 4 }}>
            {dayNames.map((d) => (
              <div key={d} style={{ textAlign: "center", fontSize: "0.68rem", fontWeight: 700, color: textSecondary, padding: "3px 0" }}>{d}</div>
            ))}
          </div>

          {/* Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
            {cells}
          </div>
        </div>

        {/* RIGHT: selected day + upcoming */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Selected day events */}
          {selectedDate ? (
            <div style={{ background: darkMode ? "rgba(15,23,42,0.5)" : "#f8fafc", borderRadius: 14, padding: "0.9rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <p style={{ fontSize: "0.75rem", fontWeight: 700, color: textSecondary, margin: 0 }}>
                  {selectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric", weekday: "short" })}
                </p>
                <button onClick={() => openCreateForm(selectedDate)}
                  style={{ fontSize: "0.72rem", fontWeight: 700, color: "#f97316", background: "none", border: "none", cursor: "pointer" }}>
                  + Add
                </button>
              </div>
              {selectedEvents.length === 0 ? (
                <p style={{ fontSize: "0.78rem", color: textSecondary, margin: 0 }}>No events.</p>
              ) : selectedEvents.map((ev) => (
                <div key={ev.id} style={{ padding: "8px 10px", borderRadius: 10, marginBottom: 5, borderLeft: `3px solid ${ev.color}`, background: darkMode ? "rgba(255,255,255,0.04)" : "#fff" }}>
                  <p style={{ fontWeight: 600, color: textPrimary, fontSize: "0.8rem", margin: "0 0 2px" }}>{ev.title}</p>
                  {ev.event_time && <p style={{ fontSize: "0.7rem", color: textSecondary, margin: "0 0 5px" }}>🕐 {ev.event_time}</p>}
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    <button onClick={() => toggleShare(ev)}
                      style={{ padding: "3px 8px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: "0.68rem", fontWeight: 700, fontFamily: "inherit",
                        background: ev.is_shared ? "linear-gradient(135deg, #10b981, #14b8a6)" : (darkMode ? "#334155" : "#e2e8f0"),
                        color: ev.is_shared ? "#fff" : textSecondary }}>
                      {ev.is_shared ? "👥 Shared" : "Share"}
                    </button>
                    <button onClick={() => openEditForm(ev)}
                      style={{ padding: "3px 8px", borderRadius: 6, border: `1px solid ${borderColor}`, cursor: "pointer", fontSize: "0.68rem", fontWeight: 600, background: "transparent", color: textSecondary, fontFamily: "inherit" }}>
                      Edit
                    </button>
                    <button onClick={() => handleDelete(ev.id)}
                      style={{ padding: "3px 8px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: "0.68rem", fontWeight: 600, background: "#fee2e2", color: "#dc2626", fontFamily: "inherit" }}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ background: darkMode ? "rgba(15,23,42,0.5)" : "#f8fafc", borderRadius: 14, padding: "0.9rem" }}>
              <p style={{ fontSize: "0.75rem", color: textSecondary, margin: 0 }}>Click a date to view or add events.</p>
            </div>
          )}

          {/* Upcoming */}
          <div style={{ background: darkMode ? "rgba(15,23,42,0.5)" : "#f8fafc", borderRadius: 14, padding: "0.9rem", flex: 1 }}>
            <p style={{ fontSize: "0.72rem", fontWeight: 700, color: textSecondary, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Upcoming {loading && "…"}
            </p>
            {upcoming.length === 0 ? (
              <p style={{ fontSize: "0.78rem", color: textSecondary, margin: 0 }}>No upcoming events.</p>
            ) : upcoming.map((ev) => (
              <div key={ev.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: `1px solid ${borderColor}`, cursor: "pointer" }}
                onClick={() => { const d = parseDate(ev.event_date); setCurrentDate(new Date(d.getFullYear(), d.getMonth(), 1)); setSelectedDate(d); }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = "0.75"}
                onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: ev.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, color: textPrimary, fontSize: "0.78rem", margin: "0 0 1px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.title}</p>
                  <p style={{ fontSize: "0.68rem", color: textSecondary, margin: 0 }}>
                    {new Date(ev.event_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    {ev.event_time ? ` · ${ev.event_time}` : ""}
                  </p>
                </div>
                {ev.is_shared && <span style={{ fontSize: "0.6rem", background: "rgba(16,185,129,0.12)", color: "#059669", borderRadius: 99, padding: "1px 6px", fontWeight: 700, flexShrink: 0 }}>Shared</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal – rendered via portal so parent overflow/transform can't clip it */}
      {showForm && createPortal(
        <div
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.45)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}
        >
          <div style={{
            background: darkMode ? "#1e293b" : "#fff",
            borderRadius: 20,
            padding: "1.5rem",
            width: 400,
            maxWidth: "90vw",
            maxHeight: "85vh",
            overflowY: "auto",
            boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
            position: "relative",
          }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: textPrimary, marginBottom: "1rem" }}>
              {editingEvent ? "Edit Event" : "New Event"}
            </h3>
            {error && <div style={{ background: "#fee2e2", color: "#dc2626", borderRadius: 8, padding: "6px 12px", fontSize: "0.8rem", marginBottom: 10 }}>{error}</div>}

            <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: textSecondary, marginBottom: 5 }}>Title *</label>
            <input value={fTitle} onChange={e => setFTitle(e.target.value)} placeholder="e.g. Midterm Exam"
              style={{ width: "100%", padding: "9px 11px", borderRadius: 9, border: `1px solid ${borderColor}`, outline: "none", fontSize: "0.88rem", fontFamily: "inherit", background: darkMode ? "#0f172a" : "#f9fafb", color: textPrimary, boxSizing: "border-box", marginBottom: 10 }} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: textSecondary, marginBottom: 5 }}>Date *</label>
                <input type="date" value={fDate} onChange={e => setFDate(e.target.value)}
                  style={{ width: "100%", padding: "9px 11px", borderRadius: 9, border: `1px solid ${borderColor}`, outline: "none", fontSize: "0.85rem", fontFamily: "inherit", background: darkMode ? "#0f172a" : "#f9fafb", color: textPrimary, boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: textSecondary, marginBottom: 5 }}>Time</label>
                <input value={fTime} onChange={e => setFTime(e.target.value)} placeholder="10:00-12:00"
                  style={{ width: "100%", padding: "9px 11px", borderRadius: 9, border: `1px solid ${borderColor}`, outline: "none", fontSize: "0.85rem", fontFamily: "inherit", background: darkMode ? "#0f172a" : "#f9fafb", color: textPrimary, boxSizing: "border-box" }} />
              </div>
            </div>

            <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: textSecondary, marginBottom: 5 }}>Description</label>
            <textarea value={fDesc} onChange={e => setFDesc(e.target.value)} placeholder="Details…" rows={2}
              style={{ width: "100%", padding: "9px 11px", borderRadius: 9, border: `1px solid ${borderColor}`, outline: "none", fontSize: "0.85rem", fontFamily: "inherit", background: darkMode ? "#0f172a" : "#f9fafb", color: textPrimary, boxSizing: "border-box", resize: "vertical", marginBottom: 10 }} />

            <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: textSecondary, marginBottom: 7 }}>Color</label>
            <div style={{ display: "flex", gap: 7, marginBottom: 12 }}>
              {COLORS.map(c => (
                <button key={c.value} onClick={() => setFColor(c.value)} title={c.label}
                  style={{ width: 24, height: 24, borderRadius: "50%", background: c.value, border: fColor === c.value ? "3px solid #0f172a" : "2px solid transparent", cursor: "pointer", outline: "none" }} />
              ))}
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: "1rem" }}>
              <div onClick={() => setFShared(!fShared)}
                style={{ width: 40, height: 22, borderRadius: 99, background: fShared ? "linear-gradient(135deg, #10b981, #14b8a6)" : (darkMode ? "#334155" : "#e2e8f0"), position: "relative", transition: "background 0.2s", cursor: "pointer", flexShrink: 0 }}>
                <div style={{ position: "absolute", top: 2, left: fShared ? 20 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }} />
              </div>
              <span style={{ fontSize: "0.82rem", fontWeight: 600, color: textPrimary }}>Share with students</span>
            </label>
            {fShared && <p style={{ fontSize: "0.75rem", color: "#10b981", marginTop: -8, marginBottom: 12 }}>✓ Visible in student calendar.</p>}

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setShowForm(false); setError(""); }} disabled={saving}
                style={{ flex: 1, padding: "9px", borderRadius: 11, border: `1px solid ${borderColor}`, background: "transparent", cursor: "pointer", fontSize: "0.88rem", fontWeight: 600, color: textSecondary, fontFamily: "inherit" }}>
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                style={{ flex: 2, padding: "9px", borderRadius: 11, border: "none", background: "linear-gradient(135deg, #f97316, #ec4899)", color: "#fff", cursor: "pointer", fontSize: "0.88rem", fontWeight: 700, fontFamily: "inherit" }}>
                {saving ? "Saving…" : editingEvent ? "Save Changes" : "Create Event"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}