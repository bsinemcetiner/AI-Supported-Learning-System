import { useState, useEffect } from "react";
import { LassieLogo } from "./components/LassieLogo";
import { token as tokenStore, chats as chatsApi } from "./services/api";
import type { User, ChatMap, TeachingMode, TeachingTone } from "./types";

import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import ChatPage from "./pages/ChatPage";
import TeacherPage from "./pages/TeacherPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import SettingsModal from "./components/settings/SettingsModal";
import NotificationBell from "./components/notification/NotificationBell";

import "./styles/theme.css";

function StudentSidebar({
  username,
  dashView,
  onDashView,
  onLogout,
  onSettings,
  chatMap,
  activeChatId,
  onSelectChat,
  onDeleteChat,
  teachingMode,
  teachingTone,
  onModeChange,
  onToneChange,
}: {
  username: string;
  dashView: string;
  onDashView: (v: "dashboard" | "browse") => void;
  onLogout: () => void;
  onSettings: () => void;
  chatMap: ChatMap;
  activeChatId: string | null;
  onSelectChat: (chatId: string, courseId?: string) => void;
  onDeleteChat: (chatId: string) => void;
  teachingMode: TeachingMode;
  teachingTone: TeachingTone;
  onModeChange: (mode: TeachingMode) => void;
  onToneChange: (tone: TeachingTone) => void;
}) {
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
    { value: "direct",     label: "📖 Direct Explanation" },
    { value: "hint_first", label: "💡 Hint First" },
    { value: "socratic",   label: "🧑‍🏫 Socratic Tutor" },
    { value: "quiz_me",    label: "📝 Quiz Me" },
  ];

  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [hoveredChat, setHoveredChat] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filteredChats = Object.entries(chatMap)
    .filter(([, chat]) => !search || (chat.title ?? "").toLowerCase().includes(search.toLowerCase()))
    .sort(([, a], [, b]) => {
      const aTime = new Date((a as any).created_at ?? 0).getTime();
      const bTime = new Date((b as any).created_at ?? 0).getTime();
      return bTime - aTime;
    });

  const selectStyle: React.CSSProperties = {
    width: "100%", padding: "9px 32px 9px 12px",
    border: "1.5px solid #e2e8f0", borderRadius: 12,
    fontSize: "0.82rem", fontFamily: "inherit", color: "#374151",
    background: "#fff", outline: "none", cursor: "pointer",
    appearance: "none", transition: "border-color 0.15s",
    boxSizing: "border-box",
  };

  return (
    <div style={{
      width: 256, minWidth: 256, height: "100vh",
      background: "#fff", borderRight: "1px solid #f1f5f9",
      display: "flex", flexDirection: "column",
      position: "fixed", left: 0, top: 0, zIndex: 20,
      boxShadow: "4px 0 24px rgba(148,163,184,0.12)",
      fontFamily: "inherit", overflowY: "auto",
    }}>


      <div style={{ background: "linear-gradient(135deg, #fff7ed, #fdf2f8)", padding: "1.25rem 1.5rem", borderBottom: "1px solid #fed7aa" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <LassieLogo size={48} radius={16} />
          <div>
            <h1 style={{ fontWeight: 800, color: "#f97316", fontSize: "1.2rem", letterSpacing: "-0.02em", margin: 0, lineHeight: 1.1 }}>LASSIE</h1>
            <p style={{ fontSize: "0.72rem", color: "rgba(249,115,22,0.65)", margin: 0, marginTop: 2 }}>Learning Assistant</p>
          </div>
        </div>
      </div>

      {/* User */}
      <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid #f1f5f9" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 42, height: 42, background: "linear-gradient(135deg, #3b82f6, #06b6d4)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 4px 10px rgba(59,130,246,0.25)" }}>
            <span style={{ color: "#fff", fontWeight: 700, fontSize: "1rem" }}>{username[0]?.toUpperCase()}</span>
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: "0.88rem", color: "#0f172a" }}>{username}</div>
            <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: 1 }}>Student</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div style={{ padding: "0.75rem", borderBottom: "1px solid #f1f5f9" }}>
        {[
          { id: "dashboard", label: "Dashboard", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg> },
          { id: "browse",    label: "Browse",    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"   strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> },
        ].map((item) => {
          const active = dashView === item.id;
          const hovered = hoveredItem === item.id;
          return (
            <button key={item.id}
              onClick={() => onDashView(item.id as "dashboard" | "browse")}
              onMouseEnter={() => setHoveredItem(item.id)}
              onMouseLeave={() => setHoveredItem(null)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 14, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "0.88rem", fontWeight: active ? 700 : 500, marginBottom: 3, transition: "all 0.15s", background: active ? "linear-gradient(135deg, #f97316, #ec4899)" : hovered ? "#f8fafc" : "transparent", color: active ? "#fff" : "#64748b", boxShadow: active ? "0 4px 14px rgba(249,115,22,0.3)" : "none", textAlign: "left" }}>
              <span style={{ opacity: active ? 1 : 0.65 }}>{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Teaching Preferences */}
      <div style={{ padding: "0.9rem 1rem", borderBottom: "1px solid #f1f5f9" }}>
        <p style={{ fontSize: "0.6rem", fontWeight: 700, color: "#94a3b8", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>Teaching Preferences</p>
        <div style={{ marginBottom: 10 }}>
          <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 500, color: "#374151", marginBottom: 5 }}>Tone</label>
          <div style={{ position: "relative" }}>
            <select value={teachingTone} onChange={(e) => onToneChange(e.target.value as TeachingTone)} style={selectStyle}
              onFocus={(e) => e.target.style.borderColor = "#f97316"}
              onBlur={(e) => e.target.style.borderColor = "#e2e8f0"}>
              {TONES.map((t) => <option key={t}>{t}</option>)}
            </select>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>
        <div>
          <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 500, color: "#374151", marginBottom: 5 }}>Teaching Mode</label>
          <div style={{ position: "relative" }}>
            <select value={teachingMode} onChange={(e) => onModeChange(e.target.value as TeachingMode)} style={selectStyle}
              onFocus={(e) => e.target.style.borderColor = "#f97316"}
              onBlur={(e) => e.target.style.borderColor = "#e2e8f0"}>
              {MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>
      </div>

      {/* Recent Chats */}
      <div style={{ flex: 1, minHeight: 0, padding: "0.9rem 1rem", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <p style={{ fontSize: "0.6rem", fontWeight: 700, color: "#94a3b8", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Recent Chats</p>
        <div style={{ position: "relative", marginBottom: 8 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search chats..."
            style={{ width: "100%", padding: "8px 10px 8px 28px", border: "1.5px solid #e2e8f0", borderRadius: 11, fontSize: "0.8rem", fontFamily: "inherit", color: "#374151", background: "#f9fafb", outline: "none", boxSizing: "border-box" as const, transition: "border-color 0.15s" }}
            onFocus={(e) => e.target.style.borderColor = "#f97316"}
            onBlur={(e) => e.target.style.borderColor = "#e2e8f0"}
          />
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 5 }}>
          {filteredChats.length === 0 ? (
            <p style={{ color: "#94a3b8", fontSize: "0.78rem", textAlign: "center", padding: "1rem 0" }}>
              {Object.keys(chatMap).length === 0 ? "No chats yet ✨" : "No matching chats"}
            </p>
          ) : filteredChats.map(([id, chat]) => {
            const isActive = id === activeChatId;
            const isHovered = hoveredChat === id;
            const title = (chat.title || "Untitled").trim();
            const shortTitle = title.length > 22 ? title.slice(0, 22) + "…" : title;
            const courseLabel = chat.course_id ? chat.course_id.split("::")[1] ?? "" : "";
            return (
              <div key={id} style={{ display: "flex", gap: 5, alignItems: "center" }}
                onMouseEnter={() => setHoveredChat(id)}
                onMouseLeave={() => setHoveredChat(null)}>
                <button onClick={() => onSelectChat(id, chat.course_id ?? undefined)}
                  style={{ flex: 1, textAlign: "left", padding: "9px 11px", borderRadius: 12, border: `1.5px solid ${isActive ? "#fed7aa" : isHovered ? "#fde8d0" : "rgba(249,115,22,0.08)"}`, background: isActive ? "linear-gradient(135deg, rgba(249,115,22,0.07), rgba(236,72,153,0.04))" : isHovered ? "linear-gradient(135deg, rgba(249,115,22,0.04), rgba(236,72,153,0.02))" : "linear-gradient(135deg, rgba(249,115,22,0.02), rgba(236,72,153,0.01))", cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s", minWidth: 0 }}>
                  <div style={{ fontSize: "0.8rem", fontWeight: 600, color: isActive ? "#ea580c" : "#0f172a", marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    💬 {shortTitle}
                  </div>
                  {courseLabel && <div style={{ fontSize: "0.68rem", color: "#94a3b8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{courseLabel}</div>}
                  <span style={{ display: "inline-block", marginTop: 3, padding: "1px 6px", background: "#dbeafe", color: "#2563eb", fontSize: "0.62rem", borderRadius: 99, fontWeight: 600 }}>{chat.mode ?? "direct"}</span>
                </button>
                {(isHovered || isActive) && (
                  <button onClick={(e) => { e.stopPropagation(); onDeleteChat(id); }}
                    style={{ width: 28, height: 28, borderRadius: 9, border: "none", background: "#fef2f2", color: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "0.72rem", fontWeight: 700 }}>
                    ✕
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: "0.75rem", borderTop: "1px solid #f1f5f9" }}>
        <button onClick={onSettings}
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 12, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "0.85rem", fontWeight: 500, color: "#64748b", background: "transparent", textAlign: "left", marginBottom: 2, transition: "background 0.15s" }}
          onMouseEnter={(e) => e.currentTarget.style.background = "#f8fafc"}
          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.55 }}>
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          Settings
        </button>
        <button onClick={onLogout}
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 12, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "0.85rem", fontWeight: 600, color: "#ef4444", background: "transparent", textAlign: "left", transition: "background 0.15s" }}
          onMouseEnter={(e) => e.currentTarget.style.background = "#fef2f2"}
          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Logout
        </button>
      </div>
    </div>
  );
}
function LogoutConfirmModal({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.45)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "1rem",
      }}
      onClick={onCancel}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#fff",
          borderRadius: 28,
          padding: "2rem",
          boxShadow: "0 24px 80px rgba(15,23,42,0.28)",
          border: "1px solid rgba(255,255,255,0.75)",
          textAlign: "center",
          animation: "logoutPop 0.18s ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            width: 74,
            height: 74,
            borderRadius: 24,
            background: "linear-gradient(135deg, #fff7ed, #fdf2f8)",
            border: "1px solid #fed7aa",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 1.1rem",
            boxShadow: "0 8px 24px rgba(249,115,22,0.18)",
          }}
        >
          <span style={{ fontSize: "2.2rem" }}>👋</span>
        </div>

        <h2
          style={{
            fontSize: "1.45rem",
            fontWeight: 800,
            color: "#111827",
            margin: "0 0 0.5rem",
            letterSpacing: "-0.02em",
          }}
        >
          Log out of LASSIE?
        </h2>

        <p
          style={{
            fontSize: "0.92rem",
            color: "#6b7280",
            lineHeight: 1.65,
            margin: "0 0 1.5rem",
          }}
        >
          Your current session will end. You can sign in again anytime with your account.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <button
            onClick={onCancel}
            style={{
              padding: "12px 16px",
              borderRadius: 14,
              border: "1.5px solid #e5e7eb",
              background: "#fff",
              color: "#374151",
              fontSize: "0.92rem",
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Stay
          </button>

          <button
            onClick={onConfirm}
            style={{
              padding: "12px 16px",
              borderRadius: 14,
              border: "none",
              background: "linear-gradient(135deg, #f97316, #ec4899)",
              color: "#fff",
              fontSize: "0.92rem",
              fontWeight: 800,
              cursor: "pointer",
              fontFamily: "inherit",
              boxShadow: "0 8px 20px rgba(249,115,22,0.28)",
            }}
          >
            Yes, log out
          </button>
        </div>

        <style>
          {`
            @keyframes logoutPop {
              from {
                opacity: 0;
                transform: scale(0.96) translateY(8px);
              }
              to {
                opacity: 1;
                transform: scale(1) translateY(0);
              }
            }
          `}
        </style>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [chatMap, setChatMap] = useState<ChatMap>({});
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [animatedInitialChatId, setAnimatedInitialChatId] = useState<string | null>(null);
  const [dashboardCourseId, setDashboardCourseId] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dashView, setDashView] = useState<"dashboard" | "browse">("dashboard");
  const [teachingMode, setTeachingMode] = useState<TeachingMode>("direct");
  const [teachingTone, setTeachingTone] = useState<TeachingTone>("Professional Tutor");
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  useEffect(() => {
    if (isAdmin) return;
    const t = tokenStore.get();
    if (!t) return;
    chatsApi.getAll().then(setChatMap).catch(() => tokenStore.clear());
  }, []);


  useEffect(() => {
    if (!activeChatId) return;
    const c = chatMap[activeChatId];
    if (!c) return;
    if (c.mode) setTeachingMode(c.mode);
    if (c.tone) setTeachingTone(c.tone);
  }, [activeChatId, chatMap]);

  if (isAdmin) return <AdminDashboardPage onLogout={() => setIsAdmin(false)} />;

  async function loadChats() {
  try {
    const d = await chatsApi.getAll();
    setChatMap(d);
    return d;
  } catch (e) {
    console.error(e);
    return null;
  }
  }

  function handleLogin(u: User) { setUser(u); loadChats(); }

  function handleLogout() {
    tokenStore.clear(); setUser(null); setChatMap({});
    setActiveChatId(null); setDashboardCourseId(null); setSettingsOpen(false);
  }

function requestLogout() {
  setLogoutConfirmOpen(true);
}

function confirmLogout() {
  setLogoutConfirmOpen(false);
  handleLogout();
}

  async function handleOpenChat(
  chatId: string,
  courseId?: string,
  animateInitialMessage: boolean = false
) {
  const freshChats = await loadChats();
  const resolvedCourseId = courseId ?? freshChats?.[chatId]?.course_id ?? null;

  if (resolvedCourseId) {
    setDashboardCourseId(resolvedCourseId);
  }

  setAnimatedInitialChatId(animateInitialMessage ? chatId : null);
  setActiveChatId(chatId);
}

  async function handleDeleteChat(chatId: string) {
  const ok = window.confirm("Delete this chat?");
  if (!ok) return;

  try {
    await chatsApi.delete(chatId);

    setChatMap((prev) => {
      const next = { ...prev };
      delete next[chatId];
      return next;
    });

    if (activeChatId === chatId) {
      setActiveChatId(null);
    }
  } catch (e) {
    console.error(e);
  } finally {
    await loadChats();
  }
  }
  async function handleSendMessage(chat_id: string, content: string) {
    setStreaming(true);
    setChatMap((prev) => {
      const cur = prev[chat_id];
      return { ...prev, [chat_id]: { ...cur, messages: [...(cur?.messages ?? []), { role: "user", content }, { role: "assistant", content: "" }] } };
    });
    try {
      const { streamRequest } = await import("./services/api");
      for await (const delta of streamRequest(`/chats/${chat_id}/messages`, { content, stream: true })) {
        setChatMap((prev) => {
          const cur = prev[chat_id];
          const msgs = [...(cur?.messages ?? [])];
          const last = msgs[msgs.length - 1];
          if (last?.role === "assistant") msgs[msgs.length - 1] = { ...last, content: (last.content ?? "") + delta };
          return { ...prev, [chat_id]: { ...cur, messages: msgs } };
        });
      }
    } catch (e) { console.error(e); }
    finally { setStreaming(false); await loadChats(); }
  }

  async function handleRegenerate(chat_id: string) {
    setStreaming(true);
    setChatMap((prev) => {
      const cur = prev[chat_id];
      const msgs = [...(cur?.messages ?? [])];
      if (msgs.at(-1)?.role === "assistant") msgs.pop();
      return { ...prev, [chat_id]: { ...cur, messages: [...msgs, { role: "assistant", content: "" }] } };
    });
    try {
      const { streamRequest } = await import("./services/api");
      for await (const delta of streamRequest(`/chats/${chat_id}/regenerate`, {})) {
        setChatMap((prev) => {
          const cur = prev[chat_id];
          const msgs = [...(cur?.messages ?? [])];
          const last = msgs[msgs.length - 1];
          if (last?.role === "assistant") msgs[msgs.length - 1] = { ...last, content: (last.content ?? "") + delta };
          return { ...prev, [chat_id]: { ...cur, messages: msgs } };
        });
      }
    } catch (e) { console.error(e); }
    finally { setStreaming(false); await loadChats(); }
  }

  async function handleModeChange(mode: TeachingMode) {
  setTeachingMode(mode);

  if (!activeChatId) return;

  const currentChat = chatMap[activeChatId];
  if (!currentChat) return;

  setChatMap((prev) => ({
    ...prev,
    [activeChatId]: {
      ...prev[activeChatId],
      mode,
    },
  }));

  try {
    await chatsApi.updateSettings(activeChatId, { mode });
    await loadChats();
  } catch (e) {
    console.error(e);
  }
}

  async function handleToneChange(tone: TeachingTone) {
  setTeachingTone(tone);

  if (!activeChatId) return;

  const currentChat = chatMap[activeChatId];
  if (!currentChat) return;

  setChatMap((prev) => ({
    ...prev,
    [activeChatId]: {
      ...prev[activeChatId],
      tone,
    },
  }));

  try {
    await chatsApi.updateSettings(activeChatId, { tone });
    await loadChats();
  } catch (e) {
    console.error(e);
  }
}

  if (!user) return <AuthPage onLogin={handleLogin} onAdminLogin={() => setIsAdmin(true)} />;

  const activeChat = activeChatId ? chatMap[activeChatId] : null;

  // Teacher
  if (user.role === "teacher") {
    return (
      <>
        <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #fff7ed 0%, #fdf2f8 50%, #f5f3ff 100%)" }}>
          <TeacherPage
              username={user.username}
              onLogout={requestLogout}
              onSettings={() => setSettingsOpen(true)}
          />
        </div>
        {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} onProfileUpdated={(fn) => setUser((p) => p ? { ...p, full_name: fn } : p)} />}
        {logoutConfirmOpen && (
          <LogoutConfirmModal
            onCancel={() => setLogoutConfirmOpen(false)}
            onConfirm={confirmLogout}
          />
        )}
      </>
    );
  }

  // Student
  return (
  <>
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <StudentSidebar
      username={user.username}
      dashView={dashView}
      chatMap={chatMap}
      activeChatId={activeChatId}
      onSelectChat={handleOpenChat}
      onDeleteChat={handleDeleteChat}
      teachingMode={teachingMode}
      teachingTone={teachingTone}
      onModeChange={handleModeChange}
      onToneChange={handleToneChange}
      onDashView={(v) => {
        setDashView(v);
        setActiveChatId(null);
        setDashboardCourseId(null);
      }}
      onLogout={requestLogout}
      onSettings={() => setSettingsOpen(true)}
    />

      <div
        style={{
          marginLeft: 256,
          flex: 1,
          position: "relative",
          overflow: "hidden",
          background: "linear-gradient(135deg, #f8fafc 0%, #eff6ff 50%, #fdf4ff 100%)",
        }}
      >
      <div
        style={{
          position: "absolute",
          top: 18,
          right: 24,
          zIndex: 300,
        }}
      >
        <NotificationBell />
      </div>


        <div
          style={{
            height: "100%",
            overflowY: "auto",
            display: activeChatId && activeChat ? "none" : "block",
          }}
        >
          <div style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem 4.5rem 2rem 2.5rem" }}>
            <DashboardPage
              teachingMode={teachingMode}
              teachingTone={teachingTone}
              onOpenChat={handleOpenChat}
              selectedCourseId={dashboardCourseId}
              onSelectedCourseChange={setDashboardCourseId}
              dashView={dashView}
              onDashViewChange={setDashView}
              username={user.username}
            />
          </div>
        </div>


        {activeChatId && activeChat && (
          <div style={{ position: "absolute", inset: 0 }}>
            <ChatPage
              chatId={activeChatId}
              chat={activeChat}
              streaming={streaming}
              animateInitialMessage={animatedInitialChatId === activeChatId}
              onSend={(c) => handleSendMessage(activeChatId, c)}
              onRegenerate={() => handleRegenerate(activeChatId)}
              onBack={() => setActiveChatId(null)}
            />
          </div>
        )}
      </div>
    </div>

    {settingsOpen && (
      <SettingsModal
        onClose={() => setSettingsOpen(false)}
        onProfileUpdated={(fn) => setUser((p) => (p ? { ...p, full_name: fn } : p))}
      />
    )}

    {logoutConfirmOpen && (
      <LogoutConfirmModal
        onCancel={() => setLogoutConfirmOpen(false)}
        onConfirm={confirmLogout}
      />
    )}
  </>
  );
}
