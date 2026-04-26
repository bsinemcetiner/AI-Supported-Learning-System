import { useRef, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { Chat } from "../types";

interface ChatPageProps {
  chatId: string;
  chat: Chat;
  streaming: boolean;
  animateInitialMessage?: boolean;
  onSend: (content: string) => void;
  onRegenerate: () => void;
  onBack: () => void;
}

export default function ChatPage({
  chatId,
  chat,
  streaming,
  animateInitialMessage = false,
  onSend,
  onRegenerate,
  onBack,
}: ChatPageProps) {
  const [input, setInput] = useState("");
  const [animatedFirstMessage, setAnimatedFirstMessage] = useState("");
  const [animatedChatId, setAnimatedChatId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const messages = chat.messages ?? [];

  const hasExchange =
    messages.length >= 2 &&
    messages.at(-1)?.role === "assistant" &&
    messages.at(-2)?.role === "user";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, messages.at(-1)?.content, animatedFirstMessage]);

  useEffect(() => {
    const firstAssistantMessage =
      messages.find((m) => m.role === "assistant")?.content || "";

    if (!firstAssistantMessage) {
      setAnimatedFirstMessage("");
      setAnimatedChatId(null);
      return;
    }

    if (!animateInitialMessage) {
      setAnimatedFirstMessage("");
      setAnimatedChatId(null);
      return;
    }

    if (animatedChatId === chatId) return;

    setAnimatedChatId(chatId);
    setAnimatedFirstMessage("");

    let i = 0;

    const interval = setInterval(() => {
      i += 8;
      setAnimatedFirstMessage(firstAssistantMessage.slice(0, i));

      if (i >= firstAssistantMessage.length) {
        clearInterval(interval);
        setAnimatedFirstMessage(firstAssistantMessage);
      }
    }, 18);

    return () => clearInterval(interval);
  }, [chatId, messages.length, animateInitialMessage]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const val = input.trim();
    if (!val || streaming) return;

    setInput("");
    onSend(val);
  }

  const courseLabel = chat.course_id
    ? chat.course_id.split("::")[1] ?? chat.course_id
    : null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "#f8fafc",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "1rem 1.5rem",
          background: "#fff",
          borderBottom: "1px solid #f3f4f6",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={onBack}
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              border: "1px solid #e5e7eb",
              background: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#374151"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 14,
              background: "linear-gradient(135deg, #f97316, #ec4899)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>

          <div>
            <p
              style={{
                fontWeight: 700,
                fontSize: "0.95rem",
                color: "#111827",
                margin: 0,
              }}
            >
              {chat.title || "Learning Chat"}
            </p>

            <p
              style={{
                fontSize: "0.75rem",
                color: "#9ca3af",
                margin: 0,
              }}
            >
              {courseLabel && <span>{courseLabel} · </span>}
              <span style={{ color: "#f97316", fontWeight: 600 }}>
                {chat.mode}
              </span>
              {chat.tone && <span> · {chat.tone}</span>}
            </p>
          </div>
        </div>

        {hasExchange && !streaming && (
          <button
            onClick={onRegenerate}
            style={{
              padding: "7px 14px",
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              background: "#fff",
              color: "#374151",
              fontSize: "0.82rem",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            Regenerate
          </button>
        )}
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "1.5rem",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              flex: 1,
              gap: 16,
              padding: "3rem 1rem",
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 22,
                background: "linear-gradient(135deg, #f97316, #ec4899)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 8px 24px rgba(249,115,22,0.3)",
              }}
            >
              <svg
                width="34"
                height="34"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#fff"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>

            <div style={{ textAlign: "center" }}>
              <p
                style={{
                  fontSize: "1.2rem",
                  fontWeight: 700,
                  color: "#111827",
                  margin: "0 0 6px",
                }}
              >
                Your conversation starts here
              </p>
              <p style={{ fontSize: "0.9rem", color: "#9ca3af", margin: 0 }}>
                Ask anything about this lesson.
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          const firstAssistantIndex = messages.findIndex(
            (m) => m.role === "assistant"
          );

          const isFirstAssistantMessage =
            msg.role === "assistant" && firstAssistantIndex === i;

          const displayContent =
            isFirstAssistantMessage && animatedChatId === chatId
              ? animatedFirstMessage
              : msg.content;

          return (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              {msg.role === "assistant" && (
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    background: "linear-gradient(135deg, #f97316, #ec4899)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    marginRight: 10,
                    marginTop: 2,
                  }}
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  </svg>
                </div>
              )}

              <div
                style={{
                  maxWidth: "75%",
                  padding: "12px 16px",
                  borderRadius:
                    msg.role === "user"
                      ? "18px 18px 4px 18px"
                      : "18px 18px 18px 4px",
                  background:
                    msg.role === "user"
                      ? "linear-gradient(135deg, #f97316, #ec4899)"
                      : "#fff",
                  color: msg.role === "user" ? "#fff" : "#111827",
                  fontSize: "0.92rem",
                  lineHeight: 1.65,
                  boxShadow:
                    msg.role === "user"
                      ? "0 4px 14px rgba(249,115,22,0.3)"
                      : "0 1px 6px rgba(0,0,0,0.06)",
                  border: msg.role === "assistant" ? "1px solid #f3f4f6" : "none",
                }}
              >
                {displayContent ? (
                  msg.role === "user" ? (
                    <p style={{ margin: 0 }}>{displayContent}</p>
                  ) : (
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => (
                          <p style={{ margin: "0.35rem 0", lineHeight: 1.65 }}>
                            {children}
                          </p>
                        ),
                        h1: ({ children }) => (
                          <h1
                            style={{
                              fontSize: "1.1rem",
                              fontWeight: 700,
                              margin: "0.7rem 0 0.35rem",
                              color: "#111827",
                            }}
                          >
                            {children}
                          </h1>
                        ),
                        h2: ({ children }) => (
                          <h2
                            style={{
                              fontSize: "1rem",
                              fontWeight: 700,
                              margin: "0.7rem 0 0.35rem",
                              color: "#111827",
                            }}
                          >
                            {children}
                          </h2>
                        ),
                        h3: ({ children }) => (
                          <h3
                            style={{
                              fontSize: "0.92rem",
                              fontWeight: 700,
                              margin: "0.5rem 0 0.25rem",
                              color: "#111827",
                            }}
                          >
                            {children}
                          </h3>
                        ),
                        ul: ({ children }) => (
                          <ul style={{ paddingLeft: "1.3rem", margin: "0.35rem 0" }}>
                            {children}
                          </ul>
                        ),
                        ol: ({ children }) => (
                          <ol style={{ paddingLeft: "1.3rem", margin: "0.35rem 0" }}>
                            {children}
                          </ol>
                        ),
                        li: ({ children }) => (
                          <li style={{ marginBottom: "0.2rem" }}>{children}</li>
                        ),
                        code: ({ children }) => (
                          <code
                            style={{
                              background: "#f3f4f6",
                              padding: "0.12rem 0.35rem",
                              borderRadius: 6,
                              fontSize: "0.85rem",
                              fontFamily: "monospace",
                              color: "#374151",
                            }}
                          >
                            {children}
                          </code>
                        ),
                        pre: ({ children }) => (
                          <pre
                            style={{
                              background: "#f8fafc",
                              border: "1px solid #e5e7eb",
                              padding: "0.75rem 1rem",
                              borderRadius: 10,
                              overflowX: "auto",
                              fontSize: "0.85rem",
                              margin: "0.5rem 0",
                            }}
                          >
                            {children}
                          </pre>
                        ),
                        strong: ({ children }) => (
                          <strong style={{ fontWeight: 700, color: "#111827" }}>
                            {children}
                          </strong>
                        ),
                        em: ({ children }) => (
                          <em style={{ fontStyle: "italic" }}>{children}</em>
                        ),
                      }}
                    >
                      {displayContent}
                    </ReactMarkdown>
                  )
                ) : streaming && i === messages.length - 1 ? (
                  <span style={{ color: "#9ca3af", fontSize: "1.2rem" }}>▌</span>
                ) : null}
              </div>
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        style={{
          padding: "1rem 1.5rem",
          background: "#fff",
          borderTop: "1px solid #f3f4f6",
        }}
      >
        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 10,
            background: "#f8fafc",
            borderRadius: 20,
            border: "1.5px solid #e5e7eb",
            padding: "8px 8px 8px 16px",
            transition: "border-color 0.15s",
          }}
        >
          <textarea
            placeholder="Ask something about this lesson…"
            value={input}
            rows={1}
            disabled={streaming}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e as any);
              }
            }}
            style={{
              flex: 1,
              resize: "none",
              border: "none",
              background: "transparent",
              outline: "none",
              fontSize: "0.95rem",
              color: "#111827",
              fontFamily: "inherit",
              lineHeight: 1.5,
              maxHeight: 120,
              padding: "4px 0",
            }}
          />

          <button
            type="submit"
            disabled={streaming || !input.trim()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 14,
              border: "none",
              background:
                streaming || !input.trim()
                  ? "#e5e7eb"
                  : "linear-gradient(135deg, #f97316, #ec4899)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: streaming || !input.trim() ? "not-allowed" : "pointer",
              flexShrink: 0,
              transition: "all 0.15s",
              boxShadow:
                streaming || !input.trim()
                  ? "none"
                  : "0 4px 14px rgba(249,115,22,0.35)",
            }}
          >
            {streaming ? (
              <div
                style={{
                  width: 16,
                  height: 16,
                  border: "2px solid #9ca3af",
                  borderTopColor: "transparent",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }}
              />
            ) : (
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#fff"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
        </form>

        <p
          style={{
            fontSize: "0.72rem",
            color: "#9ca3af",
            textAlign: "center",
            marginTop: 8,
          }}
        >
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}