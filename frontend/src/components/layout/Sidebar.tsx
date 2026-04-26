import { useState } from "react";
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

export default function Sidebar({
  user, chatMap, activeChatId,
  onSelectChat, onNewChat, onDeleteChat,
  onLogout, onOpenSettings,
  teachingMode, teachingTone, onModeChange, onToneChange,
}: SidebarProps) {
  const [search, setSearch] = useState("");
  const [hoveredChat, setHoveredChat] = useState<string | null>(null);
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);

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

      {/* User */}
      <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid #f1f5f9" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, background: "linear-gradient(135deg, #3b82f6, #06b6d4)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 4px 12px rgba(59,130,246,0.3)" }}>
            <span style={{ color: "#fff", fontWeight: 600, fontSize: "1.1rem" }}>
              {(user.full_name?.[0] ?? user.username[0]).toUpperCase()}
            </span>
          </div>
          <div>
            <p style={{ fontWeight: 600, color: "#1e293b", fontSize: "0.9rem", margin: 0 }}>{user.username}</p>
            <p style={{ fontSize: "0.75rem", color: "#94a3b8", margin: 0, marginTop: 1 }}>Student</p>
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

