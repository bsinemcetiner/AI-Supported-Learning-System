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

export default function ChatPage({ chatId, chat, streaming, onSend, onRegenerate, onBack }: ChatPageProps) {
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
    ? chat.course_id.split("::")[1] ?? chat.course_id
    : null;

  return (
    <div className="chat-layout">

      {/* Header */}
      <div style={{
        padding: "1rem 1.5rem",
        borderBottom: "1.5px solid var(--line)",
        background: "var(--card)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 38, height: 38,
            background: "var(--orange-lt)",
            border: "1.5px solid var(--orange-md)",
            borderRadius: "var(--r-md)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1.1rem",
          }}>💬</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text)" }}>
              {chat.title || "Learning Chat"}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-soft)", marginTop: 1 }}>
              {courseLabel && <span>📚 {courseLabel} · </span>}
              <span style={{ color: "var(--orange)", fontWeight: 600 }}>{chat.mode}</span>
              {" · "}{chat.tone}
            </div>
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>← Back</button>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 && (
          <div style={{ textAlign: "center", padding: "4rem 1rem", color: "var(--text-soft)" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 10 }}>✨</div>
            <p style={{ fontWeight: 600, color: "var(--text-mid)", marginBottom: 4 }}>Your conversation starts here</p>
            <p style={{ fontSize: "0.85rem" }}>Ask anything about this lesson.</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`message-bubble ${msg.role}`}>
            {msg.content ? (
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p style={{ margin: "0.35rem 0", lineHeight: 1.65 }}>{children}</p>,
                  h1: ({ children }) => <h1 style={{ fontSize: "1.15rem", fontWeight: 700, margin: "0.7rem 0 0.35rem" }}>{children}</h1>,
                  h2: ({ children }) => <h2 style={{ fontSize: "1rem", fontWeight: 700, margin: "0.7rem 0 0.35rem" }}>{children}</h2>,
                  h3: ({ children }) => <h3 style={{ fontSize: "0.92rem", fontWeight: 700, margin: "0.5rem 0 0.25rem" }}>{children}</h3>,
                  ul: ({ children }) => <ul style={{ paddingLeft: "1.3rem", margin: "0.35rem 0" }}>{children}</ul>,
                  ol: ({ children }) => <ol style={{ paddingLeft: "1.3rem", margin: "0.35rem 0" }}>{children}</ol>,
                  li: ({ children }) => <li style={{ marginBottom: "0.2rem" }}>{children}</li>,
                  code: ({ children }) => (
                    <code style={{ background: "var(--bg3)", padding: "0.12rem 0.35rem", borderRadius: 4, fontSize: "0.85rem", fontFamily: "monospace" }}>
                      {children}
                    </code>
                  ),
                  pre: ({ children }) => (
                    <pre style={{ background: "var(--bg3)", padding: "0.7rem 1rem", borderRadius: 8, overflowX: "auto", fontSize: "0.85rem", margin: "0.5rem 0" }}>
                      {children}
                    </pre>
                  ),
                  table: ({ children }) => <table style={{ borderCollapse: "collapse", width: "100%", margin: "0.5rem 0", fontSize: "0.85rem" }}>{children}</table>,
                  th: ({ children }) => <th style={{ border: "1px solid var(--line)", padding: "0.35rem 0.6rem", background: "var(--bg2)", fontWeight: 700, textAlign: "left" }}>{children}</th>,
                  td: ({ children }) => <td style={{ border: "1px solid var(--line)", padding: "0.35rem 0.6rem" }}>{children}</td>,
                  strong: ({ children }) => <strong style={{ fontWeight: 700 }}>{children}</strong>,
                  em: ({ children }) => <em style={{ fontStyle: "italic" }}>{children}</em>,
                  hr: () => <hr style={{ border: "none", borderTop: "1px solid var(--line)", margin: "0.7rem 0" }} />,
                }}
              >
                {msg.content}
              </ReactMarkdown>
            ) : (
              streaming && i === messages.length - 1
                ? <span style={{ color: "var(--text-muted)" }}>▌</span>
                : null
            )}
          </div>
        ))}

        {hasExchange && !streaming && (
          <div>
            <button className="btn btn-ghost btn-sm" onClick={onRegenerate}>
              🔄 Regenerate
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
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
          style={{ flex: 1, resize: "none", lineHeight: 1.5, maxHeight: 120 }}
        />
        <button
          className="btn btn-primary"
          type="submit"
          disabled={streaming || !input.trim()}
        >
          {streaming ? "…" : "Send →"}
        </button>
      </form>
    </div>
  );
}
