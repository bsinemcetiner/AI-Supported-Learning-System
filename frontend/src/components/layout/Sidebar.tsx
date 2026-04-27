import { useState, useEffect, useRef } from "react";
import type { User, ChatMap, TeachingMode, TeachingTone } from "../../types";

interface SidebarProps {

  user: User;
  chatMap: ChatMap;
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
  onLogout: () => void;
  onOpenSettings: () => void;
  teachingMode: TeachingMode;
  teachingTone: TeachingTone;
  onModeChange: (m: TeachingMode) => void;
  onToneChange: (t: TeachingTone) => void;
}

interface NotificationItem {
  id: number;
  course_id: string;
  title: string;
  message: string;
  type: string;
  created_at: string;
  created_by: string;
  is_read: boolean;
}

const TONES: TeachingTone[] = [
  "Professional Tutor","Friendly Mentor","Simplified Explainer",
  "Encouraging Coach","Funny YouTuber","Deep Scientist","Simplified (for kids)",
];

const MODES: { value: TeachingMode; label: string }[] = [
  { value: "direct",     label: "📖 Direct Explanation" },
  { value: "hint_first", label: "💡 Hint First" },
  { value: "socratic",   label: "🧑‍🏫 Socratic Tutor" },
  { value: "quiz_me",    label: "📝 Quiz Me" },
];

const API = "http://127.0.0.1:8011/api";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function typeIcon(type: string) {
  if (type === "new_lesson") return "📚";
  if (type === "announcement") return "📣";
  return "🔔";
}

export default function Sidebar({
  user, chatMap, activeChatId,
  onSelectChat, onNewChat, onDeleteChat,
  onLogout, onOpenSettings,
  teachingMode, teachingTone, onModeChange, onToneChange,
}: SidebarProps) {
  const [search, setSearch] = useState("");
  const [hoveredChat, setHoveredChat] = useState<string | null>(null);
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);


 // ── Notifications state ───────────────────────────────────────────────
const [notifications, setNotifications] = useState<NotificationItem[]>([]);
const [showNotifications, setShowNotifications] = useState(false);
const notifRef = useRef<HTMLDivElement>(null);

const currentCourseId =
  activeChatId && chatMap[activeChatId]?.course_id
    ? chatMap[activeChatId].course_id
    : null;

const visibleNotifications = currentCourseId
  ? notifications.filter((n) => n.course_id === currentCourseId)
  : [];

const unreadCount = visibleNotifications.filter((n) => !n.is_read).length;
useEffect(() => {
  fetchNotifications();
  const interval = setInterval(fetchNotifications, 30000);
  return () => clearInterval(interval);
}, []);

useEffect(() => {
  function handleClick(e: MouseEvent) {
    if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
      setShowNotifications(false);
    }
  }

  document.addEventListener("mousedown", handleClick);
  return () => document.removeEventListener("mousedown", handleClick);
}, []);

async function fetchNotifications() {
  try {
    const token = localStorage.getItem("token");

    const res = await fetch(`${API}/notifications/`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) return;

    const data = await res.json();

    setNotifications(data.notifications || []);
  } catch (err) {
    console.error("Notifications could not be fetched:", err);
  }
}

