import { useState, useEffect } from "react";
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

export default function StudentCalendar({ darkMode = false }: { darkMode?: boolean }) {
  const dm = darkMode;
  const cardBg      = dm ? "rgba(30,41,59,0.95)" : "#fff";
  const cardBorder  = dm ? "#1e293b" : "#e2e8f0";
  const cardShadow  = dm ? "0 2px 12px rgba(0,0,0,0.4)" : "0 2px 12px rgba(0,0,0,0.06)";
  const tp          = dm ? "#f1f5f9" : "#0f172a";   // text primary
  const ts          = dm ? "#94a3b8" : "#64748b";   // text secondary
  const tm          = dm ? "#64748b" : "#94a3b8";   // text muted
  const inputBg     = dm ? "#0f172a" : "#f9fafb";
  const inputBorder = dm ? "#334155" : "#e2e8f0";
  const subBg       = dm ? "rgba(15,23,42,0.6)" : "#f8fafc";
  const dividerBg   = dm ? "#1e293b" : "#f1f5f9";

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [sharedEvents, setSharedEvents] = useState<CalendarEvent[]>([]);
  const [myEvents, setMyEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const [fTitle, setFTitle] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fDate, setFDate] = useState("");
  const [fTime, setFTime] = useState("");
  const [fColor, setFColor] = useState("#3b82f6");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadEvents() {
    setLoading(true);
    try {
      const [shared, personal] = await Promise.all([eventsApi.getShared(), eventsApi.getMyPersonal()]);
      setSharedEvents(shared);
      setMyEvents(personal);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadEvents(); }, []);

  function openCreateForm(date?: Date) {
    setEditingEvent(null);
    setFTitle(""); setFDesc(""); setFTime(""); setFColor("#3b82f6");
    setFDate(date ? dateStr(date) : "");
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openEditForm(ev: CalendarEvent) {
    setEditingEvent(ev);
    setFTitle(ev.title); setFDesc(ev.description);
    setFDate(ev.event_date); setFTime(ev.event_time); setFColor(ev.color);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSave() {
    if (!fTitle.trim() || !fDate) { setError("Title and date are required."); return; }
    setSaving(true); setError("");
    try {
      if (editingEvent) {
        await eventsApi.updatePersonal(editingEvent.id, { title: fTitle, description: fDesc, event_date: fDate, event_time: fTime, color: fColor });
      } else {
        await eventsApi.createPersonal({ title: fTitle, description: fDesc, event_date: fDate, event_time: fTime, color: fColor });
      }
      setShowForm(false); setEditingEvent(null);
      await loadEvents();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Delete this event?")) return;
    try { await eventsApi.deletePersonal(id); await loadEvents(); }
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

  function getSharedForDay(day: number) { const ds = `${curMonthStr}-${String(day).padStart(2, "0")}`; return sharedEvents.filter(e => e.event_date === ds); }
  function getMyForDay(day: number) { const ds = `${curMonthStr}-${String(day).padStart(2, "0")}`; return myEvents.filter(e => e.event_date === ds); }

  const selectedShared = selectedDate ? getSharedForDay(selectedDate.getDate()) : [];
  const selectedMine   = selectedDate ? getMyForDay(selectedDate.getDate()) : [];

  const allUpcoming = [...sharedEvents, ...myEvents]
    .filter(e => e.event_date >= dateStr(new Date()))
    .sort((a, b) => a.event_date.localeCompare(b.event_date))
    .slice(0, 8);

  const cells: JSX.Element[] = [];
  for (let i = 0; i < firstDay(currentDate); i++) cells.push(<div key={`e${i}`} />);
  for (let day = 1; day <= daysInMonth(currentDate); day++) {
    const todayFlag = isToday(day);
    const shared = getSharedForDay(day);
    const mine   = getMyForDay(day);
    const hasAny = shared.length > 0 || mine.length > 0;
    const ds = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    cells.push(
      <button key={day} onClick={() => setSelectedDate(ds)}
        style={{ height: 36, borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "0.8rem", fontWeight: 600, position: "relative", transition: "all 0.15s",
          background: todayFlag ? "linear-gradient(135deg, #f97316, #ec4899)" : hasAny ? (dm ? "rgba(59,130,246,0.2)" : "#eff6ff") : "transparent",
          color: todayFlag ? "#fff" : hasAny ? "#3b82f6" : tp,
          boxShadow: todayFlag ? "0 3px 10px rgba(249,115,22,0.35)" : "none" }}
        onMouseEnter={(e) => { if (!todayFlag) e.currentTarget.style.background = dm ? "rgba(255,255,255,0.08)" : "#f1f5f9"; }}
        onMouseLeave={(e) => { if (!todayFlag) e.currentTarget.style.background = hasAny ? (dm ? "rgba(59,130,246,0.2)" : "#eff6ff") : "transparent"; }}>
        {day}
        {hasAny && (
          <div style={{ position: "absolute", bottom: 2, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 2 }}>
            {[...shared, ...mine].slice(0, 3).map((ev, i) => (
              <div key={i} style={{ width: 4, height: 4, borderRadius: "50%", background: ev.color }} />
            ))}
          </div>
        )}
      </button>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: "1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: "2rem", fontWeight: 800, margin: "0 0 4px", letterSpacing: "-0.02em" }}>
            <span style={{ background: "linear-gradient(135deg, #f97316, #ec4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>My Calendar</span>
          </h1>
          <p style={{ fontSize: "0.85rem", color: ts, margin: 0 }}>Your personal events + events shared by teachers.</p>
        </div>
        <button onClick={() => openCreateForm()}
          style={{ padding: "9px 18px", borderRadius: 12, background: "linear-gradient(135deg, #f97316, #ec4899)", color: "#fff", border: "none", cursor: "pointer", fontSize: "0.88rem", fontWeight: 700, fontFamily: "inherit", boxShadow: "0 4px 14px rgba(249,115,22,0.3)" }}>
          + New Event
        </button>
      </div>

      {error && (
        <div style={{ background: "#fee2e2", color: "#dc2626", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: "0.84rem" }}>
          {error} <button onClick={() => setError("")} style={{ marginLeft: 8, background: "none", border: "none", cursor: "pointer", color: "#dc2626" }}>✕</button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20, alignItems: "start" }}>

        {/* LEFT: calendar */}
        <div style={{ background: cardBg, borderRadius: 20, border: `1px solid ${cardBorder}`, boxShadow: cardShadow, padding: "1.25rem", transition: "background 0.2s" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
            <span style={{ fontWeight: 800, fontSize: "1rem", color: tp }}>{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}
                style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${cardBorder}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ts} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}
                style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${cardBorder}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ts} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 4 }}>
            {dayNames.map(d => <div key={d} style={{ textAlign: "center", fontSize: "0.68rem", fontWeight: 700, color: tm, padding: "3px 0" }}>{d}</div>)}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: "1rem" }}>{cells}</div>

          {/* Selected day */}
          {selectedDate && (
            <div style={{ borderTop: `1px solid ${cardBorder}`, paddingTop: "0.9rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <p style={{ fontSize: "0.78rem", fontWeight: 700, color: ts, margin: 0 }}>
                  {selectedDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                </p>
                <button onClick={() => openCreateForm(selectedDate)}
                  style={{ fontSize: "0.72rem", fontWeight: 700, color: "#f97316", background: "none", border: "none", cursor: "pointer" }}>+ Add</button>
              </div>

              {selectedShared.map(ev => (
                <div key={ev.id} style={{ padding: "8px 10px", borderRadius: 10, marginBottom: 5, borderLeft: `3px solid ${ev.color}`, background: dm ? "rgba(16,185,129,0.08)" : "#f0fdf4" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: "0.6rem", background: "rgba(16,185,129,0.15)", color: "#059669", borderRadius: 99, padding: "1px 6px", fontWeight: 700 }}>Teacher</span>
                    <p style={{ fontWeight: 600, color: tp, fontSize: "0.8rem", margin: 0 }}>{ev.title}</p>
                  </div>
                  {ev.event_time && <p style={{ fontSize: "0.7rem", color: ts, margin: 0 }}>🕐 {ev.event_time}</p>}
                  {ev.description && <p style={{ fontSize: "0.7rem", color: ts, margin: "2px 0 0" }}>{ev.description}</p>}
                </div>
              ))}

              {selectedMine.map(ev => (
                <div key={ev.id} style={{ padding: "8px 10px", borderRadius: 10, marginBottom: 5, borderLeft: `3px solid ${ev.color}`, background: subBg }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: "0.6rem", background: dm ? "rgba(59,130,246,0.2)" : "#eff6ff", color: "#3b82f6", borderRadius: 99, padding: "1px 6px", fontWeight: 700 }}>Mine</span>
                      <p style={{ fontWeight: 600, color: tp, fontSize: "0.8rem", margin: 0 }}>{ev.title}</p>
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => openEditForm(ev)} style={{ padding: "2px 7px", borderRadius: 6, border: `1px solid ${cardBorder}`, cursor: "pointer", fontSize: "0.65rem", fontWeight: 600, background: "transparent", color: ts, fontFamily: "inherit" }}>Edit</button>
                      <button onClick={() => handleDelete(ev.id)} style={{ padding: "2px 7px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: "0.65rem", fontWeight: 600, background: "#fee2e2", color: "#dc2626", fontFamily: "inherit" }}>Delete</button>
                    </div>
                  </div>
                  {ev.event_time && <p style={{ fontSize: "0.7rem", color: ts, margin: 0 }}>🕐 {ev.event_time}</p>}
                  {ev.description && <p style={{ fontSize: "0.7rem", color: ts, margin: "2px 0 0" }}>{ev.description}</p>}
                </div>
              ))}

              {selectedShared.length === 0 && selectedMine.length === 0 && (
                <p style={{ fontSize: "0.78rem", color: tm, margin: 0 }}>No events. Click + Add to create one.</p>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: upcoming */}
        <div style={{ background: cardBg, borderRadius: 20, border: `1px solid ${cardBorder}`, boxShadow: cardShadow, padding: "1.25rem", transition: "background 0.2s" }}>
          <p style={{ fontSize: "0.72rem", fontWeight: 700, color: tm, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
            Upcoming {loading && "…"}
          </p>
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }} />
              <span style={{ fontSize: "0.68rem", color: ts }}>Teacher</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#3b82f6" }} />
              <span style={{ fontSize: "0.68rem", color: ts }}>Mine</span>
            </div>
          </div>

          {allUpcoming.length === 0 ? (
            <p style={{ fontSize: "0.8rem", color: tm }}>No upcoming events.</p>
          ) : allUpcoming.map(ev => {
            const isTeacher = sharedEvents.some(s => s.id === ev.id);
            return (
              <div key={`${ev.id}-${isTeacher}`}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: `1px solid ${dividerBg}`, cursor: "pointer", transition: "opacity 0.15s" }}
                onClick={() => { const d = parseDate(ev.event_date); setCurrentDate(new Date(d.getFullYear(), d.getMonth(), 1)); setSelectedDate(d); }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = "0.7"}
                onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: isTeacher ? "#10b981" : ev.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, color: tp, fontSize: "0.78rem", margin: "0 0 1px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.title}</p>
                  <p style={{ fontSize: "0.68rem", color: tm, margin: 0 }}>
                    {new Date(ev.event_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    {ev.event_time ? ` · ${ev.event_time}` : ""}
                  </p>
                </div>
                {isTeacher && <span style={{ fontSize: "0.6rem", background: "rgba(16,185,129,0.12)", color: "#059669", borderRadius: 99, padding: "1px 6px", fontWeight: 700, flexShrink: 0 }}>T</span>}
              </div>
            );
          })}

          <div style={{ marginTop: 14, padding: "10px", background: dm ? "rgba(249,115,22,0.08)" : "linear-gradient(135deg, #fff7ed, #fdf2f8)", borderRadius: 12, border: `1px dashed ${dm ? "rgba(249,115,22,0.3)" : "#fdba74"}` }}>
            <p style={{ fontSize: "0.75rem", color: dm ? "#fb923c" : "#92400e", margin: "0 0 3px", fontWeight: 600 }}>My calendar</p>
            <p style={{ fontSize: "0.72rem", color: dm ? "#fb923c" : "#92400e", margin: 0 }}>
              {myEvents.length} personal · {sharedEvents.length} from teachers
            </p>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "60px" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div style={{ background: dm ? "#1e293b" : "#fff", borderRadius: 16, padding: "1.1rem 1.25rem", width: 340, maxWidth: "92vw", boxShadow: "0 16px 48px rgba(0,0,0,0.3)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.9rem" }}>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: tp, margin: 0 }}>{editingEvent ? "Edit Event" : "New Event"}</h3>
              <button onClick={() => { setShowForm(false); setError(""); }}
                style={{ width: 26, height: 26, borderRadius: 8, border: `1px solid ${inputBorder}`, background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: ts, fontSize: "0.85rem" }}>✕</button>
            </div>

            {error && <div style={{ background: "#fee2e2", color: "#dc2626", borderRadius: 7, padding: "5px 10px", fontSize: "0.76rem", marginBottom: 8 }}>{error}</div>}

            <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: ts, marginBottom: 4 }}>Title *</label>
            <input value={fTitle} onChange={e => setFTitle(e.target.value)} placeholder="e.g. Study Session"
              style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: `1px solid ${inputBorder}`, outline: "none", fontSize: "0.84rem", fontFamily: "inherit", background: inputBg, color: tp, boxSizing: "border-box", marginBottom: 8 }} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: ts, marginBottom: 4 }}>Date *</label>
                <input type="date" value={fDate} onChange={e => setFDate(e.target.value)}
                  style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: `1px solid ${inputBorder}`, outline: "none", fontSize: "0.8rem", fontFamily: "inherit", background: inputBg, color: tp, boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: ts, marginBottom: 4 }}>Time</label>
                <input value={fTime} onChange={e => setFTime(e.target.value)} placeholder="10:00-12:00"
                  style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: `1px solid ${inputBorder}`, outline: "none", fontSize: "0.8rem", fontFamily: "inherit", background: inputBg, color: tp, boxSizing: "border-box" }} />
              </div>
            </div>

            <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: ts, marginBottom: 4 }}>Description</label>
            <textarea value={fDesc} onChange={e => setFDesc(e.target.value)} placeholder="Details…" rows={2}
              style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: `1px solid ${inputBorder}`, outline: "none", fontSize: "0.8rem", fontFamily: "inherit", background: inputBg, color: tp, boxSizing: "border-box", resize: "none", marginBottom: 8 }} />

            <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: ts, marginBottom: 6 }}>Color</label>
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              {COLORS.map(c => (
                <button key={c.value} onClick={() => setFColor(c.value)} title={c.label}
                  style={{ width: 20, height: 20, borderRadius: "50%", background: c.value, border: fColor === c.value ? "2.5px solid #f97316" : "2px solid transparent", cursor: "pointer", outline: "none" }} />
              ))}
            </div>

            <div style={{ display: "flex", gap: 7 }}>
              <button onClick={() => { setShowForm(false); setError(""); }} disabled={saving}
                style={{ flex: 1, padding: "8px", borderRadius: 10, border: `1px solid ${inputBorder}`, background: "transparent", cursor: "pointer", fontSize: "0.82rem", fontWeight: 600, color: ts, fontFamily: "inherit" }}>Cancel</button>
              <button onClick={handleSave} disabled={saving}
                style={{ flex: 2, padding: "8px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #f97316, #ec4899)", color: "#fff", cursor: "pointer", fontSize: "0.82rem", fontWeight: 700, fontFamily: "inherit" }}>
                {saving ? "Saving…" : editingEvent ? "Save Changes" : "Create Event"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}