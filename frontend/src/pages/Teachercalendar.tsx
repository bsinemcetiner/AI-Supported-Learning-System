import { useState } from "react";

type CalEvent = {
  id: string;
  title: string;
  date: string; // "YYYY-MM-DD"
  time: string;
  color: string;
};

const COLORS = ["#3b82f6", "#ef4444", "#8b5cf6", "#10b981", "#f59e0b", "#ec4899", "#f97316"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function dateStr(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function fmtDate(ds: string, opts: Intl.DateTimeFormatOptions) {
  return new Date(ds + "T00:00:00").toLocaleDateString("en-GB", opts);
}

export function TeacherCalendar({
  darkMode,
  cardBg,
  textPrimary,
  textSecondary,
  borderColor,
}: {
  darkMode: boolean;
  cardBg: string;
  textPrimary: string;
  textSecondary: string;
  borderColor: string;
}) {
  const today = new Date();
  const todayDs = dateStr(today.getFullYear(), today.getMonth(), today.getDate());

  const [cur, setCur] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [selDate, setSelDate] = useState<string | null>(null);
  const [events, setEvents] = useState<CalEvent[]>([
    { id: "1", title: "CE350 Linux Utilities", date: "2026-04-23", time: "09:00–10:30", color: "#3b82f6" },
    { id: "2", title: "Assignment 2 Deadline", date: "2026-04-25", time: "23:59", color: "#ef4444" },
    { id: "3", title: "Midterm Exam", date: "2026-04-28", time: "10:00–12:00", color: "#8b5cf6" },
  ]);
  const [form, setForm] = useState({ title: "", date: todayDs, time: "", color: COLORS[0] });
  const [showForm, setShowForm] = useState(false);

  const getEventsFor = (ds: string) => events.filter((e) => e.date === ds);

  const upcoming = events
    .filter((e) => e.date >= todayDs)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  const first = new Date(cur.y, cur.m, 1).getDay();
  const total = new Date(cur.y, cur.m + 1, 0).getDate();

  function handleAdd() {
    if (!form.title.trim() || !form.date) return;
    setEvents((prev) => [
      ...prev,
      { id: Date.now().toString(), title: form.title.trim(), date: form.date, time: form.time || "—", color: form.color },
    ]);
    const d = new Date(form.date + "T00:00:00");
    setCur({ y: d.getFullYear(), m: d.getMonth() });
    setSelDate(form.date);
    setForm((f) => ({ ...f, title: "", time: "" }));
    setShowForm(false);
  }

  function handleDelete(id: string) {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }

  const cell: React.CSSProperties = {
    aspectRatio: "1",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    borderRadius: 6,
    fontSize: "0.78rem",
    fontWeight: 500,
    fontFamily: "inherit",
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: textPrimary,
  };

  const sectionLabel: React.CSSProperties = {
    fontSize: "0.65rem",
    fontWeight: 700,
    color: textSecondary,
    textTransform: "uppercase",
    letterSpacing: ".06em",
    marginBottom: 6,
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 16,
        alignItems: "start",
        marginTop: "1.25rem",
      }}
    >
      {/* ── LEFT: Calendar ── */}
      <div
        style={{
          background: cardBg,
          borderRadius: 16,
          border: `1px solid ${borderColor}`,
          padding: "1.25rem",
        }}
      >
        {/* Month nav */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: "1rem", fontWeight: 700, color: textPrimary }}>{MONTHS[cur.m]}</div>
            <div style={{ fontSize: "0.75rem", color: textSecondary }}>{cur.y}</div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {["‹", "›"].map((ch, i) => (
              <button
                key={ch}
                onClick={() => setCur((c) => {
                  let m = c.m + (i === 0 ? -1 : 1);
                  let y = c.y;
                  if (m < 0) { m = 11; y--; }
                  if (m > 11) { m = 0; y++; }
                  return { y, m };
                })}
                style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${borderColor}`, background: "transparent", cursor: "pointer", fontSize: "0.9rem", color: textSecondary, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                {ch}
              </button>
            ))}
          </div>
        </div>

        {/* Day labels */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, marginBottom: 4 }}>
          {DAYS.map((d) => (
            <div key={d} style={{ textAlign: "center", fontSize: "0.7rem", color: textSecondary, padding: "2px 0", fontWeight: 600 }}>{d}</div>
          ))}
        </div>

        {/* Day grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, marginBottom: 12 }}>
          {Array.from({ length: first }).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: total }).map((_, i) => {
            const day = i + 1;
            const ds = dateStr(cur.y, cur.m, day);
            const isToday = ds === todayDs;
            const isSel = ds === selDate && !isToday;
            const hasEv = getEventsFor(ds).length > 0;
            return (
              <button
                key={day}
                onClick={() => setSelDate(ds === selDate ? null : ds)}
                style={{
                  ...cell,
                  background: isToday ? "linear-gradient(135deg,#f97316,#ec4899)" : "transparent",
                  color: isToday ? "#fff" : hasEv ? "#3b82f6" : textPrimary,
                  outline: isSel ? "1.5px solid #f97316" : "none",
                  outlineOffset: -1,
                }}
              >
                {day}
                {hasEv && !isToday && (
                  <span style={{ position: "absolute", bottom: 2, left: "50%", transform: "translateX(-50%)", width: 4, height: 4, borderRadius: "50%", background: "#3b82f6", display: "block" }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Selected day events */}
        {selDate && (
          <div style={{ borderTop: `1px solid ${borderColor}`, paddingTop: 10, marginBottom: 10 }}>
            <div style={sectionLabel}>
              {fmtDate(selDate, { day: "numeric", month: "long" })}
            </div>
            {getEventsFor(selDate).length === 0 ? (
              <div style={{ fontSize: "0.78rem", color: textSecondary }}>No events</div>
            ) : (
              getEventsFor(selDate).map((ev) => (
                <div key={ev.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: ev.color, flexShrink: 0, display: "block" }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: 600, color: textPrimary }}>{ev.title}</div>
                    <div style={{ fontSize: "0.72rem", color: textSecondary }}>{ev.time}</div>
                  </div>
                  <button
                    onClick={() => handleDelete(ev.id)}
                    style={{ background: "transparent", border: "none", cursor: "pointer", color: textSecondary, fontSize: "0.75rem", padding: "0 2px", lineHeight: 1 }}
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Upcoming */}
        <div style={{ borderTop: `1px solid ${borderColor}`, paddingTop: 10 }}>
          <div style={sectionLabel}>Upcoming</div>
          {upcoming.length === 0 ? (
            <div style={{ fontSize: "0.78rem", color: textSecondary }}>No upcoming events</div>
          ) : upcoming.map((ev) => (
            <div key={ev.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: ev.color, flexShrink: 0, display: "block" }} />
              <div>
                <div style={{ fontSize: "0.82rem", fontWeight: 600, color: textPrimary }}>{ev.title}</div>
                <div style={{ fontSize: "0.72rem", color: textSecondary }}>
                  {fmtDate(ev.date, { day: "numeric", month: "short" })} · {ev.time}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT: Add Event ── */}
      <div
        style={{
          background: cardBg,
          borderRadius: 16,
          border: `1px solid ${borderColor}`,
          padding: "1.25rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: "1rem", fontWeight: 700, color: textPrimary }}>Add Event</div>
          <button
            onClick={() => setShowForm((v) => !v)}
            style={{ fontSize: "0.8rem", color: "#f97316", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}
          >
            {showForm ? "Close" : "+ New"}
          </button>
        </div>

        {showForm && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { label: "Title", key: "title", type: "text", placeholder: "Event title" },
              { label: "Date", key: "date", type: "date", placeholder: "" },
              { label: "Time", key: "time", type: "text", placeholder: "09:00–10:30" },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key}>
                <div style={{ fontSize: "0.72rem", color: textSecondary, marginBottom: 4, fontWeight: 600 }}>{label}</div>
                <input
                  type={type}
                  placeholder={placeholder}
                  value={(form as any)[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: `1px solid ${borderColor}`, background: darkMode ? "rgba(255,255,255,0.05)" : "#f9fafb", color: textPrimary, fontFamily: "inherit", fontSize: "0.85rem" }}
                />
              </div>
            ))}

            <div>
              <div style={{ fontSize: "0.72rem", color: textSecondary, marginBottom: 6, fontWeight: 600 }}>Color</div>
              <div style={{ display: "flex", gap: 6 }}>
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                    style={{ width: 22, height: 22, borderRadius: "50%", background: c, border: form.color === c ? "2.5px solid " + textPrimary : "2.5px solid transparent", cursor: "pointer", padding: 0 }}
                  />
                ))}
              </div>
            </div>

            <button
              onClick={handleAdd}
              disabled={!form.title.trim()}
              style={{ padding: "9px", background: "linear-gradient(135deg,#f97316,#ec4899)", color: "#fff", border: "none", borderRadius: 10, fontSize: "0.85rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: form.title.trim() ? 1 : 0.5, marginTop: 4 }}
            >
              Add Event →
            </button>
          </div>
        )}

        {!showForm && (
          <div style={{ fontSize: "0.82rem", color: textSecondary }}>
            Click <strong style={{ color: "#f97316" }}>+ New</strong> to add an event to the calendar.
          </div>
        )}
      </div>
    </div>
  );
}