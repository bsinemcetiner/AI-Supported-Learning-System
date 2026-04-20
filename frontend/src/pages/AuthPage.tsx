import { useState, useRef } from "react";
import type { User } from "../types";
import { auth as authApi, token as tokenStore, adminLogin } from "../services/api";

interface AuthPageProps {
  onLogin: (user: User) => void;
  onAdminLogin: () => void;
}

type Tab      = "login" | "signup";
type Role     = "student" | "teacher";
type SignupStep = "email" | "otp" | "details" | "done";

// ─── OTP Boxes ───────────────────────────────────────────────
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
    <div style={{ display: "flex", gap: 8, marginBottom: 8, width: "100%", overflow: "hidden" }}>
      {[0,1,2,3,4,5].map((i) => (
        <input
          key={i}
          ref={(el) => { inputs.current[i] = el; }}
          maxLength={1}
          value={(value[i] ?? "").trim()}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKey(i, e)}
          inputMode="numeric"
          style={{
            flex: 1, padding: "10px 0", textAlign: "center",
            fontSize: 20, fontWeight: 600,
            border: "1.5px solid var(--line)", borderRadius: "var(--r-md)",
            background: "var(--bg2)", outline: "none", color: "var(--text)",
            fontFamily: "inherit", minWidth: 0, maxWidth: "100%",
          }}
        />
      ))}
    </div>
  );
}

