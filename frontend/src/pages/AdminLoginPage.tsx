import { useState } from "react";
import { adminLogin, getAdminToken } from "../services/api";
import { Navigate, useNavigate } from "react-router-dom";
import { LassieLogo } from "../components/LassieLogo";

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (getAdminToken()) return <Navigate to="/admin/dashboard" replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // Send email as "username" field — backend accepts both email and username
      await adminLogin(email.trim(), password);
      navigate("/admin/dashboard");
    } catch {
      setError("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  const inputCss: React.CSSProperties = {
    width: "100%",
    padding: "14px 16px",
    border: "1.5px solid #e5e7eb",
    borderRadius: 14,
    fontSize: "1rem",
    color: "#111827",
    fontFamily: "inherit",
    outline: "none",
    background: "#f9fafb",
    boxSizing: "border-box",
    transition: "border-color 0.15s, background 0.15s",
  };

  const labelCss: React.CSSProperties = {
    display: "block",
    fontSize: "0.72rem",
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "#9ca3af",
    marginBottom: 8,
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #fff0eb 0%, #fde8f0 50%, #f0e8ff 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1rem",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background blobs */}
      <div style={{ position: "fixed", top: -200, right: -200, width: 600, height: 600, background: "radial-gradient(circle, rgba(249,115,22,0.12), transparent)", borderRadius: "50%", pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: -200, left: -200, width: 600, height: 600, background: "radial-gradient(circle, rgba(167,139,250,0.12), transparent)", borderRadius: "50%", pointerEvents: "none" }} />

      <div
        style={{
          width: "100%",
          maxWidth: 460,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Logo */}
        <div style={{ marginBottom: "1.25rem" }}>
          <LassieLogo size={86} radius={26} />
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: "4rem",
            fontWeight: 800,
            background: "linear-gradient(135deg, #f97316, #ec4899, #8b5cf6)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            margin: "0 0 0.4rem",
            letterSpacing: "-0.04em",
            lineHeight: 1,
            textAlign: "center",
          }}
        >
          LASSIE
        </h1>
        <p
          style={{
            fontSize: "1.05rem",
            fontWeight: 600,
            color: "#374151",
            margin: "0 0 2rem",
            textAlign: "center",
          }}
        >
          Learning Assistant System for Integrated Education
        </p>

        {/* Card */}
        <div
          style={{
            width: "100%",
            background: "rgba(255,255,255,0.92)",
            backdropFilter: "blur(20px)",
            borderRadius: 28,
            border: "1px solid rgba(255,255,255,0.8)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.1)",
            padding: "2rem",
          }}
        >
          {/* Shield icon + heading */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "1.75rem" }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: "linear-gradient(135deg, #f97316, #ec4899)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 14,
                boxShadow: "0 8px 24px rgba(249,115,22,0.3)",
              }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <h2 style={{ fontSize: "1.45rem", fontWeight: 700, color: "#111827", margin: "0 0 4px", textAlign: "center" }}>
              Admin Portal
            </h2>
            <p style={{ fontSize: "0.88rem", color: "#6b7280", margin: 0, textAlign: "center" }}>
              Restricted access — authorized admins only
            </p>
          </div>

          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {error && (
              <div
                style={{
                  padding: "12px 16px",
                  borderRadius: 12,
                  background: "#fff1f2",
                  border: "1px solid #fecdd3",
                  color: "#e11d48",
                  fontSize: "0.88rem",
                  fontWeight: 500,
                }}
              >
                {error}
              </div>
            )}

            <div>
              <label style={labelCss}>Admin Email</label>
              <input
                style={inputCss}
                type="email"
                placeholder="admin@lassie.edu.tr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                onFocus={(e) => { e.target.style.borderColor = "#f97316"; e.target.style.background = "#fff"; }}
                onBlur={(e) => { e.target.style.borderColor = "#e5e7eb"; e.target.style.background = "#f9fafb"; }}
              />
            </div>

            <div>
              <label style={labelCss}>Password</label>
              <input
                style={inputCss}
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                onFocus={(e) => { e.target.style.borderColor = "#f97316"; e.target.style.background = "#fff"; }}
                onBlur={(e) => { e.target.style.borderColor = "#e5e7eb"; e.target.style.background = "#f9fafb"; }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "16px",
                background: loading
                  ? "#e5e7eb"
                  : "linear-gradient(135deg, #f97316, #ec4899)",
                color: loading ? "#9ca3af" : "#fff",
                border: "none",
                borderRadius: 16,
                fontSize: "1.05rem",
                fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                boxShadow: loading ? "none" : "0 4px 20px rgba(249,115,22,0.3)",
                marginTop: 6,
                transition: "all 0.2s",
              }}
            >
              {loading ? "Signing in…" : "Sign In →"}
            </button>
          </form>
        </div>

        {/* Back link */}
        <button
          onClick={() => navigate("/")}
          style={{
            background: "none",
            border: "none",
            color: "#9ca3af",
            fontSize: "0.85rem",
            cursor: "pointer",
            marginTop: 20,
            opacity: 0.7,
            fontFamily: "inherit",
          }}
        >
          ← Back to Login
        </button>
      </div>
    </div>
  );
}
