import { useEffect, useState } from "react";
import { settings } from "../../services/api";

interface SettingsModalProps {
  onClose: () => void;
  onProfileUpdated?: (fullName: string) => void;
}

type MeResponse = {
  full_name: string;
  username: string;
  email?: string | null;
  role: string;
};

export default function SettingsModal({
  onClose,
  onProfileUpdated,
}: SettingsModalProps) {
  const [loading, setLoading] = useState(true);

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadMe() {
      try {
        setLoading(true);
        setError("");
        const data: MeResponse = await settings.getMe();

        if (!mounted) return;

        setFullName(data.full_name ?? "");
        setUsername(data.username ?? "");
        setEmail(data.email ?? "");
        setRole(data.role ?? "");
      } catch (e: any) {
        if (!mounted) return;
        setError(e.message || "Failed to load settings.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadMe();

    return () => {
      mounted = false;
    };
  }, []);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    const cleanName = fullName.trim();
    if (!cleanName) {
      setError("Full name cannot be empty.");
      return;
    }

    try {
      setProfileSaving(true);
      const res = await settings.updateProfile(cleanName);
      setSuccess(res.message || "Profile updated successfully.");
      onProfileUpdated?.(cleanName);
    } catch (e: any) {
      setError(e.message || "Failed to update profile.");
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!currentPassword.trim()) {
      setError("Current password is required.");
      return;
    }

    if (!newPassword.trim()) {
      setError("New password is required.");
      return;
    }

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirm password do not match.");
      return;
    }

    try {
      setPasswordSaving(true);
      const res = await settings.changePassword(currentPassword, newPassword);
      setSuccess(res.message || "Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      setError(e.message || "Failed to change password.");
    } finally {
      setPasswordSaving(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.28)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "1rem",
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: 720,
          maxHeight: "90vh",
          overflowY: "auto",
          padding: "1.25rem 1.25rem 1rem",
          background: "var(--card)",
          borderRadius: 18,
          boxShadow: "var(--shadow-hover)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginBottom: "1rem",
          }}
        >
          <div>
            <div className="title-accent" />
            <h2 style={{ margin: 0, fontSize: "1.45rem" }}>Settings</h2>
            <p style={{ margin: "0.35rem 0 0", color: "var(--text-soft)", fontSize: "0.9rem" }}>
              Manage your profile and password.
            </p>
          </div>

          <button className="btn btn-ghost" onClick={onClose}>
            ✕
          </button>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
            {error}
          </div>
        )}

        {success && (
          <div
            className="alert"
            style={{
              marginBottom: "1rem",
              background: "rgba(39, 174, 96, 0.12)",
              border: "1px solid rgba(39, 174, 96, 0.35)",
              color: "#1f7a45",
            }}
          >
            {success}
          </div>
        )}

        {loading ? (
          <div style={{ padding: "1rem 0", color: "var(--text-soft)" }}>
            Loading settings...
          </div>
        ) : (
          <>
            <div
              className="card"
              style={{
                padding: "1rem 1rem 1.1rem",
                marginBottom: "1rem",
                background: "var(--bg2)",
              }}
            >
              <h3 style={{ marginTop: 0, marginBottom: "0.8rem", fontSize: "1rem" }}>
                Profile
              </h3>

              <form onSubmit={handleSaveProfile}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.9rem" }}>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label className="label">Full Name</label>
                    <input
                      className="input"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Enter your full name"
                    />
                  </div>

                  <div>
                    <label className="label">Username</label>
                    <input className="input" value={username} disabled />
                  </div>

                  <div>
                    <label className="label">Role</label>
                    <input className="input" value={role} disabled />
                  </div>

                  <div style={{ gridColumn: "1 / -1" }}>
                    <label className="label">Email</label>
                    <input className="input" value={email} disabled />
                  </div>
                </div>

                <div style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end" }}>
                  <button className="btn btn-primary" type="submit" disabled={profileSaving}>
                    {profileSaving ? "Saving..." : "Save Profile"}
                  </button>
                </div>
              </form>
            </div>

            <div
              className="card"
              style={{
                padding: "1rem 1rem 1.1rem",
                background: "var(--bg2)",
              }}
            >
              <h3 style={{ marginTop: 0, marginBottom: "0.8rem", fontSize: "1rem" }}>
                Security
              </h3>

              <form onSubmit={handleChangePassword}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "0.9rem" }}>
                  <div>
                    <label className="label">Current Password</label>
                    <input
                      className="input"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                    />
                  </div>

                  <div>
                    <label className="label">New Password</label>
                    <input
                      className="input"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                    />
                  </div>

                  <div>
                    <label className="label">Confirm New Password</label>
                    <input
                      className="input"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                    />
                  </div>
                </div>

                <div style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end" }}>
                  <button className="btn btn-primary" type="submit" disabled={passwordSaving}>
                    {passwordSaving ? "Updating..." : "Change Password"}
                  </button>
                </div>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}