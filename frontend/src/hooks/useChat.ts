import { useState, useCallback } from "react";
import { chats as chatsApi } from "../services/api";
import type { ChatMap, TeachingMode, TeachingTone } from "../types";

export function useChat(username: string) {
  const [chatMap, setChatMap]       = useState<ChatMap>({});
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [streaming, setStreaming]   = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const loadChats = useCallback(async () => {
    try {
      const data = await chatsApi.getAll();
      setChatMap(data);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  const createChat = useCallback(
    async (opts: {
      course_id?: string;
      mode?: TeachingMode;
      tone?: TeachingTone;
    }) => {
      const { chat_id } = await chatsApi.create(opts);
      await loadChats();
      setActiveChatId(chat_id);
      return chat_id;
    },
    [loadChats]
  );

  const deleteChat = useCallback(
    async (chat_id: string) => {
      await chatsApi.delete(chat_id);
      if (activeChatId === chat_id) setActiveChatId(null);
      await loadChats();
    },
    [activeChatId, loadChats]
  );

  const renameChat = useCallback(
    async (chat_id: string, title: string) => {
      await chatsApi.rename(chat_id, title);
      await loadChats();
    },
    [loadChats]
  );

  // Streaming mesaj gönder — state'i optimistik güncelle
  const sendMessage = useCallback(
    async (chat_id: string, content: string) => {
      setStreaming(true);
      setError(null);

      // Kullanıcı mesajını anında ekle
      setChatMap((prev) => ({
        ...prev,
        [chat_id]: {
          ...prev[chat_id],
          messages: [
            ...(prev[chat_id]?.messages ?? []),
            { role: "user", content },
          ],
        },
      }));

      // Boş assistant mesajı ekle, streaming ile dolduracağız
      setChatMap((prev) => ({
        ...prev,
        [chat_id]: {
          ...prev[chat_id],
          messages: [
            ...(prev[chat_id]?.messages ?? []),
            { role: "assistant", content: "" },
          ],
        },
      }));

      try {
        for await (const delta of chatsApi.sendStream(chat_id, content)) {
          setChatMap((prev) => {
            const msgs = [...(prev[chat_id]?.messages ?? [])];
            const last = msgs[msgs.length - 1];
            if (last?.role === "assistant") {
              msgs[msgs.length - 1] = { ...last, content: last.content + delta };
            }
            return { ...prev, [chat_id]: { ...prev[chat_id], messages: msgs } };
          });
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setStreaming(false);
        // Sunucu tarafında kaydedildi; state'i sunucudan senkronize et
        await loadChats();
      }
    },
    [loadChats]
  );

  const regenerate = useCallback(
    async (chat_id: string) => {
      setStreaming(true);
      setError(null);

      // Son assistant mesajını sil
      setChatMap((prev) => {
        const msgs = [...(prev[chat_id]?.messages ?? [])];
        if (msgs[msgs.length - 1]?.role === "assistant") msgs.pop();
        return {
          ...prev,
          [chat_id]: { ...prev[chat_id], messages: [...msgs, { role: "assistant", content: "" }] },
        };
      });

      try {
        for await (const delta of chatsApi.regenerateStream(chat_id)) {
          setChatMap((prev) => {
            const msgs = [...(prev[chat_id]?.messages ?? [])];
            const last = msgs[msgs.length - 1];
            if (last?.role === "assistant") {
              msgs[msgs.length - 1] = { ...last, content: last.content + delta };
            }
            return { ...prev, [chat_id]: { ...prev[chat_id], messages: msgs } };
          });
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setStreaming(false);
        await loadChats();
      }
    },
    [loadChats]
  );

  const activeChat = activeChatId ? chatMap[activeChatId] : null;

  return {
    chatMap,
    activeChatId,
    activeChat,
    streaming,
    error,
    setActiveChatId,
    loadChats,
    createChat,
    deleteChat,
    renameChat,
    sendMessage,
    regenerate,
  };
}
