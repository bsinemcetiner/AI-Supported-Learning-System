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

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [chatMap, setChatMap] = useState<ChatMap>({});
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [dashboardCourseId, setDashboardCourseId] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [teachingMode, setTeachingMode] = useState<TeachingMode>("direct");
  const [teachingTone, setTeachingTone] = useState<TeachingTone>("Professional Tutor");

  useEffect(() => {
    if (isAdmin) return;
    const t = tokenStore.get();
    if (!t) return;
    chatsApi.getAll().then((data) => setChatMap(data)).catch(() => tokenStore.clear());
  }, []);

  useEffect(() => {
    const starter = sessionStorage.getItem("starter_message");
    if (activeChatId && starter) {
      sessionStorage.removeItem("starter_message");
      let i = 0;
      setChatMap((prev) => ({
        ...prev,
        [activeChatId]: { ...prev[activeChatId], messages: [{ role: "assistant", content: "" }] },
      }));
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
    const activeChat = chatMap[activeChatId];
    if (!activeChat) return;
    if (activeChat.mode) setTeachingMode(activeChat.mode);
    if (activeChat.tone) setTeachingTone(activeChat.tone);
  }, [activeChatId, chatMap]);

  if (isAdmin) {
    return <AdminDashboardPage onLogout={() => setIsAdmin(false)} />;
  }

  async function loadChats() {
    try { const data = await chatsApi.getAll(); setChatMap(data); } catch (_) {}
  }

  function handleLogin(loggedInUser: User) {
    setUser(loggedInUser);
    loadChats();
  }

  function handleLogout() {
    tokenStore.clear();
    setUser(null);
    setChatMap({});
    setActiveChatId(null);
    setDashboardCourseId(null);
    setSettingsOpen(false);
  }

  async function handleOpenChat(chatId: string, courseId?: string) {
    await loadChats();
    if (courseId) setDashboardCourseId(courseId);
    else if (chatMap[chatId]?.course_id) setDashboardCourseId(chatMap[chatId].course_id);
    setActiveChatId(chatId);
  }

  async function handleDeleteChat(chat_id: string) {
    await chatsApi.delete(chat_id);
    if (activeChatId === chat_id) setActiveChatId(null);
    await loadChats();
  }

  async function handleSendMessage(chat_id: string, content: string) {
    setStreaming(true);
    setChatMap((prev) => {
      const current = prev[chat_id];
      return { ...prev, [chat_id]: { ...current, messages: [...(current?.messages ?? []), { role: "user", content }, { role: "assistant", content: "" }] } };
    });
    try {
      const { streamRequest } = await import("./services/api");
      for await (const delta of streamRequest(`/chats/${chat_id}/messages`, { content, stream: true })) {
        setChatMap((prev) => {
          const current = prev[chat_id];
          const msgs = [...(current?.messages ?? [])];
          const last = msgs[msgs.length - 1];
          if (last?.role === "assistant") msgs[msgs.length - 1] = { ...last, content: (last.content ?? "") + delta };
          return { ...prev, [chat_id]: { ...current, messages: msgs } };
        });
      }
    } catch (e) {
      console.error("Stream error:", e);
      setChatMap((prev) => {
        const current = prev[chat_id];
        const msgs = [...(current?.messages ?? [])];
        const last = msgs[msgs.length - 1];
        if (last?.role === "assistant" && !(last.content ?? "").trim()) msgs[msgs.length - 1] = { ...last, content: "An error occurred while streaming the response." };
        return { ...prev, [chat_id]: { ...current, messages: msgs } };
      });
    } finally {
      setStreaming(false);
      await loadChats();
    }
  }

  async function handleRegenerate(chat_id: string) {
    setStreaming(true);
    setChatMap((prev) => {
      const current = prev[chat_id];
      const msgs = [...(current?.messages ?? [])];
      if (msgs.at(-1)?.role === "assistant") msgs.pop();
      return { ...prev, [chat_id]: { ...current, messages: [...msgs, { role: "assistant", content: "" }] } };
    });
    try {
      const { streamRequest } = await import("./services/api");
      for await (const delta of streamRequest(`/chats/${chat_id}/regenerate`, {})) {
        setChatMap((prev) => {
          const current = prev[chat_id];
          const msgs = [...(current?.messages ?? [])];
          const last = msgs[msgs.length - 1];
          if (last?.role === "assistant") msgs[msgs.length - 1] = { ...last, content: (last.content ?? "") + delta };
          return { ...prev, [chat_id]: { ...current, messages: msgs } };
        });
      }
    } catch (e) {
      console.error("Regenerate error:", e);
    } finally {
      setStreaming(false);
      await loadChats();
    }
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

  if (!user) {
    return <AuthPage onLogin={handleLogin} onAdminLogin={() => setIsAdmin(true)} />;
  }

  const activeChat = activeChatId ? chatMap[activeChatId] : null;

  // Teacher layout - tam ekran, sidebar yok
  if (user.role === "teacher") {
    return (
      <>
        <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #fff7ed 0%, #fdf2f8 50%, #f5f3ff 100%)" }}>
          <TeacherPage username={user.username} onLogout={handleLogout} />
        </div>
        {settingsOpen && (
          <SettingsModal
            onClose={() => setSettingsOpen(false)}
            onProfileUpdated={(fullName) => setUser((prev) => prev ? { ...prev, full_name: fullName } : prev)}
          />
        )}
      </>
    );
  }

  // Student layout - sidebar ile
  return (
    <>
      <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
        {/* Minimal sidebar sadece student için */}
        <div style={{
          width: 220, minWidth: 220,
          background: "var(--card)",
          borderRight: "1.5px solid var(--line)",
          display: "flex", flexDirection: "column",
          padding: "1rem 0.75rem",
          gap: 6, overflowY: "auto",
        }}>
          <div style={{ padding: "0.5rem 0.5rem 1rem", borderBottom: "1px solid var(--line)", marginBottom: 4 }}>
            <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text)" }}>
              Learning Assistant
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-soft)", marginTop: 2 }}>
              {user.full_name} · <span style={{ color: "var(--orange)" }}>{user.role}</span>
            </div>
          </div>

          {/* Chats */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {Object.entries(chatMap).map(([id, chat]) => (
              <div
                key={id}
                onClick={() => { setDashboardCourseId(chatMap[id]?.course_id ?? null); setActiveChatId(id); }}
                style={{
                  padding: "0.55rem 0.65rem",
                  borderRadius: "var(--r-md)",
                  cursor: "pointer",
                  fontSize: "0.8rem",
                  fontWeight: activeChatId === id ? 600 : 400,
                  color: activeChatId === id ? "var(--orange)" : "var(--text-mid)",
                  background: activeChatId === id ? "var(--orange-lt)" : "transparent",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  transition: "all 0.15s",
                }}
              >
                💬 {chat.title || "Chat"}
              </div>
            ))}
          </div>

          <div style={{ borderTop: "1px solid var(--line)", paddingTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setSettingsOpen(true)}
              style={{ width: "100%", justifyContent: "flex-start", fontSize: "0.8rem" }}
            >
              ⚙ Settings
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleLogout}
              style={{ width: "100%", justifyContent: "flex-start", fontSize: "0.8rem" }}
            >
              ↩ Logout
            </button>
          </div>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {activeChatId && activeChat ? (
            <ChatPage
              chatId={activeChatId}
              chat={activeChat}
              streaming={streaming}
              onSend={(content) => handleSendMessage(activeChatId, content)}
              onRegenerate={() => handleRegenerate(activeChatId)}
              onBack={() => { setDashboardCourseId(activeChat?.course_id ?? null); setActiveChatId(null); }}
            />
          ) : (
            <div style={{ padding: "2rem" }}>
              <DashboardPage
                teachingMode={teachingMode}
                teachingTone={teachingTone}
                onOpenChat={handleOpenChat}
                selectedCourseId={dashboardCourseId}
                onSelectedCourseChange={setDashboardCourseId}
              />
            </div>
          )}
        </div>
      </div>

      {settingsOpen && (
        <SettingsModal
          onClose={() => setSettingsOpen(false)}
          onProfileUpdated={(fullName) => setUser((prev) => prev ? { ...prev, full_name: fullName } : prev)}
        />
      )}
    </>
  );
}
