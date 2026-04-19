import { useState } from "react";
import type { User } from "../types";
import { auth as authApi, token as tokenStore } from "../services/api";

interface AuthPageProps {
  onLogin: (user: User) => void;
}

type Tab = "login" | "signup";
type Role = "student" | "teacher";

export default function AuthPage({ onLogin }: AuthPageProps) {
  const [tab, setTab]     = useState<Tab>("login");
  const [role, setRole]   = useState<Role>("student");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [fullName, setFullName]   = useState("");
  const [signupUser, setSignupUser] = useState("");
  const [signupPass, setSignupPass] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await authApi.login(loginUser.trim(), loginPass);
      tokenStore.set(res.access_token);
      onLogin(res.user);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccess(""); setLoading(true);
    try {
      await authApi.signup(fullName.trim(), signupUser.trim(), signupPass, role);
      setSuccess(`Account created! You can now log in.`);
      setTab("login");
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "2rem 1rem",
    }}>
      <div style={{ width: "100%", maxWidth: 420 }}>

        {/* Logo / Hero */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{
            width: 56, height: 56,
            background: "var(--orange)",
            borderRadius: "var(--r-lg)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1.6rem", margin: "0 auto 1rem",
            boxShadow: "var(--shadow-orange)",
          }}>🎓</div>
          <h1 style={{ fontSize: "1.8rem", marginBottom: 6 }}>Learning Assistant</h1>
          <p style={{ color: "var(--text-soft)", fontSize: "0.9rem" }}>
            AI-powered personalized learning platform
          </p>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: "1.75rem" }}>

          {/* Tabs */}
          <div className="tab-bar" style={{ marginBottom: "1.25rem" }}>
            {(["login", "signup"] as Tab[]).map((t) => (
              <button
                key={t}
                className={`tab-btn ${tab === t ? "active" : ""}`}
                onClick={() => { setTab(t); setError(""); setSuccess(""); }}
              >
                {t === "login" ? "Sign In" : "Sign Up"}
              </button>
            ))}
          </div>

          {error   && <div className="alert alert-error"   style={{ marginBottom: 14 }}>{error}</div>}
          {success && <div className="alert alert-success" style={{ marginBottom: 14 }}>{success}</div>}

          {tab === "login" ? (
            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <p style={{ fontFamily: "'Fraunces', serif", fontSize: "1.1rem", fontWeight: 600, marginBottom: 4 }}>
                  Welcome back 👋
                </p>
                <p style={{ fontSize: "0.83rem", color: "var(--text-soft)" }}>
                  Enter your credentials to continue.
                </p>
              </div>
              <div>
                <label className="label">Username</label>
                <input className="input" placeholder="your_username" value={loginUser} onChange={(e) => setLoginUser(e.target.value)} required />
              </div>
              <div>
                <label className="label">Password</label>
                <input className="input" type="password" placeholder="••••••••" value={loginPass} onChange={(e) => setLoginPass(e.target.value)} required />
              </div>
              <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: "100%", padding: "0.7rem", marginTop: 4 }}>
                {loading ? "Signing in…" : "Sign In →"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignup} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <p style={{ fontFamily: "'Fraunces', serif", fontSize: "1.1rem", fontWeight: 600, marginBottom: 4 }}>
                  Create your account
                </p>
                <p style={{ fontSize: "0.83rem", color: "var(--text-soft)" }}>
                  Join as a student or teacher.
                </p>
              </div>

              {/* Role seçimi */}
              <div>
                <label className="label">I am a...</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {(["student", "teacher"] as Role[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      style={{
                        padding: "12px 14px",
                        borderRadius: "var(--r-md)",
                        textAlign: "left",
                        border: `1.5px solid ${role === r ? "var(--orange)" : "var(--line)"}`,
                        background: role === r ? "var(--orange-lt)" : "var(--bg2)",
                        color: role === r ? "var(--orange)" : "var(--text-mid)",
                        fontWeight: 700,
                        fontSize: "0.875rem",
                        cursor: "pointer",
                        transition: "all 0.15s",
                        fontFamily: "inherit",
                      }}
                    >
                      <div style={{ fontSize: "1.1rem", marginBottom: 2 }}>
                        {r === "student" ? "🎓" : "🏫"}
                      </div>
                      <div>{r === "student" ? "Student" : "Teacher"}</div>
                      <div style={{ fontWeight: 400, fontSize: "0.75rem", opacity: 0.8, marginTop: 1 }}>
                        {r === "student" ? "Learn & explore" : "Create & teach"}
                      </div>
                    </button>
                  ))}
                </div>
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

              <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: "100%", padding: "0.7rem", marginTop: 4 }}>
                {loading ? "Creating…" : `Create ${role === "student" ? "Student" : "Teacher"} Account →`}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
