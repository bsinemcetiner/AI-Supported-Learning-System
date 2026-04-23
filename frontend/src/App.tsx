import { useState, useEffect } from "react";
import { token as tokenStore, chats as chatsApi } from "./services/api";
import type { User, ChatMap, TeachingMode, TeachingTone } from "./types";

import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import ChatPage from "./pages/ChatPage";
import TeacherPage from "./pages/TeacherPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";
import SettingsModal from "./components/settings/SettingsModal";

import "./styles/theme.css";

function StudentSidebar({
  username, dashView, onDashView, onLogout, onSettings,
}: {
  username: string; dashView: string;
  onDashView: (v: "dashboard" | "browse") => void;
  onLogout: () => void; onSettings: () => void;
}) {
  const menu = [
    { id: "dashboard", label: "Dashboard", icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
    )},
    { id: "browse", label: "Browse", icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
    )},
  ];

  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  return (
    <div style={{ width: 256, minWidth: 256, height: "100vh", background: "#fff", borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column", position: "fixed", left: 0, top: 0, zIndex: 20 }}>

      {/* Logo */}
      <div style={{ padding: "1.5rem", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", inset: -4, background: "linear-gradient(135deg, #f97316, #ec4899)", borderRadius: 14, filter: "blur(10px)", opacity: 0.5 }} />
            <div style={{ position: "relative", background: "#fff", padding: 8, borderRadius: 14, boxShadow: "0 4px 14px rgba(0,0,0,0.1)" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                <path d="M6 12v5c3 3 9 3 12 0v-5"/>
              </svg>
            </div>
          </div>
          <div>
            <div style={{ fontSize: "1.2rem", fontWeight: 800, background: "linear-gradient(135deg, #f97316, #ec4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1.2 }}>LASSIE</div>
            <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>Learning Assistant</div>
          </div>
        </div>
      </div>

      {/* User Info */}
      <div style={{ padding: "1.5rem", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg, #3b82f6, #06b6d4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ color: "#fff", fontWeight: 700, fontSize: "1rem" }}>{username[0]?.toUpperCase()}</span>
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "#0f172a" }}>{username}</div>
            <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>Student</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: "1rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {menu.map((item) => {
            const active = dashView === item.id;
            const hovered = hoveredItem === item.id;
            return (
              <button key={item.id}
                onClick={() => onDashView(item.id as "dashboard" | "browse")}
                onMouseEnter={() => setHoveredItem(item.id)}
                onMouseLeave={() => setHoveredItem(null)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 12, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "0.9rem", fontWeight: 500, transition: "all 0.15s", background: active ? "linear-gradient(135deg, #f97316, #ec4899)" : hovered ? "#f1f5f9" : "transparent", color: active ? "#fff" : "#475569", boxShadow: active ? "0 4px 14px rgba(249,115,22,0.3)" : "none", textAlign: "left" }}>
                {item.icon}
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Bottom */}
      <div style={{ padding: "1rem", borderTop: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: 4 }}>
        <button onClick={onSettings}
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 12, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "0.9rem", fontWeight: 500, color: "#475569", background: "transparent", textAlign: "left", transition: "background 0.15s" }}
          onMouseEnter={(e) => e.currentTarget.style.background = "#f1f5f9"}
          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          Settings
        </button>
        <button onClick={onLogout}
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 12, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "0.9rem", fontWeight: 500, color: "#dc2626", background: "transparent", textAlign: "left", transition: "background 0.15s" }}
          onMouseEnter={(e) => e.currentTarget.style.background = "#fef2f2"}
          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Logout
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [chatMap, setChatMap] = useState<ChatMap>({});
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [dashboardCourseId, setDashboardCourseId] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dashView, setDashView] = useState<"dashboard" | "browse">("dashboard");
  const [teachingMode, setTeachingMode] = useState<TeachingMode>("direct");
  const [teachingTone, setTeachingTone] = useState<TeachingTone>("Professional Tutor");

  useEffect(() => {
    if (isAdmin) return;
    const t = tokenStore.get();
    if (!t) return;
    chatsApi.getAll().then(setChatMap).catch(() => tokenStore.clear());
  }, []);

  useEffect(() => {
    const starter = sessionStorage.getItem("starter_message");
    if (activeChatId && starter) {
      sessionStorage.removeItem("starter_message");
      let i = 0;
      setChatMap((prev) => ({ ...prev, [activeChatId]: { ...prev[activeChatId], messages: [{ role: "assistant", content: "" }] } }));
      const interval = setInterval(() => {
        i += 4;
        setChatMap((prev) => {
          const c = prev[activeChatId];
          const msgs = [...c.messages];
          msgs[0] = { role: "assistant", content: starter.slice(0, i) };
          return { ...prev, [activeChatId]: { ...c, messages: msgs } };
        });
        if (i >= starter.length) clearInterval(interval);
      }, 18);
    }
  }, [activeChatId]);

  useEffect(() => {
    if (!activeChatId) return;
    const c = chatMap[activeChatId];
    if (!c) return;
    if (c.mode) setTeachingMode(c.mode);
    if (c.tone) setTeachingTone(c.tone);
  }, [activeChatId, chatMap]);

  if (isAdmin) return <AdminDashboardPage onLogout={() => setIsAdmin(false)} />;

  async function loadChats() {
    try { const d = await chatsApi.getAll(); setChatMap(d); } catch (_) {}
  }

  function handleLogin(u: User) { setUser(u); loadChats(); }

  function handleLogout() {
    tokenStore.clear(); setUser(null); setChatMap({});
    setActiveChatId(null); setDashboardCourseId(null); setSettingsOpen(false);
  }

  async function handleOpenChat(chatId: string, courseId?: string) {
    await loadChats();
    if (courseId) setDashboardCourseId(courseId);
    else if (chatMap[chatId]?.course_id) setDashboardCourseId(chatMap[chatId].course_id);
    setActiveChatId(chatId);
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
    setChatMap((prev) => ({ ...prev, [activeChatId]: { ...prev[activeChatId], mode } }));
    try { await chatsApi.updateSettings(activeChatId, { mode }); } catch (e) { console.error(e); }
    finally { await loadChats(); }
  }

  async function handleToneChange(tone: TeachingTone) {
    setTeachingTone(tone);
    if (!activeChatId) return;
    setChatMap((prev) => ({ ...prev, [activeChatId]: { ...prev[activeChatId], tone } }));
    try { await chatsApi.updateSettings(activeChatId, { tone }); } catch (e) { console.error(e); }
    finally { await loadChats(); }
  }

  if (!user) return <AuthPage onLogin={handleLogin} onAdminLogin={() => setIsAdmin(true)} />;

  const activeChat = activeChatId ? chatMap[activeChatId] : null;

  // Teacher
  if (user.role === "teacher") {
    return (
      <>
        <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #fff7ed 0%, #fdf2f8 50%, #f5f3ff 100%)" }}>
          <TeacherPage username={user.username} onLogout={handleLogout} />
        </div>
        {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} onProfileUpdated={(fn) => setUser((p) => p ? { ...p, full_name: fn } : p)} />}
      </>
    );
  }

  // Student
  return (
    <>
      <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
        <StudentSidebar
          username={user.username}
          dashView={activeChatId ? "chat" : dashView}
          onDashView={(v) => { setDashView(v); setActiveChatId(null); setDashboardCourseId(null); }}
          onLogout={handleLogout}
          onSettings={() => setSettingsOpen(true)}
        />
        <div style={{ marginLeft: 256, flex: 1, overflowY: "auto", background: "linear-gradient(135deg, #f8fafc 0%, #eff6ff 50%, #fdf4ff 100%)" }}>
          {activeChatId && activeChat ? (
            <ChatPage
              chatId={activeChatId}
              chat={activeChat}
              streaming={streaming}
              onSend={(c) => handleSendMessage(activeChatId, c)}
              onRegenerate={() => handleRegenerate(activeChatId)}
              onBack={() => { setDashboardCourseId(activeChat?.course_id ?? null); setActiveChatId(null); }}
            />
          ) : (
            <div style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem 2.5rem" }}>
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
          )}
        </div>
      </div>
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} onProfileUpdated={(fn) => setUser((p) => p ? { ...p, full_name: fn } : p)} />}
    </>
  );
}
