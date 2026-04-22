import { useState, useRef } from "react";
import type { User } from "../types";
import { auth as authApi, token as tokenStore, adminLogin } from "../services/api";

interface AuthPageProps {
  onLogin: (user: User) => void;
  onAdminLogin: () => void;
}

type Tab = "login" | "signup";
type Role = "student" | "teacher";
type SignupStep = "email" | "otp" | "details" | "done";

function OtpBoxes({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const handleChange = (i: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const char = e.target.value.replace(/\D/, "").slice(-1);
    if (!char) return;
    const arr = value.padEnd(6, " ").split("");
    arr[i] = char;
    onChange(arr.join("").trimEnd());
    if (i < 5) inputs.current[i + 1]?.focus();
  };
  const handleKey = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace") {
      onChange(value.slice(0, Math.max(0, i)));
      if (i > 0) inputs.current[i - 1]?.focus();
    }
  };
  return (
    <div style={{ display: "flex", gap: 10, width: "100%" }}>
      {[0,1,2,3,4,5].map((i) => (
        <input key={i} ref={(el) => { inputs.current[i] = el; }}
          maxLength={1} value={(value[i] ?? "").trim()}
          onChange={(e) => handleChange(i, e)} onKeyDown={(e) => handleKey(i, e)}
          inputMode="numeric"
          style={{ flex: 1, padding: "14px 0", textAlign: "center", fontSize: 24, fontWeight: 700, border: "2px solid #e5e7eb", borderRadius: 14, background: "#f9fafb", outline: "none", color: "#111827", fontFamily: "inherit", minWidth: 0, transition: "border-color 0.15s" }}
          onFocus={(e) => e.target.style.borderColor = "#f97316"}
          onBlur={(e) => e.target.style.borderColor = "#e5e7eb"}
        />
      ))}
    </div>
  );
}

const inputCss: React.CSSProperties = {
  width: "100%", padding: "14px 16px",
  border: "1.5px solid #e5e7eb", borderRadius: 14,
  fontSize: "1rem", color: "#111827",
  fontFamily: "inherit", outline: "none",
  background: "#f9fafb", boxSizing: "border-box",
  transition: "border-color 0.15s, background 0.15s",
};

const labelCss: React.CSSProperties = {
  display: "block", fontSize: "0.72rem", fontWeight: 700,
  letterSpacing: "0.1em", textTransform: "uppercase",
  color: "#9ca3af", marginBottom: 8,
};

