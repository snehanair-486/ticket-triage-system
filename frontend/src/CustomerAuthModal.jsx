import React, { useState } from "react";
import { authenticateCustomer, registerCustomer } from "./auth.js";
import {
  IconUser,
  IconEye,
  IconEyeOff,
  IconAlertCircle,
  IconArrowRight,
} from "./Icons.jsx";

export default function CustomerAuthModal({
  currentCustomer,
  onLoginSuccess,
  onClose,
  onGoToStaff,
}) {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [name, setName] = useState("");
  const [email, setEmail] = useState(currentCustomer?.email || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let session;
      if (mode === "login") {
        session = authenticateCustomer(email, password);
      } else {
        session = registerCustomer(name, email, password);
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
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card customer-auth-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="modal-badge modal-badge--customer">
            <IconUser size={14} />
            <span>Customer Service Desk</span>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close modal">
            &times;
          </button>
        </div>

        <h2>{mode === "login" ? "Customer Sign In" : "Create Customer Account"}</h2>
        <p className="modal-desc">
          Sign in to track your support tickets, receive status notifications, and communicate with triage staff.
        </p>

        {/* Tab switch between Sign In and Register */}
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
            Register Account
          </button>
        </div>

        {error && (
          <div className="security-alert security-alert--error" role="alert">
            <IconAlertCircle size={16} className="alert-icon" />
            <div>
              <strong>Error</strong>
              <p>{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="modal-form">
          {mode === "register" && (
            <div className="form-group">
              <label htmlFor="cust-name">Full Name</label>
              <input
                id="cust-name"
                type="text"
                placeholder="e.g. Jordan Smith"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="cust-email">Email Address</label>
            <input
              id="cust-email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="cust-pass">Password</label>
            <div className="input-with-icon">
              <input
                id="cust-pass"
                type={showPassword ? "text" : "password"}
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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

          <div className="modal-actions">
            <button type="submit" className="btn btn--primary" disabled={loading}>
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
                  <span>Create Account</span>
                  <IconArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </form>

        <div className="auth-modal-footer">
          <div className="staff-redirect-box">
            <span>Are you a support team member?</span>
            <button
              type="button"
              className="btn-link btn-link--staff"
              onClick={() => {
                onClose();
                onGoToStaff();
              }}
            >
              Internal Staff Login &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
