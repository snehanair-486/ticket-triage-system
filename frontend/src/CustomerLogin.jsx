import { useState } from "react";
import {
  authenticateCustomer,
  registerCustomer,
  DEFAULT_CUSTOMER_ACCOUNTS,
} from "./auth.js";

export default function CustomerLogin({ onLoginSuccess, onGoToStaff }) {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showCredHelper, setShowCredHelper] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let session;
      if (mode === "login") {
        session = authenticateCustomer(email, password, remember);
      } else {
        session = registerCustomer(name, email, password, remember);
      }
      setTimeout(() => {
        setLoading(false);
        onLoginSuccess(session);
      }, 350);
    } catch (err) {
      setTimeout(() => {
        setLoading(false);
        setError(err.message);
      }, 250);
    }
  }

  function handleAutoFill(cust) {
    setEmail(cust.email);
    setPassword(cust.password);
    setError(null);
  }

  return (
    <div className="customer-login-page-wrapper">
      <div className="customer-login-card">
        {/* Customer Head Banner */}
        <div className="customer-login-head">
          <div className="customer-avatar-icon">
            <span>👤</span>
          </div>
          <div className="customer-titles">
            <div className="customer-desk-badge">
              <span className="dot dot--pulse" />
              CUSTOMER SERVICE DESK
            </div>
            <h2>Customer Access Portal</h2>
            <p className="customer-sub">Submit issues, track AI triage & view status</p>
          </div>
        </div>

        {/* Tab switcher: Sign In vs Register */}
        <div className="auth-mode-tabs">
          <button
            type="button"
            className={`auth-tab-btn ${mode === "login" ? "auth-tab-btn--active" : ""}`}
            onClick={() => { setMode("login"); setError(null); }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth-tab-btn ${mode === "register" ? "auth-tab-btn--active" : ""}`}
            onClick={() => { setMode("register"); setError(null); }}
          >
            Create Account
          </button>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="security-alert security-alert--error" role="alert">
            <span className="alert-icon">⚠️</span>
            <div>
              <strong>Authentication Notice</strong>
              <p>{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="customer-login-form">
          {mode === "register" && (
            <div className="form-group">
              <label htmlFor="customer-name">
                Full Name <span className="field-required">*</span>
              </label>
              <div className="input-with-icon">
                <span className="input-icon">👤</span>
                <input
                  id="customer-name"
                  type="text"
                  placeholder="e.g. Alex Morgan"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="customer-email">
              Email Address <span className="field-required">*</span>
            </label>
            <div className="input-with-icon">
              <span className="input-icon">✉️</span>
              <input
                id="customer-email"
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="customer-pass">
              Password <span className="field-required">*</span>
            </label>
            <div className="input-with-icon">
              <span className="input-icon">🔑</span>
              <input
                id="customer-pass"
                type={showPassword ? "text" : "password"}
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
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
            {mode === "register" && (
              <small className="field-hint">Must be at least 6 characters.</small>
            )}
          </div>

          <div className="form-options">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                disabled={loading}
              />
              <span>Remember me on this browser</span>
            </label>
          </div>

          <div className="form-submit-row">
            <button
              type="submit"
              className="btn btn--primary btn--customer-submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner spinner--sm" /> Verifying...
                </>
              ) : mode === "login" ? (
                "Sign In & Enter Help Desk →"
              ) : (
                "Create Account & Continue →"
              )}
            </button>
          </div>
        </form>

        {/* Demo Customer Helper */}
        <div className="cred-helper-box cred-helper-box--customer">
          <button
            type="button"
            className="cred-helper-toggle"
            onClick={() => setShowCredHelper(!showCredHelper)}
          >
            <span>👥 Demo Customer Accounts</span>
            <span className="helper-arrow">{showCredHelper ? "▲" : "▼"}</span>
          </button>

          {showCredHelper && (
            <div className="cred-helper-content">
              <p className="cred-helper-desc">
                Select a test account below to pre-fill credentials:
              </p>
              <div className="cred-card-list">
                {DEFAULT_CUSTOMER_ACCOUNTS.map((cust) => (
                  <div key={cust.email} className="cred-card cred-card--cust">
                    <div className="cred-meta">
                      <strong>{cust.name}</strong>
                      <code className="cred-code">{cust.email}</code>
                      <span className="cred-pass">Pass: <code>{cust.password}</code></span>
                    </div>
                    <button
                      type="button"
                      className="btn btn--sm btn--cust-fill"
                      onClick={() => handleAutoFill(cust)}
                    >
                      Fill
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Redirect to Staff Gate */}
        <div className="customer-login-footer">
          <span>Are you an internal support team member?</span>
          <button
            type="button"
            className="btn-link btn-link--staff"
            onClick={onGoToStaff}
          >
            🔒 Internal Staff Command Center Login →
          </button>
        </div>
      </div>
    </div>
  );
}
