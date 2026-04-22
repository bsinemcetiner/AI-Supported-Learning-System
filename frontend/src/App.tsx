import { useState, useEffect } from "react";
import { token as tokenStore, chats as chatsApi } from "./services/api";
import type { User, ChatMap, TeachingMode, TeachingTone } from "./types";

import Sidebar from "./components/layout/Sidebar";
import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import ChatPage from "./pages/ChatPage";
import TeacherPage from "./pages/TeacherPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";

import "./styles/theme.css";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [chatMap, setChatMap] = useState<ChatMap>({});
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [teachingMode, setTeachingMode] = useState<TeachingMode>("direct");
  const [teachingTone, setTeachingTone] = useState<TeachingTone>("Professional Tutor");

  useEffect(() => {
    if (isAdmin) return;
    const t = tokenStore.get();
    if (!t) return;
    chatsApi
      .getAll()
      .then((data) => setChatMap(data))
      .catch(() => tokenStore.clear());
  }, []);

  useEffect(() => {
    const starter = sessionStorage.getItem("starter_message");

    if (activeChatId && starter) {
      sessionStorage.removeItem("starter_message");

      let i = 0;

      setChatMap((prev) => ({
        ...prev,
        [activeChatId]: {
          ...prev[activeChatId],
          messages: [{ role: "assistant", content: "" }],
        },
      }));

      const interval = setInterval(() => {
        i += 4;

        setChatMap((prev) => {
          const c = prev[activeChatId];
          const msgs = [...c.messages];
          msgs[0] = {
            role: "assistant",
            content: starter.slice(0, i),
          };

          return {
            ...prev,
            [activeChatId]: { ...c, messages: msgs },
          };
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

  if (isAdmin) return <AdminDashboardPage onLogout={() => setIsAdmin(false)} />;

  async function loadChats() {
    try {
      const data = await chatsApi.getAll();
      setChatMap(data);
    } catch (_) {}
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
  }

  async function handleOpenChat(chatId: string) {
    await loadChats();
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
      const prevMessages = current?.messages ?? [];
      return {
        ...prev,
        [chat_id]: {
          ...current,
          messages: [
            ...prevMessages,
            { role: "user", content },
            { role: "assistant", content: "" },
          ],
        },
      };
    });

    try {
      const { streamRequest } = await import("./services/api");

      for await (const delta of streamRequest(`/chats/${chat_id}/messages`, {
        content,
        stream: true,
      })) {
        setChatMap((prev) => {
          const current = prev[chat_id];
          const msgs = [...(current?.messages ?? [])];
          const last = msgs[msgs.length - 1];
          if (last?.role === "assistant") {
            msgs[msgs.length - 1] = {
              ...last,
              content: (last.content ?? "") + delta,
            };
          }
          return { ...prev, [chat_id]: { ...current, messages: msgs } };
        });
      }
    } catch (e) {
      console.error("Stream error:", e);
      setChatMap((prev) => {
        const current = prev[chat_id];
        const msgs = [...(current?.messages ?? [])];
        const last = msgs[msgs.length - 1];
        if (last?.role === "assistant" && !(last.content ?? "").trim()) {
          msgs[msgs.length - 1] = {
            ...last,
            content: "An error occurred while streaming the response.",
          };
        }
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
      return {
        ...prev,
        [chat_id]: {
          ...current,
          messages: [...msgs, { role: "assistant", content: "" }],
        },
      };
    });

    try {
      const { streamRequest } = await import("./services/api");

      for await (const delta of streamRequest(`/chats/${chat_id}/regenerate`, {})) {
        setChatMap((prev) => {
          const current = prev[chat_id];
          const msgs = [...(current?.messages ?? [])];
          const last = msgs[msgs.length - 1];
          if (last?.role === "assistant") {
            msgs[msgs.length - 1] = {
              ...last,
              content: (last.content ?? "") + delta,
            };
          }
          return { ...prev, [chat_id]: { ...current, messages: msgs } };
        });
      }
    } catch (e) {
      console.error("Regenerate error:", e);
      setChatMap((prev) => {
        const current = prev[chat_id];
        const msgs = [...(current?.messages ?? [])];
        const last = msgs[msgs.length - 1];
        if (last?.role === "assistant" && !(last.content ?? "").trim()) {
          msgs[msgs.length - 1] = {
            ...last,
            content: "An error occurred while regenerating the response.",
          };
        }
        return { ...prev, [chat_id]: { ...current, messages: msgs } };
      });
    } finally {
      setStreaming(false);
      await loadChats();
    }
  }

  async function handleModeChange(mode: TeachingMode) {
    setTeachingMode(mode);

    if (!activeChatId) return;

    setChatMap((prev) => ({
      ...prev,
      [activeChatId]: {
        ...prev[activeChatId],
        mode,
      },
    }));

    try {
      await chatsApi.updateSettings(activeChatId, { mode });
    } catch (e) {
      console.error("Mode update error:", e);
    } finally {
      await loadChats();
    }
  }

  async function handleToneChange(tone: TeachingTone) {
    setTeachingTone(tone);

    if (!activeChatId) return;

    setChatMap((prev) => ({
      ...prev,
      [activeChatId]: {
        ...prev[activeChatId],
        tone,
      },
    }));

    try {
      await chatsApi.updateSettings(activeChatId, { tone });
    } catch (e) {
      console.error("Tone update error:", e);
    } finally {
      await loadChats();
    }
  }

  if (!user) {
    return <AuthPage onLogin={handleLogin} onAdminLogin={() => setIsAdmin(true)} />;
  }

  const activeChat = activeChatId ? chatMap[activeChatId] : null;

  return (
    <div className="app-layout">
      <Sidebar
        user={user}
        chatMap={chatMap}
        activeChatId={activeChatId}
        onSelectChat={setActiveChatId}
        onNewChat={() => setActiveChatId(null)}
        onDeleteChat={handleDeleteChat}
        onLogout={handleLogout}
        teachingMode={teachingMode}
        teachingTone={teachingTone}
        onModeChange={handleModeChange}
        onToneChange={handleToneChange}
      />

      {user.role === "teacher" ? (
        <div className="main-content">
          <TeacherPage username={user.username} />
        </div>
      ) : activeChatId && activeChat ? (
        <ChatPage
          chatId={activeChatId}
          chat={activeChat}
          streaming={streaming}
          onSend={(content) => handleSendMessage(activeChatId, content)}
          onRegenerate={() => handleRegenerate(activeChatId)}
          onBack={() => setActiveChatId(null)}
        />
      ) : (
        <div className="main-content">
          <DashboardPage
            teachingMode={teachingMode}
            teachingTone={teachingTone}
            onOpenChat={handleOpenChat}
          />
        </div>
      )}
    </div>
  );
}