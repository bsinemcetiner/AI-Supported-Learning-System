import { useEffect, useRef, useState } from "react";
import { notifications as notificationsApi } from "../../services/api";
import type { NotificationItem } from "../../types";

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

    async function loadNotifications() {
      try {
        setLoading(true);
        const data = await notificationsApi.getAll();

        const normalized = data.notifications.map((n: any) => ({
          id: String(n.id),
          title: n.title,
          message: n.message || n.title || "New notification",
          type: n.type,
          is_read: n.is_read ?? false,
          created_at: n.created_at,
        }));

        setItems(normalized);
      } catch (err) {
        console.error("Notification fetch error:", err);
      } finally {
        setLoading(false);
      }
    }

  async function markAllAsRead() {
    const hasUnread = items.some((n) => !n.is_read);
    if (!hasUnread) return;

    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));

    try {
      await notificationsApi.markAllRead();
    } catch (err) {
      console.error("Mark notifications as read error:", err);
      loadNotifications();
    }
  }

  async function handleBellClick() {
    const nextOpen = !open;
    setOpen(nextOpen);

    if (nextOpen) {
      await markAllAsRead();
    }
  }

  useEffect(() => {
    loadNotifications();

    const interval = window.setInterval(loadNotifications, 15000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = items.filter((n) => !n.is_read).length;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={handleBellClick}
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          border: "1px solid #e5e7eb",
          background: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          position: "relative",
          boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
        }}
        aria-label="Notifications"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#374151"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {unreadCount > 0 && (
          <div
            style={{
              position: "absolute",
              top: -5,
              right: -5,
              minWidth: 18,
              height: 18,
              padding: "0 5px",
              borderRadius: 999,
              background: "#ef4444",
              color: "#fff",
              fontSize: 10,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid #fff",
              boxSizing: "border-box",
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </div>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 10px)",
            right: 0,
            width: 320,
            background: "#fff",
            borderRadius: 16,
            border: "1px solid #f3f4f6",
            boxShadow: "0 14px 36px rgba(15,23,42,0.14)",
            overflow: "hidden",
            zIndex: 999,
            animation: "notificationSlideDown 0.18s ease-out",
          }}
        >
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid #f3f4f6",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "#fafafa",
            }}
          >
            <span style={{ fontWeight: 800, fontSize: "0.88rem", color: "#111827" }}>
              Notifications
            </span>

            <button
              onClick={markAllAsRead}
              style={{
                border: "none",
                background: "transparent",
                color: "#f97316",
                fontSize: "0.72rem",
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Read all
            </button>
          </div>

          <div style={{ maxHeight: 320, overflowY: "auto" }}>
            {loading && items.length === 0 ? (
              <div
                style={{
                  padding: "28px 16px",
                  textAlign: "center",
                  color: "#9ca3af",
                  fontSize: "0.82rem",
                }}
              >
                Loading notifications…
              </div>
            ) : items.length > 0 ? (
              items.map((n) => (
                <div
                  key={n.id}
                  style={{
                    padding: "12px 16px",
                    borderBottom: "1px solid #f8fafc",
                    background: n.is_read ? "#fff" : "#fff7ed",
                  }}
                >
                  {n.title && (
                    <p
                      style={{
                        margin: "0 0 4px",
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        color: "#111827",
                      }}
                    >
                      {n.title}
                    </p>
                  )}

                  <p
                    style={{
                      margin: "0 0 5px",
                      fontSize: "0.82rem",
                      color: "#374151",
                      lineHeight: 1.45,
                    }}
                  >
                    {n.message}
                  </p>

                  <p style={{ margin: 0, fontSize: "0.7rem", color: "#9ca3af" }}>
                    {n.created_at ? new Date(n.created_at).toLocaleString() : ""}
                  </p>
                </div>
              ))
            ) : (
              <div
                style={{
                  padding: "30px 16px",
                  textAlign: "center",
                  color: "#9ca3af",
                  fontSize: "0.82rem",
                }}
              >
                No notifications yet
              </div>
            )}
          </div>
        </div>
      )}

      <style>
        {`
          @keyframes notificationSlideDown {
            from {
              opacity: 0;
              transform: translateY(-8px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}
      </style>
    </div>
  );
}