export default function AuthPage({ onLogin, onAdminLogin }: AuthPageProps) {
  const [tab, setTab]     = useState<Tab>("login");

  const [step, setStep]   = useState<SignupStep>("email");
  const [email, setEmail] = useState("");
  const [detectedRole, setDetectedRole] = useState<Role>("student");
  const [otp, setOtp]     = useState("");
  const [otpError, setOtpError] = useState("");
  const [fullName, setFullName] = useState("");
  const [signupUser, setSignupUser] = useState("");
  const [signupPass, setSignupPass] = useState("");
  const [countdown, setCountdown] = useState(0);

  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");

  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminUser, setAdminUser] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [adminError, setAdminError] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);

  const startCountdown = () => {
    setCountdown(60);
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(t); return 0; }
        return c - 1;
      });
    }, 1000);
  };

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

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await authApi.sendOtp(email.trim());
      setDetectedRole(res.role as Role);
      setStep("otp");
      startCountdown();
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length < 6) return setOtpError("Please enter the full 6-digit code.");
    setOtpError(""); setLoading(true);
    try {
      await authApi.verifyOtp(email.trim(), otp);
      setStep("details");
    } catch (e: any) { setOtpError(e.message); }
    finally { setLoading(false); }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await authApi.signup(fullName.trim(), signupUser.trim(), signupPass, detectedRole, email.trim());
      setSuccess("Account created! You can now sign in.");
      setStep("done");
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function handleResend() {
    setLoading(true);
    try {
      await authApi.sendOtp(email.trim());
      startCountdown();
      setOtp(""); setOtpError("");
    } catch (e: any) { setOtpError(e.message); }
    finally { setLoading(false); }
  }

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    setAdminError(""); setAdminLoading(true);
    try {
      await adminLogin(adminUser.trim(), adminPass);
      setShowAdminModal(false);
      onAdminLogin();
    } catch (e: any) { setAdminError(e.message); }
    finally { setAdminLoading(false); }
  }

  const resetSignup = () => {
    setStep("email"); setEmail(""); setOtp("");
    setOtpError(""); setFullName(""); setSignupUser(""); setSignupPass("");
    setError(""); setSuccess("");
  };

  return (
    <div style={{
      minHeight: "100vh", background: "var(--bg)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "2rem 1rem",
    }}>
      <div style={{ width: "100%", maxWidth: 420 }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{
            width: 56, height: 56, background: "var(--orange)",
            borderRadius: "var(--r-lg)", display: "flex",
            alignItems: "center", justifyContent: "center",
            fontSize: "1.6rem", margin: "0 auto 1rem",
            boxShadow: "var(--shadow-orange)",
          }}>🎓</div>
          <h1 style={{ fontSize: "1.8rem", marginBottom: 6 }}>Learning Assistant</h1>
          <p style={{ color: "var(--text-soft)", fontSize: "0.9rem" }}>
            AI-powered personalized learning platform
          </p>
        </div>

        <div className="card" style={{ padding: "1.75rem" }}>
          {/* Tab bar */}
          <div className="tab-bar" style={{ marginBottom: "1.25rem" }}>
            {(["login", "signup"] as Tab[]).map((t) => (
              <button key={t} className={`tab-btn ${tab === t ? "active" : ""}`}
                onClick={() => { setTab(t); setError(""); setSuccess(""); resetSignup(); }}>
                {t === "login" ? "Sign In" : "Sign Up"}
              </button>
            ))}
          </div>

          {error   && <div className="alert alert-error"   style={{ marginBottom: 14 }}>{error}</div>}
          {success && <div className="alert alert-success" style={{ marginBottom: 14 }}>{success}</div>}

          {/* ══ SIGN IN ══ */}
          {tab === "login" && (
            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <p style={{ fontFamily: "'Fraunces', serif", fontSize: "1.1rem", fontWeight: 600, marginBottom: 4 }}>
                  Welcome back 👋
                </p>
                <p style={{ fontSize: "0.83rem", color: "var(--text-soft)" }}>Enter your credentials to continue.</p>
              </div>
              <div>
                <label className="label">Username</label>
                <input className="input" placeholder="your_username" value={loginUser}
                  onChange={(e) => setLoginUser(e.target.value)} required />
              </div>
              <div>
                <label className="label">Password</label>
                <input className="input" type="password" placeholder="••••••••" value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)} required />
              </div>
              <button className="btn btn-primary" type="submit" disabled={loading}
                style={{ width: "100%", padding: "0.7rem", marginTop: 4 }}>
                {loading ? "Signing in…" : "Sign In →"}
              </button>
            </form>
          )}

          {/* ══ SIGN UP ══ */}
          {tab === "signup" && (
            <div>
              {/* STEP 1: Email */}
              {step === "email" && (
                <form onSubmit={handleSendOtp} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <p style={{ fontFamily: "'Fraunces', serif", fontSize: "1.1rem", fontWeight: 600, marginBottom: 4 }}>
                      Create your account
                    </p>
                    <p style={{ fontSize: "0.83rem", color: "var(--text-soft)" }}>
                      Continue with your institutional email.
                    </p>
                  </div>
                  <div>
                    <label className="label">Institutional Email</label>
                    <input className="input" type="email"
                      placeholder="ada@std.ieu.edu.tr or ada@ieu.edu.tr"
                      value={email} onChange={(e) => setEmail(e.target.value)} required />
                    <p style={{ fontSize: "0.75rem", color: "var(--text-soft)", marginTop: 4 }}>
                      Students use @std.ieu.edu.tr · Teachers use @ieu.edu.tr
                    </p>
                  </div>
                  <button className="btn btn-primary" type="submit" disabled={loading}
                    style={{ width: "100%", padding: "0.7rem", marginTop: 4 }}>
                    {loading ? "Sending…" : "Send Verification Code →"}
                  </button>
                </form>
              )}

              {/* STEP 2: OTP */}
              {step === "otp" && (
                <form onSubmit={handleVerifyOtp} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <p style={{ fontFamily: "'Fraunces', serif", fontSize: "1.1rem", fontWeight: 600, marginBottom: 4 }}>
                      Enter your code
                    </p>
                    <p style={{ fontSize: "0.83rem", color: "var(--text-soft)" }}>
                      We sent a 6-digit code to <strong>{email}</strong>.
                    </p>
                  </div>
                  <div>
                    <OtpBoxes value={otp} onChange={setOtp} />
                    {otpError && (
                      <p style={{ fontSize: "0.78rem", color: "var(--orange)", marginTop: 4 }}>{otpError}</p>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                      <button type="button" onClick={handleResend} disabled={countdown > 0 || loading}
                        style={{
                          background: "none", border: "none", color: "var(--orange)",
                          fontSize: "0.78rem", cursor: countdown > 0 ? "not-allowed" : "pointer",
                          opacity: countdown > 0 ? 0.5 : 1, fontFamily: "inherit", fontWeight: 500,
                        }}>
                        Resend code
                      </button>
                      {countdown > 0 && (
                        <span style={{ fontSize: "0.75rem", color: "var(--text-soft)" }}>{countdown}s</span>
                      )}
                    </div>
                  </div>
                  <button className="btn btn-primary" type="submit" disabled={loading || otp.length < 6}
                    style={{ width: "100%", padding: "0.7rem" }}>
                    {loading ? "Verifying…" : "Verify →"}
                  </button>
                  <button type="button" onClick={() => { setStep("email"); setOtp(""); setOtpError(""); }}
                    style={{
                      background: "none", border: "none", color: "var(--text-soft)",
                      fontSize: "0.78rem", cursor: "pointer", fontFamily: "inherit", textAlign: "center",
                    }}>
                    ← Change email
                  </button>
                </form>
              )}

              {/* STEP 3: Details */}
              {step === "details" && (
                <form onSubmit={handleSignup} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <p style={{ fontFamily: "'Fraunces', serif", fontSize: "1.1rem", fontWeight: 600, marginBottom: 4 }}>
                        Set up your profile
                      </p>
                      <p style={{ fontSize: "0.83rem", color: "var(--text-soft)" }}>Just a few more details.</p>
                    </div>
                    <span style={{
                      padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                      background: detectedRole === "student" ? "var(--orange-lt)" : "#e6f1fb",
                      color: detectedRole === "student" ? "var(--orange)" : "#185fa5",
                    }}>
                      {detectedRole === "student" ? "🎓 Student" : "🏫 Teacher"}
                    </span>
                  </div>
                  <div>
                    <label className="label">Full Name</label>
                    <input className="input" placeholder="Ada Lovelace" value={fullName}
                      onChange={(e) => setFullName(e.target.value)} required />
                  </div>
                  <div>
                    <label className="label">Username</label>
                    <input className="input" placeholder="ada_loves_math" value={signupUser}
                      onChange={(e) => setSignupUser(e.target.value)} required />
                  </div>
                  <div>
                    <label className="label">Password</label>
                    <input className="input" type="password" placeholder="••••••••" value={signupPass}
                      onChange={(e) => setSignupPass(e.target.value)} required />
                  </div>
                  <button className="btn btn-primary" type="submit" disabled={loading}
                    style={{ width: "100%", padding: "0.7rem", marginTop: 4 }}>
                    {loading ? "Creating account…" : `Create ${detectedRole === "student" ? "Student" : "Teacher"} Account →`}
                  </button>
                </form>
              )}

              {/* STEP 4: Done */}
              {step === "done" && (
                <div style={{ textAlign: "center", padding: "1rem 0" }}>
                  <div style={{ fontSize: "3rem", marginBottom: 12 }}>✅</div>
                  <p style={{ fontFamily: "'Fraunces', serif", fontSize: "1.2rem", fontWeight: 600, marginBottom: 8 }}>
                    You're all set!
                  </p>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-soft)", marginBottom: 16 }}>
                    Your account has been created successfully.
                  </p>
                  <button className="btn btn-primary"
                    onClick={() => { setTab("login"); resetSignup(); }}
                    style={{ width: "100%", padding: "0.7rem" }}>
                    Sign In →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Admin link */}
        <div style={{ textAlign: "center", marginTop: "1.25rem" }}>
          <button onClick={() => { setShowAdminModal(true); setAdminError(""); }}
            style={{
              background: "none", border: "none", color: "var(--text-soft)",
              fontSize: "0.8rem", cursor: "pointer", textDecoration: "underline", opacity: 0.6,
            }}>
            🛡 Admin Login
          </button>
        </div>
      </div>

      {/* Admin Modal */}
      {showAdminModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
        }} onClick={() => setShowAdminModal(false)}>
          <div style={{
            background: "var(--bg2, #fff)", borderRadius: "var(--r-lg, 16px)",
            padding: "2rem", width: "100%", maxWidth: 360,
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: "center", marginBottom: "1.25rem" }}>
              <div style={{ fontSize: "2rem", marginBottom: 8 }}>🛡</div>
              <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: 4 }}>Admin Login</h2>
              <p style={{ fontSize: "0.82rem", color: "var(--text-soft)" }}>
                Only authorized admins can access this panel.
              </p>
            </div>
            <form onSubmit={handleAdminLogin} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {adminError && <div className="alert alert-error">{adminError}</div>}
              <div>
                <label className="label">Username</label>
                <input className="input" placeholder="admin" value={adminUser}
                  onChange={(e) => setAdminUser(e.target.value)} required />
              </div>
              <div>
                <label className="label">Password</label>
                <input className="input" type="password" placeholder="••••••••" value={adminPass}
                  onChange={(e) => setAdminPass(e.target.value)} required />
              </div>
              <button className="btn btn-primary" type="submit" disabled={adminLoading}
                style={{ width: "100%", padding: "0.7rem", marginTop: 4 }}>
                {adminLoading ? "Signing in…" : "Sign In →"}
              </button>
              <button type="button" onClick={() => setShowAdminModal(false)}
                style={{
                  background: "none", border: "none", color: "var(--text-soft)",
                  fontSize: "0.82rem", cursor: "pointer", textAlign: "center",
                }}>
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}