import { useEffect, useState } from "react";
const API_BASE_URL = "http://127.0.0.1:8011/api";

interface StruggleItem {
  id: number;
  course_id: string;
  course_name: string;
  section_name: string;
  question_count: number;
  keywords: string[];
  created_at: string;
}

interface AnalyticsData {
  struggles: StruggleItem[];
  total_questions: number;
  hours: number;
}

function HeatBar({ count, max }: { count: number; max: number }) {
  const pct = max > 0 ? Math.max(8, (count / max) * 100) : 8;
  const color =
    pct > 66
      ? "linear-gradient(90deg,#ef4444,#f97316)"
      : pct > 33
      ? "linear-gradient(90deg,#f97316,#fbbf24)"
      : "linear-gradient(90deg,#fbbf24,#84cc16)";

  return (
    <div
      style={{
        height: 6,
        borderRadius: 99,
        background: "#f1f5f9",
        overflow: "hidden",
        marginTop: 6,
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          borderRadius: 99,
          background: color,
          transition: "width 0.6s ease",
        }}
      />
    </div>
  );
}

export default function StudentInsightsWidget({ darkMode }: { darkMode: boolean }) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_BASE_URL}/analytics/struggles?hours=24`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setData(await res.json());
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 60000); // Her 1 dakikada refresh
    return () => clearInterval(interval);
  }, []);

  const bg = darkMode ? "rgba(15,23,42,0.8)" : "#ffffff";
  const border = darkMode ? "rgba(249,115,22,0.2)" : "#fed7aa";
  const textPrimary = darkMode ? "#f1f5f9" : "#111827";
  const textSecondary = darkMode ? "#94a3b8" : "#6b7280";
  const rowBg = darkMode ? "rgba(255,255,255,0.04)" : "#fafafa";
  const rowBorder = darkMode ? "rgba(255,255,255,0.06)" : "#f3f4f6";

  if (loading) {
    return (
      <div
        style={{
          background: bg,
          border: `1px solid ${border}`,
          borderRadius: 16,
          padding: "1.25rem 1.5rem",
          marginBottom: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "linear-gradient(135deg,#f97316,#ec4899)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: "1rem" }}>📊</span>
          </div>
          <div style={{ fontSize: "0.92rem", fontWeight: 700, color: textPrimary }}>
            Student Insights
          </div>
          <div
            style={{
              marginLeft: "auto",
              width: 60,
              height: 8,
              borderRadius: 99,
              background: darkMode ? "#334155" : "#e5e7eb",
              animation: "pulse 1.5s infinite",
            }}
          />
        </div>
      </div>
    );
  }

  if (!data || data.struggles.length === 0) {
    return (
      <div
        style={{
          background: bg,
          border: `1px solid ${border}`,
          borderRadius: 16,
          padding: "1.25rem 1.5rem",
          marginBottom: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "linear-gradient(135deg,#f97316,#ec4899)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: "1rem" }}>📊</span>
          </div>
          <div>
            <div style={{ fontSize: "0.92rem", fontWeight: 700, color: textPrimary }}>
              Student Insights
            </div>
            <div style={{ fontSize: "0.75rem", color: textSecondary }}>Last 24 hours</div>
          </div>
        </div>
        <div
          style={{
            marginTop: 16,
            padding: "12px 14px",
            borderRadius: 10,
            background: darkMode ? "rgba(16,185,129,0.08)" : "#f0fdf4",
            border: `1px solid ${darkMode ? "rgba(16,185,129,0.2)" : "#bbf7d0"}`,
            fontSize: "0.84rem",
            color: darkMode ? "#6ee7b7" : "#166534",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>✅</span>
          No struggle alerts in the last 24 hours — students are doing well!
        </div>
      </div>
    );
  }

  const maxCount = Math.max(...data.struggles.map((s) => s.question_count));

  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 16,
        marginBottom: 24,
        overflow: "hidden",
        boxShadow: "0 4px 24px rgba(249,115,22,0.08)",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "1rem 1.25rem",
          display: "flex",
          alignItems: "center",
          gap: 10,
          borderBottom: expanded ? `1px solid ${border}` : "none",
          cursor: "pointer",
        }}
        onClick={() => setExpanded((e) => !e)}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "linear-gradient(135deg,#f97316,#ec4899)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: "1rem" }}>📊</span>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "0.92rem", fontWeight: 700, color: textPrimary }}>
            Student Insights
          </div>
          <div style={{ fontSize: "0.73rem", color: textSecondary }}>
            {data.struggles.length} section{data.struggles.length !== 1 ? "s" : ""} with confusion
            · {data.total_questions} questions · last {data.hours}h
          </div>
        </div>

        {/* Flame badges */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {data.struggles.slice(0, 3).map((s, i) => (
            <div
              key={i}
              style={{
                padding: "2px 8px",
                borderRadius: 99,
                background:
                  s.question_count >= maxCount * 0.66
                    ? "rgba(239,68,68,0.12)"
                    : "rgba(249,115,22,0.1)",
                color:
                  s.question_count >= maxCount * 0.66 ? "#ef4444" : "#f97316",
                fontSize: "0.72rem",
                fontWeight: 700,
              }}
            >
              🔥 {s.question_count}
            </div>
          ))}
        </div>

        <div
          style={{
            color: textSecondary,
            fontSize: "0.8rem",
            transition: "transform 0.2s",
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          ▾
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div style={{ padding: "0.75rem 1rem" }}>
          {data.struggles.map((item, i) => (
            <div
              key={item.id}
              style={{
                padding: "0.75rem 0.85rem",
                borderRadius: 10,
                background: rowBg,
                border: `1px solid ${rowBorder}`,
                marginBottom: i < data.struggles.length - 1 ? 8 : 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                {/* Rank badge */}
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 8,
                    background:
                      i === 0
                        ? "linear-gradient(135deg,#ef4444,#f97316)"
                        : i === 1
                        ? "linear-gradient(135deg,#f97316,#fbbf24)"
                        : "linear-gradient(135deg,#fbbf24,#84cc16)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontSize: "0.72rem",
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div>
                      <span style={{ fontSize: "0.88rem", fontWeight: 700, color: textPrimary }}>
                        {item.section_name}
                      </span>
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: "0.72rem",
                          color: textSecondary,
                          fontWeight: 500,
                        }}
                      >
                        {item.course_name}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "0.82rem",
                        fontWeight: 800,
                        color: item.question_count >= maxCount * 0.66 ? "#ef4444" : "#f97316",
                        flexShrink: 0,
                      }}
                    >
                      {item.question_count} questions
                    </div>
                  </div>

                  <HeatBar count={item.question_count} max={maxCount} />

                  {item.keywords.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                      {item.keywords.map((kw, ki) => (
                        <span
                          key={ki}
                          style={{
                            padding: "2px 8px",
                            borderRadius: 99,
                            background: darkMode ? "rgba(249,115,22,0.12)" : "#fff7ed",
                            border: `1px solid ${darkMode ? "rgba(249,115,22,0.2)" : "#fed7aa"}`,
                            color: "#f97316",
                            fontSize: "0.7rem",
                            fontWeight: 600,
                          }}
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          <div
            style={{
              marginTop: 10,
              fontSize: "0.7rem",
              color: textSecondary,
              textAlign: "right",
            }}
          >
            Auto-refreshes every minute
          </div>
        </div>
      )}
    </div>
  );
}