export default function AuthPage({ onLogin, onAdminLogin }: AuthPageProps) {
  const [tab, setTab] = useState<Tab>("login");
  const [step, setStep] = useState<SignupStep>("email");
  const [selectedRole, setSelectedRole] = useState<Role>("student");
  const [email, setEmail] = useState("");
  const [detectedRole, setDetectedRole] = useState<Role>("student");
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [fullName, setFullName] = useState("");
  const [signupUser, setSignupUser] = useState("");
  const [signupPass, setSignupPass] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminUser, setAdminUser] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [adminError, setAdminError] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);

  const startCountdown = () => {
    setCountdown(60);
    const t = setInterval(() => setCountdown((c) => { if (c <= 1) { clearInterval(t); return 0; } return c - 1; }), 1000);
  };
  const resetSignup = () => { setStep("email"); setEmail(""); setOtp(""); setOtpError(""); setFullName(""); setSignupUser(""); setSignupPass(""); setError(""); };

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault(); setError(""); setLoading(true);
    try { const res = await authApi.login(loginUser.trim(), loginPass); tokenStore.set(res.access_token); onLogin(res.user); }
    catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }
  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault(); setError(""); setLoading(true);
    try { const res = await authApi.sendOtp(email.trim()); setDetectedRole(res.role as Role); setStep("otp"); startCountdown(); }
    catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length < 6) return setOtpError("Please enter the full 6-digit code.");
    setOtpError(""); setLoading(true);
    try { await authApi.verifyOtp(email.trim(), otp); setStep("details"); }
    catch (e: any) { setOtpError(e.message); } finally { setLoading(false); }
  }
  async function handleSignup(e: React.FormEvent) {
    e.preventDefault(); setError(""); setLoading(true);
    try { await authApi.signup(fullName.trim(), signupUser.trim(), signupPass, detectedRole, email.trim()); setStep("done"); }
    catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }
  async function handleResend() {
    setLoading(true);
    try { await authApi.sendOtp(email.trim()); startCountdown(); setOtp(""); setOtpError(""); }
    catch (e: any) { setOtpError(e.message); } finally { setLoading(false); }
  }
  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault(); setAdminError(""); setAdminLoading(true);
    try { await adminLogin(adminUser.trim(), adminPass); setShowAdminModal(false); onAdminLogin(); }
    catch (e: any) { setAdminError(e.message); } finally { setAdminLoading(false); }
  }

  const gradBtn = (disabled = false): React.CSSProperties => ({
    width: "100%", padding: "16px",
    background: disabled ? "#e5e7eb" : "linear-gradient(135deg, #f97316, #ec4899)",
    color: disabled ? "#9ca3af" : "#fff",
    border: "none", borderRadius: 16, fontSize: "1.05rem", fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit",
    boxShadow: disabled ? "none" : "0 4px 20px rgba(249,115,22,0.3)",
    marginTop: 6,
  });

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #fff0eb 0%, #fde8f0 50%, #f0e8ff 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "2rem 1rem",
      overflow: "hidden",
      position: "relative",
    }}>
      {/* Background blobs */}
      <div style={{ position: "fixed", top: -200, right: -200, width: 600, height: 600, background: "radial-gradient(circle, rgba(249,115,22,0.12), transparent)", borderRadius: "50%", pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: -200, left: -200, width: 600, height: 600, background: "radial-gradient(circle, rgba(167,139,250,0.12), transparent)", borderRadius: "50%", pointerEvents: "none" }} />

      {/* Tek kolon - tüm içerik */}
      <div style={{ width: "100%", maxWidth: 500, display: "flex", flexDirection: "column", alignItems: "center", gap: 0, position: "relative", zIndex: 1 }}>

        {/* Logo */}
        <div style={{ width: 80, height: 80, background: "#fff", borderRadius: 24, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 32px rgba(249,115,22,0.2)", marginBottom: "1.25rem" }}>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M6 12v5c3 3 9 3 12 0v-5" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        {/* LASSIE */}
        <h1 style={{ fontSize: "4rem", fontWeight: 800, background: "linear-gradient(135deg, #f97316, #ec4899, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: "0 0 0.4rem", letterSpacing: "-0.04em", lineHeight: 1, textAlign: "center" }}>
          LASSIE
        </h1>
        <p style={{ fontSize: "1.05rem", fontWeight: 600, color: "#374151", margin: "0 0 0.5rem", textAlign: "center" }}>
          Learning Assistant System for Izmir Economics
        </p>
        <p style={{ fontSize: "0.88rem", color: "#6b7280", margin: "0 0 2rem", textAlign: "center", lineHeight: 1.65, maxWidth: 420 }}>
          An AI-powered learning platform where instructors upload course materials and shape personalized teaching models by guiding LLMs with their own feedback and expertise.
        </p>

        {/* Form kartı */}
        <div style={{ width: "100%", background: "rgba(255,255,255,0.92)", backdropFilter: "blur(20px)", borderRadius: 28, border: "1px solid rgba(255,255,255,0.8)", boxShadow: "0 20px 60px rgba(0,0,0,0.1)", padding: "0.5rem" }}>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, marginBottom: "1.25rem" }}>
            {(["login", "signup"] as Tab[]).map((t) => (
              <button key={t} onClick={() => { setTab(t); setError(""); resetSignup(); }}
                style={{ flex: 1, padding: "14px", borderRadius: 22, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "1rem", fontWeight: 600, transition: "all 0.2s", background: tab === t ? "linear-gradient(135deg, #f97316, #ec4899)" : "transparent", color: tab === t ? "#fff" : "#9ca3af", boxShadow: tab === t ? "0 4px 16px rgba(249,115,22,0.3)" : "none" }}>
                {t === "login" ? "Sign In" : "Sign Up"}
              </button>
            ))}
          </div>

          <div style={{ padding: "0 0.75rem 1.25rem" }}>
            {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

            {/* Sign In */}
            {tab === "login" && (
              <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <p style={{ fontSize: "1.35rem", fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>Welcome back 👋</p>
                  <p style={{ fontSize: "0.9rem", color: "#6b7280", margin: 0 }}>Enter your credentials to continue.</p>
                </div>
                <div>
                  <label style={labelCss}>Username</label>
                  <input style={inputCss} placeholder="your_username" value={loginUser} onChange={(e) => setLoginUser(e.target.value)} required
                    onFocus={(e) => { e.target.style.borderColor = "#f97316"; e.target.style.background = "#fff"; }}
                    onBlur={(e) => { e.target.style.borderColor = "#e5e7eb"; e.target.style.background = "#f9fafb"; }} />
                </div>
                <div>
                  <label style={labelCss}>Password</label>
                  <input style={inputCss} type="password" placeholder="••••••••" value={loginPass} onChange={(e) => setLoginPass(e.target.value)} required
                    onFocus={(e) => { e.target.style.borderColor = "#f97316"; e.target.style.background = "#fff"; }}
                    onBlur={(e) => { e.target.style.borderColor = "#e5e7eb"; e.target.style.background = "#f9fafb"; }} />
                </div>
                <button type="submit" disabled={loading} style={gradBtn(loading)}>
                  {loading ? "Signing in…" : "Sign In →"}
                </button>
              </form>
            )}

            {/* Sign Up - Step 1 */}
            {tab === "signup" && step === "email" && (
              <form onSubmit={handleSendOtp} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <p style={{ fontSize: "1.35rem", fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>Create your account</p>
                  <p style={{ fontSize: "0.9rem", color: "#6b7280", margin: 0 }}>Continue with your institutional email</p>
                </div>
                <div>
                  <label style={labelCss}>I am a</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {(["student", "teacher"] as Role[]).map((r) => {
                      const sel = selectedRole === r;
                      return (
                        <button key={r} type="button" onClick={() => setSelectedRole(r)}
                          style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 14, border: `2px solid ${sel ? (r === "student" ? "#f97316" : "#3b82f6") : "#e5e7eb"}`, background: sel ? (r === "student" ? "#fff7ed" : "#eff6ff") : "#f9fafb", cursor: "pointer", fontFamily: "inherit", position: "relative", transition: "all 0.15s" }}>
                          <div style={{ width: 40, height: 40, borderRadius: 12, background: r === "student" ? "linear-gradient(135deg, #f97316, #fb923c)" : "linear-gradient(135deg, #3b82f6, #60a5fa)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            {r === "student"
                              ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
                              : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                            }
                          </div>
                          <div>
                            <div style={{ fontSize: "0.95rem", fontWeight: 700, color: sel ? (r === "student" ? "#f97316" : "#2563eb") : "#374151" }}>{r === "student" ? "Student" : "Teacher"}</div>
                            <div style={{ fontSize: "0.73rem", color: "#9ca3af" }}>{r === "student" ? "@std.ieu.edu.tr" : "@ieu.edu.tr"}</div>
                          </div>
                          {sel && <div style={{ position: "absolute", top: 7, right: 7, width: 18, height: 18, borderRadius: "50%", background: r === "student" ? "#f97316" : "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="10" height="10" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></div>}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label style={labelCss}>Institutional Email</label>
                  <input style={inputCss} type="email" placeholder={selectedRole === "student" ? "ada@std.ieu.edu.tr" : "ada@ieu.edu.tr"} value={email} onChange={(e) => setEmail(e.target.value)} required
                    onFocus={(e) => { e.target.style.borderColor = "#f97316"; e.target.style.background = "#fff"; }}
                    onBlur={(e) => { e.target.style.borderColor = "#e5e7eb"; e.target.style.background = "#f9fafb"; }} />
                  <p style={{ fontSize: "0.76rem", color: "#9ca3af", marginTop: 6 }}>Students @std.ieu.edu.tr · Teachers @ieu.edu.tr</p>
                </div>
                <button type="submit" disabled={loading} style={gradBtn(loading)}>
                  {loading ? "Sending…" : "Send Verification Code →"}
                </button>
              </form>
            )}

            {/* Step 2: OTP */}
            {tab === "signup" && step === "otp" && (
              <form onSubmit={handleVerifyOtp} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <p style={{ fontSize: "1.35rem", fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>Enter your code</p>
                  <p style={{ fontSize: "0.9rem", color: "#6b7280", margin: 0 }}>We sent a 6-digit code to <strong>{email}</strong></p>
                </div>
                <OtpBoxes value={otp} onChange={setOtp} />
                {otpError && <p style={{ fontSize: "0.85rem", color: "#f97316", margin: 0 }}>{otpError}</p>}
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <button type="button" onClick={handleResend} disabled={countdown > 0 || loading} style={{ background: "none", border: "none", color: "#f97316", fontSize: "0.9rem", cursor: "pointer", opacity: countdown > 0 ? 0.5 : 1, fontFamily: "inherit", fontWeight: 600 }}>Resend code</button>
                  {countdown > 0 && <span style={{ fontSize: "0.85rem", color: "#9ca3af" }}>{countdown}s</span>}
                </div>
                <button type="submit" disabled={loading || otp.length < 6} style={gradBtn(loading || otp.length < 6)}>{loading ? "Verifying…" : "Verify →"}</button>
                <button type="button" onClick={() => { setStep("email"); setOtp(""); }} style={{ background: "none", border: "none", color: "#9ca3af", fontSize: "0.9rem", cursor: "pointer", fontFamily: "inherit", textAlign: "center" }}>← Change email</button>
              </form>
            )}

            {/* Step 3: Details */}
            {tab === "signup" && step === "details" && (
              <form onSubmit={handleSignup} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <p style={{ fontSize: "1.35rem", fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>Set up your profile</p>
                    <p style={{ fontSize: "0.9rem", color: "#6b7280", margin: 0 }}>Just a few more details.</p>
                  </div>
                  <span style={{ padding: "4px 12px", borderRadius: 99, fontSize: "0.8rem", fontWeight: 700, background: detectedRole === "student" ? "#fff7ed" : "#eff6ff", color: detectedRole === "student" ? "#f97316" : "#2563eb" }}>
                    {detectedRole === "student" ? "🎓 Student" : "🏫 Teacher"}
                  </span>
                </div>
                {[
                  { label: "Full Name", placeholder: "Ada Lovelace", value: fullName, set: setFullName, type: "text" },
                  { label: "Username", placeholder: "ada_loves_math", value: signupUser, set: setSignupUser, type: "text" },
                  { label: "Password", placeholder: "••••••••", value: signupPass, set: setSignupPass, type: "password" },
                ].map((f) => (
                  <div key={f.label}>
                    <label style={labelCss}>{f.label}</label>
                    <input style={inputCss} type={f.type} placeholder={f.placeholder} value={f.value} onChange={(e) => f.set(e.target.value)} required
                      onFocus={(e) => { e.target.style.borderColor = "#f97316"; e.target.style.background = "#fff"; }}
                      onBlur={(e) => { e.target.style.borderColor = "#e5e7eb"; e.target.style.background = "#f9fafb"; }} />
                  </div>
                ))}
                <button type="submit" disabled={loading} style={gradBtn(loading)}>
                  {loading ? "Creating…" : `Create ${detectedRole === "student" ? "Student" : "Teacher"} Account →`}
                </button>
              </form>
            )}

            {/* Step 4: Done */}
            {tab === "signup" && step === "done" && (
              <div style={{ textAlign: "center", padding: "2rem 0" }}>
                <div style={{ fontSize: "3.5rem", marginBottom: 14 }}>✅</div>
                <p style={{ fontSize: "1.35rem", fontWeight: 700, color: "#111827", marginBottom: 8 }}>You're all set!</p>
                <p style={{ fontSize: "0.9rem", color: "#6b7280", marginBottom: 24 }}>Account created successfully.</p>
                <button onClick={() => { setTab("login"); resetSignup(); }} style={gradBtn(false)}>Sign In →</button>
              </div>
            )}
          </div>
        </div>

        <button onClick={() => { setShowAdminModal(true); setAdminError(""); }}
          style={{ background: "none", border: "none", color: "#9ca3af", fontSize: "0.85rem", cursor: "pointer", marginTop: 16, opacity: 0.7 }}>
          ← Admin Login
        </button>
      </div>

      {/* Admin Modal */}
      {showAdminModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={() => setShowAdminModal(false)}>
          <div style={{ background: "#fff", borderRadius: 24, padding: "2.5rem", width: "100%", maxWidth: 400, boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: 10 }}>🛡</div>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 700, color: "#111827", marginBottom: 6 }}>Admin Login</h2>
              <p style={{ fontSize: "0.9rem", color: "#6b7280", margin: 0 }}>Only authorized admins can access.</p>
            </div>
            <form onSubmit={handleAdminLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {adminError && <div className="alert alert-error">{adminError}</div>}
              <div>
                <label style={labelCss}>Username</label>
                <input style={inputCss} placeholder="admin" value={adminUser} onChange={(e) => setAdminUser(e.target.value)} required />
              </div>
              <div>
                <label style={labelCss}>Password</label>
                <input style={inputCss} type="password" placeholder="••••••••" value={adminPass} onChange={(e) => setAdminPass(e.target.value)} required />
              </div>
              <button type="submit" disabled={adminLoading} style={gradBtn(adminLoading)}>
                {adminLoading ? "Logging in…" : "Login →"}
              </button>
              <button type="button" onClick={() => setShowAdminModal(false)} style={{ background: "none", border: "none", color: "#9ca3af", fontSize: "0.9rem", cursor: "pointer", fontFamily: "inherit", textAlign: "center" }}>Cancel</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
