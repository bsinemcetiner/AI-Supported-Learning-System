import { useState, useEffect } from "react";
import { token as tokenStore, chats as chatsApi } from "./services/api";
import type { User, ChatMap, TeachingMode, TeachingTone } from "./types";

import Sidebar from "./components/layout/Sidebar";
import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import ChatPage from "./pages/ChatPage";
import TeacherPage from "./pages/TeacherPage";

import "./styles/theme.css";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [chatMap, setChatMap] = useState<ChatMap>({});
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [teachingMode, setTeachingMode] = useState<TeachingMode>("direct");
  const [teachingTone, setTeachingTone] = useState<TeachingTone>("Professional Tutor");

  useEffect(() => {
    const t = tokenStore.get();
    if (!t) return;

    chatsApi
      .getAll()
      .then((data) => setChatMap(data))
      .catch(() => tokenStore.clear());
  }, []);

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

          return {
            ...prev,
            [chat_id]: {
              ...current,
              messages: msgs,
            },
          };
        });
      }
    } catch (e) {
      console.error("Stream error:", e);
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

      if (msgs.at(-1)?.role === "assistant") {
        msgs.pop();
      }

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

          return {
            ...prev,
            [chat_id]: {
              ...current,
              messages: msgs,
            },
          };
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
    if (activeChatId) {
      const token = tokenStore.get();
      await fetch(`/api/chats/${activeChatId}/settings`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ mode }),
      });
      await loadChats();
    }
  }

  async function handleToneChange(tone: TeachingTone) {
    setTeachingTone(tone);
    if (activeChatId) {
      const token = tokenStore.get();
      await fetch(`/api/chats/${activeChatId}/settings`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ tone }),
      });
      await loadChats();
    }
  }

  if (!user) {
    return <AuthPage onLogin={handleLogin} />;
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