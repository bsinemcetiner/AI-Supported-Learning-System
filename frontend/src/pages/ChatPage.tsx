import { useRef, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { Chat } from "../types";

interface ChatPageProps {
  chatId: string;
  chat: Chat;
  streaming: boolean;
  onSend: (content: string) => void;
  onRegenerate: () => void;
  onBack: () => void;
}

export default function ChatPage({
  chatId,
  chat,
  streaming,
  onSend,
  onRegenerate,
  onBack,
}: ChatPageProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const messages = chat.messages ?? [];
  const hasExchange =
    messages.length >= 2 &&
    messages.at(-1)?.role === "assistant" &&
    messages.at(-2)?.role === "user";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, messages.at(-1)?.content]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const val = input.trim();
    if (!val || streaming) return;
    setInput("");
    onSend(val);
  }

  const courseLabel = chat.course_id
    ? `📚 ${chat.course_id.split("::")[1] ?? chat.course_id}`
    : "No course selected";

  const lessonLabel = chat.lesson_id
    ? `🗂 ${chat.title || chat.lesson_id}`
    : null;

  return (
    <div className="chat-layout">
      <div
        style={{
          padding: "1.25rem 2rem 1rem",
          borderBottom: "1.5px solid var(--line)",
          background: "var(--card)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
          <div className="title-accent" style={{ marginBottom: "0.5rem" }} />
          <h1 style={{ fontSize: "1.5rem" }}>💬 Learning Chat</h1>
          <p style={{ fontSize: "0.85rem", color: "var(--text-soft)", marginTop: 2 }}>
            {lessonLabel ? `${lessonLabel} · ${courseLabel}` : courseLabel}
            &nbsp;·&nbsp;
            <span style={{ color: "var(--orange)", fontWeight: 600 }}>{chat.mode}</span>
            &nbsp;·&nbsp; {chat.tone}
          </p>
          <p style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: 4 }}>
            Chat ID: {chatId}
          </p>
        </div>

        <button className="btn btn-ghost" onClick={onBack} style={{ marginTop: 4 }}>
          ← Back
        </button>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--text-soft)" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>✨</div>
            <p style={{ fontWeight: 600, color: "var(--text-mid)" }}>Your conversation starts here</p>
            <p style={{ fontSize: "0.85rem" }}>Ask anything about this lesson.</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`message-bubble ${msg.role}`}>
            {msg.content ? (
              <ReactMarkdown
                components={{
                  p: ({ children }) => (
                    <p style={{ margin: "0.4rem 0", lineHeight: 1.65 }}>{children}</p>
                  ),
                  h1: ({ children }) => (
                    <h1 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0.75rem 0 0.4rem" }}>{children}</h1>
                  ),
                  h2: ({ children }) => (
                    <h2 style={{ fontSize: "1.05rem", fontWeight: 700, margin: "0.75rem 0 0.4rem" }}>{children}</h2>
                  ),
                  h3: ({ children }) => (
                    <h3 style={{ fontSize: "0.95rem", fontWeight: 700, margin: "0.5rem 0 0.3rem" }}>{children}</h3>
                  ),
                  ul: ({ children }) => (
                    <ul style={{ paddingLeft: "1.4rem", margin: "0.4rem 0" }}>{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol style={{ paddingLeft: "1.4rem", margin: "0.4rem 0" }}>{children}</ol>
                  ),
                  li: ({ children }) => (
                    <li style={{ marginBottom: "0.2rem" }}>{children}</li>
                  ),
                  code: ({ children }) => (
                    <code style={{
                      background: "var(--bg3)",
                      padding: "0.15rem 0.4rem",
                      borderRadius: 4,
                      fontSize: "0.88rem",
                      fontFamily: "monospace",
                    }}>{children}</code>
                  ),
                  pre: ({ children }) => (
                    <pre style={{
                      background: "var(--bg3)",
                      padding: "0.75rem 1rem",
                      borderRadius: 8,
                      overflowX: "auto",
                      fontSize: "0.88rem",
                      margin: "0.5rem 0",
                    }}>{children}</pre>
                  ),
                  table: ({ children }) => (
                    <table style={{
                      borderCollapse: "collapse",
                      width: "100%",
                      margin: "0.5rem 0",
                      fontSize: "0.88rem",
                    }}>{children}</table>
                  ),
                  th: ({ children }) => (
                    <th style={{
                      border: "1px solid var(--line)",
                      padding: "0.4rem 0.7rem",
                      background: "var(--bg2)",
                      fontWeight: 700,
                      textAlign: "left",
                    }}>{children}</th>
                  ),
                  td: ({ children }) => (
                    <td style={{
                      border: "1px solid var(--line)",
                      padding: "0.4rem 0.7rem",
                    }}>{children}</td>
                  ),
                  strong: ({ children }) => (
                    <strong style={{ fontWeight: 700 }}>{children}</strong>
                  ),
                  em: ({ children }) => (
                    <em style={{ fontStyle: "italic" }}>{children}</em>
                  ),
                  hr: () => (
                    <hr style={{ border: "none", borderTop: "1px solid var(--line)", margin: "0.75rem 0" }} />
                  ),
                }}
              >
                {msg.content}
              </ReactMarkdown>
            ) : (
              streaming && i === messages.length - 1 ? (
                <span style={{ color: "var(--text-muted)" }}>▌</span>
              ) : null
            )}
          </div>
        ))}

        {hasExchange && !streaming && (
          <div>
            <button className="btn btn-ghost" onClick={onRegenerate} style={{ fontSize: "0.82rem" }}>
              🔄 Regenerate
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <form className="chat-input-bar" onSubmit={handleSubmit}>
        <textarea
          className="input"
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
          style={{ flex: 1, resize: "none", lineHeight: 1.5 }}
        />
        <button
          className="btn btn-primary"
          type="submit"
          disabled={streaming || !input.trim()}
          style={{ whiteSpace: "nowrap" }}
        >
          {streaming ? "…" : "Send →"}
        </button>
      </form>
    </div>
  );
}