async function markRead(id: number) {
  try {
    const token = localStorage.getItem("token");

    await fetch(`${API}/notifications/${id}/read`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
  } catch (err) {
    console.error("Notification could not be marked as read:", err);
  }
}

async function markAllRead() {
  try {
    const unreadVisible = visibleNotifications.filter((n) => !n.is_read);

    await Promise.all(unreadVisible.map((n) => markRead(n.id)));
  } catch (err) {
    console.error("Notifications could not be marked as read:", err);
  }
}
// ─────────────────────────────────────────────────────────────────────

  const filteredChats = Object.entries(chatMap)
    .filter(([, c]) => !search || c.title?.toLowerCase().includes(search.toLowerCase()))
    .sort(([a], [b]) => b.localeCompare(a));

  const selectStyle: React.CSSProperties = {
    width: "100%", padding: "10px 36px 10px 14px",
    border: "1.5px solid #e2e8f0", borderRadius: 12,
    fontSize: "0.85rem", fontFamily: "inherit", color: "#374151",
    background: "#fff", outline: "none", cursor: "pointer",
    appearance: "none", transition: "border-color 0.15s",
  };

  return (
    <aside style={{
      width: 256, minWidth: 256, height: "100vh",
      background: "#fff", borderRight: "1px solid #f1f5f9",
      display: "flex", flexDirection: "column",
      position: "fixed", left: 0, top: 0, zIndex: 20,
      boxShadow: "4px 0 24px rgba(148,163,184,0.15)",
      fontFamily: "inherit", overflowY: "auto",
    }}>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #fff7ed, #fdf2f8)", padding: "1.5rem", borderBottom: "1px solid #fed7aa" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 52, height: 52, background: "#fff", borderRadius: 18, boxShadow: "0 4px 14px rgba(249,115,22,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
              <path d="M6 12v5c3 3 9 3 12 0v-5"/>
            </svg>
          </div>
          <div>
            <h1 style={{ fontWeight: 800, color: "#f97316", fontSize: "1.25rem", letterSpacing: "-0.02em", margin: 0, lineHeight: 1.1 }}>LASSIE</h1>
            <p style={{ fontSize: "0.78rem", color: "rgba(249,115,22,0.7)", margin: 0, marginTop: 2 }}>Learning Assistant</p>
          </div>
        </div>
      </div>

      {/* User + Notification Bell */}
      <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #f1f5f9" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, background: "linear-gradient(135deg, #3b82f6, #06b6d4)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 4px 12px rgba(59,130,246,0.3)" }}>
            <span style={{ color: "#fff", fontWeight: 600, fontSize: "1.1rem" }}>
              {(user.full_name?.[0] ?? user.username[0]).toUpperCase()}
            </span>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 600, color: "#1e293b", fontSize: "0.9rem", margin: 0 }}>{user.username}</p>
            <p style={{ fontSize: "0.75rem", color: "#94a3b8", margin: 0, marginTop: 1 }}>Student</p>
          </div>

          {/* Bell button */}
          <div ref={notifRef} style={{ position: "relative" }}>
            <button
              onClick={() => setShowNotifications((v) => !v)}
              style={{
                width: 36, height: 36, borderRadius: 12,
                border: "1.5px solid #e2e8f0",
                background: showNotifications ? "linear-gradient(135deg,#f97316,#ec4899)" : "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", position: "relative", flexShrink: 0,
                transition: "all 0.2s",
              }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                stroke={showNotifications ? "#fff" : "#64748b"}
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              {unreadCount > 0 && (
                <div style={{
                  position: "absolute", top: -5, right: -5,
                  width: 18, height: 18, borderRadius: "50%",
                  background: "linear-gradient(135deg,#f97316,#ec4899)",
                  color: "#fff", fontSize: "0.6rem", fontWeight: 800,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: "2px solid #fff",
                }}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </div>
              )}
            </button>

            {/* Dropdown */}
            {showNotifications && (
              <div style={{
                position: "absolute", top: 44, right: -8,
                width: 320, background: "#fff",
                borderRadius: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
                border: "1px solid #f1f5f9", zIndex: 100,
                overflow: "hidden",
              }}>
                {/* Dropdown header */}
                <div style={{ padding: "14px 16px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9" }}>
                  <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#111827" }}>
                    Notifications
                    {unreadCount > 0 && (
                      <span style={{ marginLeft: 8, background: "linear-gradient(135deg,#f97316,#ec4899)", color: "#fff", fontSize: "0.65rem", fontWeight: 800, padding: "2px 7px", borderRadius: 99 }}>
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} style={{ fontSize: "0.72rem", color: "#f97316", fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                      Mark all read
                    </button>
                  )}
                </div>

                {/* List */}
                <div style={{ maxHeight: 360, overflowY: "auto" }}>
              {visibleNotifications.length === 0 ? (
                    <div style={{ padding: "2rem 1rem", textAlign: "center", color: "#9ca3af", fontSize: "0.85rem" }}>
                      <div style={{ fontSize: "2rem", marginBottom: 8 }}>🔔</div>
                      No notifications yet
                    </div>
                ) : visibleNotifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => !n.is_read && markRead(n.id)}
                      style={{
                        padding: "12px 16px",
                        borderBottom: "1px solid #f9fafb",
                        background: n.is_read ? "#fff" : "linear-gradient(135deg,rgba(249,115,22,0.04),rgba(236,72,153,0.02))",
                        cursor: n.is_read ? "default" : "pointer",
                        display: "flex", gap: 12, alignItems: "flex-start",
                        transition: "background 0.15s",
                      }}
                    >
                      <div style={{
                        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                        background: n.is_read ? "#f3f4f6" : "linear-gradient(135deg,#fff7ed,#fdf2f8)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "1.1rem",
                        border: n.is_read ? "1px solid #e5e7eb" : "1px solid #fed7aa",
                      }}>
                        {typeIcon(n.type)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                          <p style={{ fontWeight: n.is_read ? 500 : 700, fontSize: "0.82rem", color: "#111827", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {n.title}
                          </p>
                          {!n.is_read && (
                            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#f97316", flexShrink: 0 }} />
                          )}
                        </div>
                        <p style={{ fontSize: "0.75rem", color: "#6b7280", margin: 0, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {n.message}
                        </p>
                        <p style={{ fontSize: "0.68rem", color: "#9ca3af", margin: "4px 0 0", fontWeight: 500 }}>
                          {n.course_id.split("::")[1] ?? n.course_id} · {timeAgo(n.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Nav */}
      <div style={{ padding: "1rem", borderBottom: "1px solid #f1f5f9" }}>
        {[
          { id: "dashboard", label: "Dashboard", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>, onClick: onNewChat },
          { id: "browse", label: "Browse", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>, onClick: onNewChat },
        ].map((item) => {
          const active = item.id === "dashboard";
          return (
            <button key={item.id} onClick={item.onClick}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 14, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "0.9rem", fontWeight: active ? 600 : 500, transition: "all 0.2s", marginBottom: 4, background: active ? "linear-gradient(135deg, #f97316, #ec4899)" : hoveredBtn === item.id ? "#f8fafc" : "transparent", color: active ? "#fff" : "#64748b", boxShadow: active ? "0 4px 14px rgba(249,115,22,0.35)" : "none", textAlign: "left" }}
              onMouseEnter={() => setHoveredBtn(item.id)}
              onMouseLeave={() => setHoveredBtn(null)}>
              {item.icon}
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Teaching Preferences */}
      <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #f1f5f9" }}>
        <p style={{ fontSize: "0.65rem", fontWeight: 700, color: "#94a3b8", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>Teaching Preferences</p>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 500, color: "#374151", marginBottom: 6 }}>Tone</label>
          <div style={{ position: "relative" }}>
            <select value={teachingTone} onChange={(e) => onToneChange(e.target.value as TeachingTone)} style={selectStyle}
              onFocus={(e) => e.target.style.borderColor = "#f97316"}
              onBlur={(e) => e.target.style.borderColor = "#e2e8f0"}>
              {TONES.map((t) => <option key={t}>{t}</option>)}
            </select>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>
        <div>
          <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 500, color: "#374151", marginBottom: 6 }}>Teaching Mode</label>
          <div style={{ position: "relative" }}>
            <select value={teachingMode} onChange={(e) => onModeChange(e.target.value as TeachingMode)} style={selectStyle}
              onFocus={(e) => e.target.style.borderColor = "#f97316"}
              onBlur={(e) => e.target.style.borderColor = "#e2e8f0"}>
              {MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>
      </div>

      {/* Recent Chats */}
      <div style={{ padding: "1rem 1.25rem", flex: 1 }}>
        <p style={{ fontSize: "0.65rem", fontWeight: 700, color: "#94a3b8", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>Recent Chats</p>
        <div style={{ position: "relative", marginBottom: 10 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input placeholder="Search chats..." value={search} onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", padding: "9px 12px 9px 32px", background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 12, fontSize: "0.82rem", fontFamily: "inherit", color: "#374151", outline: "none", boxSizing: "border-box" as const, transition: "border-color 0.15s" }}
            onFocus={(e) => e.target.style.borderColor = "#f97316"}
            onBlur={(e) => e.target.style.borderColor = "#e2e8f0"}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filteredChats.length === 0 ? (
            <p style={{ color: "#94a3b8", fontSize: "0.78rem", textAlign: "center", padding: "1rem 0" }}>
              {Object.keys(chatMap).length === 0 ? "No chats yet ✨" : "No chats found."}
            </p>
          ) : filteredChats.map(([id, chat]) => {
            const isActive = id === activeChatId;
            const isHovered = hoveredChat === id;
            const title = chat.title?.length > 24 ? chat.title.slice(0, 24) + "…" : chat.title ?? "Chat";
            const courseLabel = chat.course_id ? chat.course_id.split("::")[1] ?? "" : "";
            return (
              <div key={id}
                style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", background: isActive ? "linear-gradient(135deg, rgba(249,115,22,0.06), rgba(236,72,153,0.04))" : isHovered ? "linear-gradient(135deg, rgba(249,115,22,0.04), rgba(236,72,153,0.02))" : "linear-gradient(135deg, rgba(249,115,22,0.03), rgba(236,72,153,0.01))", borderRadius: 14, border: `1.5px solid ${isActive ? "#fed7aa" : isHovered ? "#fde8d0" : "rgba(249,115,22,0.1)"}`, cursor: "pointer", transition: "all 0.15s" }}
                onClick={() => onSelectChat(id)}
                onMouseEnter={() => setHoveredChat(id)}
                onMouseLeave={() => setHoveredChat(null)}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2, opacity: 0.7 }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, color: "#1e293b", fontSize: "0.82rem", margin: "0 0 2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</p>
                  {courseLabel && <p style={{ fontSize: "0.7rem", color: "#94a3b8", margin: "0 0 4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{courseLabel}</p>}
                  <span style={{ display: "inline-block", padding: "1px 7px", background: "#dbeafe", color: "#2563eb", fontSize: "0.65rem", borderRadius: 99, fontWeight: 600 }}>{chat.mode ?? "direct"}</span>
                </div>
                {(isHovered || isActive) && (
                  <button onClick={(e) => { e.stopPropagation(); onDeleteChat(id); }}
                    style={{ width: 22, height: 22, borderRadius: 7, border: "none", background: "transparent", color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "0.75rem", marginTop: 1 }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "#ef4444"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "#94a3b8"; }}>
                    ✕
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: "0.75rem 1rem", borderTop: "1px solid #f1f5f9" }}>
        <button onClick={onOpenSettings}
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 12, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "0.88rem", fontWeight: 500, color: "#64748b", background: "transparent", textAlign: "left", marginBottom: 2, transition: "background 0.15s" }}
          onMouseEnter={(e) => e.currentTarget.style.background = "#f8fafc"}
          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          Settings
        </button>
        <button onClick={onLogout}
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 12, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "0.88rem", fontWeight: 600, color: "#ef4444", background: "transparent", textAlign: "left", transition: "background 0.15s" }}
          onMouseEnter={(e) => e.currentTarget.style.background = "#fef2f2"}
          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Logout
        </button>
      </div>
    </aside>
  );
}