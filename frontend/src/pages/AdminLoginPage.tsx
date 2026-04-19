import { useState } from "react";
import { adminLogin, getAdminToken } from "../services/api";
import { Navigate, useNavigate } from "react-router-dom";

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (getAdminToken()) return <Navigate to="/admin/dashboard" replace />;

  const handleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      await adminLogin(username, password);
      navigate("/admin/dashboard");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Admin Girişi</h2>

        <input
          style={styles.input}
          type="text"
          placeholder="Kullanıcı adı"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          style={styles.input}
          type="password"
          placeholder="Şifre"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
        />

        {error && <p style={styles.error}>{error}</p>}

        <button style={styles.button} onClick={handleLogin} disabled={loading}>
          {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#0f172a",
  },
  card: {
    background: "#1e293b",
    padding: "2.5rem",
    borderRadius: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    width: "360px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
  },
  title: {
    color: "#f1f5f9",
    textAlign: "center",
    marginBottom: "0.5rem",
    fontSize: "1.5rem",
  },
  input: {
    padding: "0.75rem 1rem",
    borderRadius: "8px",
    border: "1px solid #334155",
    background: "#0f172a",
    color: "#f1f5f9",
    fontSize: "1rem",
    outline: "none",
  },
  button: {
    padding: "0.75rem",
    borderRadius: "8px",
    background: "#6366f1",
    color: "white",
    border: "none",
    fontSize: "1rem",
    cursor: "pointer",
    marginTop: "0.5rem",
  },
  error: {
    color: "#f87171",
    textAlign: "center",
    fontSize: "0.875rem",
  },
};