import { useState } from "react";
import type { User } from "../types";

interface AuthPageProps {
  onLogin: (user: User) => void;
}

type Tab = "login" | "signup";
type Role = "student" | "teacher";

// Küçük API çağrıları — api.ts'den import da edilebilir
import { auth as authApi, token as tokenStore } from "../services/api";

export default function AuthPage({ onLogin }: AuthPageProps) {
  const [tab, setTab]         = useState<Tab>("login");
  const [role, setRole]       = useState<Role>("student");
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // Login state
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");

  // Signup state
  const [fullName,     setFullName]     = useState("");
  const [signupUser,   setSignupUser]   = useState("");
  const [signupPass,   setSignupPass]   = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await authApi.login(loginUser.trim(), loginPass);
      tokenStore.set(res.access_token);
      onLogin(res.user);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccess(""); setLoading(true);
    try {
      await authApi.signup(fullName.trim(), signupUser.trim(), signupPass, role);
      setSuccess(`Account created as ${role}! You can now log in.`);
      setTab("login");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center" }}>
      {/* Hero */}
      <div style={{ textAlign: "center", padding: "44px 0 28px" }}>
        <span className="badge badge-orange" style={{ marginBottom: 16 }}>✦ Welcome</span>
        <h1 style={{ fontSize: "2.5rem", color: "var(--text)", marginBottom: 10 }}>Learning Assistant</h1>
        <p style={{ color: "var(--text-soft)", maxWidth: 340, margin: "0 auto" }}>
          Sign in to continue, or create a new account as a student or teacher.
        </p>
      </div>

      {/* Card */}
      <div className="card" style={{ width: "100%", maxWidth: 440, padding: "0 2rem 2.5rem" }}>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1.5px solid var(--line)", marginBottom: "1.5rem" }}>
          {(["login", "signup"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(""); setSuccess(""); }}
              style={{
                flex: 1, padding: "10px 0", background: "transparent", border: "none",
                borderBottom: tab === t ? "2.5px solid var(--orange)" : "2.5px solid transparent",
                color: tab === t ? "var(--text)" : "var(--text-soft)",
                fontWeight: 600, fontSize: 14, cursor: "pointer",
                marginBottom: -1.5, transition: "color 0.15s",
              }}
            >
              {t === "login" ? "Login" : "Sign Up"}
            </button>
          ))}
        </div>

        {error   && <div className="alert alert-error"   style={{ marginBottom: 12 }}>{error}</div>}
        {success && <div className="alert alert-success" style={{ marginBottom: 12 }}>{success}</div>}

        {tab === "login" ? (
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.15rem", fontWeight: 600 }}>
              Welcome back 👋
            </div>
            <p style={{ fontSize: 13, color: "var(--text-soft)", marginTop: -8 }}>
              Enter your credentials to continue learning.
            </p>

            <div>
              <label className="label">Username</label>
              <input className="input" placeholder="your_username" value={loginUser} onChange={(e) => setLoginUser(e.target.value)} required />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" placeholder="••••••••" value={loginPass} onChange={(e) => setLoginPass(e.target.value)} required />
            </div>

            <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: "100%", justifyContent: "center", padding: "0.75rem", marginTop: 4 }}>
              {loading ? "Signing in…" : "Sign In →"}
            </button>
            <p style={{ textAlign: "center", fontSize: 12.5, color: "var(--text-muted)" }}>
              Don't have an account? Switch to Sign Up ↑
            </p>
          </form>
        ) : (
          <form onSubmit={handleSignup} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.15rem", fontWeight: 600 }}>
              Create your account
            </div>
            <p style={{ fontSize: 13, color: "var(--text-soft)", marginTop: -8 }}>
              Join as a student or teacher and start learning.
            </p>

            {/* Rol seçimi */}
            <div>
              <span className="label">I am a...</span>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {(["student", "teacher"] as Role[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    style={{
                      padding: "14px 16px", borderRadius: 16, textAlign: "left",
                      border: `1.5px solid ${role === r ? "var(--orange)" : "var(--line)"}`,
                      background: role === r ? "var(--orange-lt)" : "#FDFAF7",
                      color: role === r ? "var(--orange)" : "var(--text)",
                      fontWeight: 700, fontSize: 14, cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {r === "student" ? "🎓  Student\n" : "🏫  Teacher\n"}
                    <span style={{ fontWeight: 400, fontSize: 12, color: "inherit", opacity: 0.8 }}>
                      {r === "student" ? "Learn & explore" : "Create & teach"}
                    </span>
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--orange)", marginTop: 8, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                ✓ Continuing as {role === "student" ? "Student" : "Teacher"}
              </p>
            </div>

            <div>
              <label className="label">Full Name</label>
              <input className="input" placeholder="Ada Lovelace" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div>
              <label className="label">Username</label>
              <input className="input" placeholder="ada_loves_math" value={signupUser} onChange={(e) => setSignupUser(e.target.value)} required />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" placeholder="••••••••" value={signupPass} onChange={(e) => setSignupPass(e.target.value)} required />
            </div>

            <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: "100%", justifyContent: "center", padding: "0.75rem", marginTop: 4 }}>
              {loading ? "Creating…" : `Create ${role === "student" ? "Student" : "Teacher"} Account →`}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
