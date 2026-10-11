import { useState, useEffect } from "react";
import { authenticateStaff, getLockoutStatus, AUTHORIZED_STAFF_USERS } from "./auth.js";

export default function StaffLogin({ onLoginSuccess, onCancel }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lockout, setLockout] = useState(getLockoutStatus());
  const [showCredHelper, setShowCredHelper] = useState(false);

  // Lockout countdown timer
  useEffect(() => {
    let timer;
    if (lockout.isLocked) {
      timer = setInterval(() => {
        const current = getLockoutStatus();
        setLockout(current);
        if (!current.isLocked) {
          setError(null);
        }
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [lockout.isLocked]);

  function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const session = authenticateStaff(email, password, remember);
      setTimeout(() => {
        setLoading(false);
        onLoginSuccess(session);
      }, 400); // realistic verification latency
    } catch (err) {
      setTimeout(() => {
        setLoading(false);
        setError(err.message);
        setLockout(getLockoutStatus());
      }, 350);
    }
  }

  function handleAutoFill(staffUser) {
    setEmail(staffUser.email);
    setPassword(staffUser.password);
    setError(null);
  }

  return (
    <div className="login-page-wrapper">
      <div className="login-card-secure">
        {/* Top Security Banner */}
        <div className="login-secure-head">
          <div className="security-shield-icon">
            <span>🛡️</span>
          </div>
          <div className="security-titles">
            <div className="restricted-badge">
              <span className="dot dot--pulse" />
              RESTRICTED INTERNAL ZONE
            </div>
            <h2>Staff Command Center</h2>
            <p className="security-sub">Authorized Support & Incident Leads Only</p>
          </div>
        </div>

        {/* Lockout Warning */}
        {lockout.isLocked && (
          <div className="security-alert security-alert--lockout" role="alert">
            <span className="alert-icon">🔒</span>
            <div>
              <strong>Security Cooldown Triggered</strong>
              <p>Too many invalid attempts. Terminal is temporarily locked for <b>{lockout.remainingSeconds}s</b>.</p>
            </div>
          </div>
        )}

        {/* Error Notification */}
        {error && !lockout.isLocked && (
          <div className="security-alert security-alert--error" role="alert">
            <span className="alert-icon">⚠️</span>
            <div>
              <strong>Access Denied</strong>
              <p>{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="security-login-form">
          <div className="form-group">
            <label htmlFor="staff-email">
              Staff Email / Identifier
              <span className="field-required">*</span>
            </label>
            <div className="input-with-icon">
              <span className="input-icon">👤</span>
              <input
                id="staff-email"
                type="email"
                placeholder="name@triage.internal"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={lockout.isLocked || loading}
                autoComplete="username"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="staff-password">
              Security Key / Password
              <span className="field-required">*</span>
            </label>
            <div className="input-with-icon">
              <span className="input-icon">🔑</span>
              <input
                id="staff-password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter authorized password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={lockout.isLocked || loading}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="btn-toggle-pass"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPassword ? "👁️‍🗨️" : "👁️"}
              </button>
            </div>
          </div>

          <div className="form-options">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                disabled={lockout.isLocked || loading}
              />
              <span>Keep terminal session authenticated (8h)</span>
            </label>
          </div>

          <div className="form-submit-row">
            <button
              type="submit"
              className="btn btn--security-primary"
              disabled={lockout.isLocked || loading}
            >
              {loading ? (
                <>
                  <span className="spinner spinner--sm" /> Verifying Credentials...
                </>
              ) : (
                "🔐 Authenticate & Enter Portal"
              )}
            </button>
          </div>
        </form>

        {/* Security Compliance Note */}
        <div className="compliance-bar">
          <span>🔒 256-bit AES Authenticated Session • SOC2 Audited System</span>
        </div>

        {/* Authorized Credentials Helper */}
        <div className="cred-helper-box">
          <button
            type="button"
            className="cred-helper-toggle"
            onClick={() => setShowCredHelper(!showCredHelper)}
          >
            <span>📋 Authorized Staff Directory & Credentials</span>
            <span className="helper-arrow">{showCredHelper ? "▲" : "▼"}</span>
          </button>

          {showCredHelper && (
            <div className="cred-helper-content">
              <p className="cred-helper-desc">
                Select an authorized account below to pre-populate credentials:
              </p>
              <div className="cred-card-list">
                {AUTHORIZED_STAFF_USERS.map((usr) => (
                  <div key={usr.email} className="cred-card">
                    <div className="cred-meta">
                      <strong>{usr.name}</strong>
                      <span className="cred-role">{usr.dept}</span>
                      <code className="cred-code">{usr.email}</code>
                      <span className="cred-pass">Key: <code>{usr.password}</code></span>
                    </div>
                    <button
                      type="button"
                      className="btn btn--sm btn--cred-fill"
                      onClick={() => handleAutoFill(usr)}
                    >
                      Fill
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Exit link back to Customer Portal */}
        <div className="login-footer-nav">
          <button type="button" className="btn-link" onClick={onCancel}>
            ← Exit to Public Customer Service Desk
          </button>
        </div>
      </div>
    </div>
  );
}
