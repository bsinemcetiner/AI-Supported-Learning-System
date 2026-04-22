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
  "Professional Tutor",
  "Friendly Mentor",
  "Simplified Explainer",
  "Encouraging Coach",
  "Funny YouTuber",
  "Deep Scientist",
  "Simplified (for kids)",
];

const MODES: { value: TeachingMode; label: string }[] = [
  { value: "direct", label: "📖 Direct Explanation" },
  { value: "hint_first", label: "💡 Hint First" },
  { value: "socratic", label: "🤔 Socratic Tutor" },
  { value: "quiz_me", label: "📝 Quiz Me" },
];

export default function Sidebar({
  user,
  chatMap,
  activeChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onLogout,
  onOpenSettings,
  teachingMode,
  teachingTone,
  onModeChange,
  onToneChange,
}: SidebarProps) {
  const [search, setSearch] = useState("");

  const filteredChats = Object.entries(chatMap)
    .filter(([, c]) => !search || c.title.toLowerCase().includes(search.toLowerCase()))
    .sort(([a], [b]) => b.localeCompare(a));

  return (
    <aside className="sidebar">
      <div
        style={{
          background: "var(--orange-lt)",
          borderRadius: 14,
          padding: "1rem 1.1rem",
          border: "1px solid var(--orange-md)",
          marginBottom: "0.25rem",
        }}
      >
        <div
          style={{
            fontFamily: "'Fraunces', serif",
            fontWeight: 600,
            fontSize: "1.05rem",
          }}
        >
          🎓 Learning Assistant
        </div>
        <div style={{ fontSize: "0.8rem", color: "var(--text-soft)", marginTop: 4 }}>
          {user.full_name} ·{" "}
          <span style={{ color: "var(--orange)", fontWeight: 600 }}>{user.role}</span>
        </div>
      </div>

      {user.role === "student" && (
        <>
          <div className="divider" />
          <p className="section-label">Navigation</p>

          <button
            className="btn btn-ghost"
            style={{ width: "100%", marginBottom: 10 }}
            onClick={onNewChat}
          >
            🏠 Home Page
          </button>
        </>
      )}

      <div className="divider" />

      {user.role === "student" && (
        <>
          <p className="section-label">Teaching Preferences</p>

          <label className="label">Tone</label>
          <select
            className="select"
            value={teachingTone}
            onChange={(e) => onToneChange(e.target.value as TeachingTone)}
          >
            {TONES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>

          <label className="label" style={{ marginTop: 10 }}>
            Teaching Mode
          </label>
          <select
            className="select"
            value={teachingMode}
            onChange={(e) => onModeChange(e.target.value as TeachingMode)}
          >
            {MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>

          <div className="divider" />
          <p className="section-label" style={{ marginTop: 4 }}>
            Your Chats
          </p>

          <input
            className="input"
            placeholder="🔍 Search chats..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ marginBottom: 8 }}
          />

          {filteredChats.length === 0 ? (
            <p
              style={{
                color: "var(--text-soft)",
                fontSize: "0.82rem",
                textAlign: "center",
                padding: "0.5rem 0",
              }}
            >
              {Object.keys(chatMap).length === 0
                ? "No chats yet — start learning! ✨"
                : "No chats found."}
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {filteredChats.map(([id, chat]) => {
                const title =
                  chat.title.length > 26 ? chat.title.slice(0, 26) + "…" : chat.title;
                const isActive = id === activeChatId;

                return (
                  <div key={id} style={{ display: "flex", gap: 4 }}>
                    <button
                      onClick={() => onSelectChat(id)}
                      style={{
                        flex: 1,
                        textAlign: "left",
                        padding: "0.45rem 0.7rem",
                        borderRadius: "var(--r-sm)",
                        border: "1.5px solid",
                        borderColor: isActive ? "var(--orange-md)" : "var(--line)",
                        background: isActive ? "var(--orange-lt)" : "var(--bg2)",
                        color: isActive ? "var(--orange)" : "var(--text-mid)",
                        fontWeight: 600,
                        fontSize: "0.82rem",
                        cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                    >
                      💬 {title}
                    </button>

                    <button
                      onClick={() => onDeleteChat(id)}
                      style={{
                        padding: "0 0.5rem",
                        borderRadius: "var(--r-sm)",
                        border: "1.5px solid var(--line)",
                        background: "var(--bg2)",
                        color: "var(--text-soft)",
                        cursor: "pointer",
                        fontSize: "0.8rem",
                      }}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {user.role === "teacher" && (
        <div className="alert alert-info" style={{ fontSize: "0.85rem" }}>
          Teacher dashboard is active.
        </div>
      )}

      <div style={{ flex: 1 }} />
      <div className="divider" />

      <button
        className="btn btn-ghost"
        style={{ width: "100%", marginBottom: 8 }}
        onClick={onOpenSettings}
      >
        ⚙ Settings
      </button>

      <button className="btn btn-ghost" style={{ width: "100%" }} onClick={onLogout}>
        🚪 Logout
      </button>
    </aside>
  );
}