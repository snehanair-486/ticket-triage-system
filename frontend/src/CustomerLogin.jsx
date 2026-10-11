import React, { useState } from "react";
import { authenticateCustomer, registerCustomer } from "./auth.js";
import {
  IconUser,
  IconMail,
  IconKey,
  IconEye,
  IconEyeOff,
  IconAlertCircle,
  IconArrowLeft,
  IconArrowRight,
} from "./Icons.jsx";

export default function CustomerLogin({
  onLoginSuccess,
  onGoToStaff,
  onBackToSelect,
  initialMode = "login",
}) {
  const [mode, setMode] = useState(initialMode); // "login" | "register"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
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
      }, 300);
    } catch (err) {
      setTimeout(() => {
        setLoading(false);
        setError(err.message);
      }, 200);
    }
  }

  return (
    <div className="customer-login-page-wrapper">
      <div className="customer-login-card">
        {onBackToSelect && (
          <button
            type="button"
            className="btn-back-link"
            onClick={onBackToSelect}
          >
            <IconArrowLeft size={14} />
            <span>Back to Portal Selection</span>
          </button>
        )}

        {/* Customer Head Banner */}
        <div className="customer-login-head">
          <div className="customer-avatar-icon">
            <IconUser size={24} />
          </div>
          <div className="customer-titles">
            <div className="customer-desk-badge">
              <span className="dot dot--pulse" />
              Customer Service Desk
            </div>
            <h2>{mode === "login" ? "Customer Sign In" : "Create Customer Account"}</h2>
            <p className="customer-sub">
              {mode === "login"
                ? "Enter your email and password to access your support dashboard."
                : "Register a customer account to submit tickets and track AI triage."}
            </p>
          </div>
        </div>

        {/* Tab switcher: Sign In vs Register */}
        <div className="auth-mode-tabs">
          <button
            type="button"
            className={`auth-tab-btn ${mode === "login" ? "auth-tab-btn--active" : ""}`}
            onClick={() => {
              setMode("login");
              setError(null);
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth-tab-btn ${mode === "register" ? "auth-tab-btn--active" : ""}`}
            onClick={() => {
              setMode("register");
              setError(null);
            }}
          >
            Create Account
          </button>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="security-alert security-alert--error" role="alert">
            <IconAlertCircle size={18} className="alert-icon" />
            <div>
              <strong>Authentication Notice</strong>
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* Success Notification */}
        {successMsg && (
          <div className="security-alert security-alert--success" role="alert">
            <IconAlertCircle size={18} className="alert-icon" />
            <div>
              <strong>Account Created</strong>
              <p>{successMsg}</p>
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
                <span className="input-icon">
                  <IconUser size={16} />
                </span>
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
              <span className="input-icon">
                <IconMail size={16} />
              </span>
              <input
                id="customer-email"
                type="email"
                placeholder="name@example.com"
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
              <span className="input-icon">
                <IconKey size={16} />
              </span>
              <input
                id="customer-pass"
                type={showPassword ? "text" : "password"}
                placeholder={mode === "login" ? "Enter your password" : "At least 6 characters"}
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
                {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
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
                  <span className="spinner spinner--sm" /> Processing...
                </>
              ) : mode === "login" ? (
                <>
                  <span>Sign In</span>
                  <IconArrowRight size={16} />
                </>
              ) : (
                <>
                  <span>Create Account & Continue</span>
                  <IconArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Footer Redirect to Staff Gate */}
        <div className="customer-login-footer">
          <span>Are you an internal support team member?</span>
          <button
            type="button"
            className="btn-link btn-link--staff"
            onClick={onGoToStaff}
          >
            Staff Command Center Login &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}
