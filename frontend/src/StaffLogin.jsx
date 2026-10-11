import React, { useState, useEffect } from "react";
import { authenticateStaff, getLockoutStatus } from "./auth.js";
import {
  IconShield,
  IconLock,
  IconKey,
  IconEye,
  IconEyeOff,
  IconAlertCircle,
  IconArrowLeft,
  IconArrowRight,
} from "./Icons.jsx";

export default function StaffLogin({ onLoginSuccess, onCancel, onBackToSelect }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lockout, setLockout] = useState(getLockoutStatus());

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
      const session = authenticateStaff(identifier, password, remember);
      setTimeout(() => {
        setLoading(false);
        onLoginSuccess(session);
      }, 350);
    } catch (err) {
      setTimeout(() => {
        setLoading(false);
        setError(err.message);
        setLockout(getLockoutStatus());
      }, 250);
    }
  }

  return (
    <div className="login-page-wrapper">
      <div className="login-card-secure">
        {(onBackToSelect || onCancel) && (
          <button
            type="button"
            className="btn-back-link"
            onClick={onBackToSelect || onCancel}
          >
            <IconArrowLeft size={14} />
            <span>Back to Portal Selection</span>
          </button>
        )}

        {/* Top Security Banner */}
        <div className="login-secure-head">
          <div className="security-shield-icon">
            <IconShield size={24} />
          </div>
          <div className="security-titles">
            <div className="restricted-badge">
              <span className="dot dot--pulse" />
              Restricted Internal Zone
            </div>
            <h2>Staff Command Center</h2>
            <p className="security-sub">Authorized Support Engineers & Incident Leads</p>
          </div>
        </div>

        {/* Lockout Warning */}
        {lockout.isLocked && (
          <div className="security-alert security-alert--lockout" role="alert">
            <IconLock size={18} className="alert-icon" />
            <div>
              <strong>Security Cooldown Triggered</strong>
              <p>
                Too many invalid attempts. Terminal is temporarily locked for <b>{lockout.remainingSeconds}s</b>.
              </p>
            </div>
          </div>
        )}

        {/* Error Notification */}
        {error && !lockout.isLocked && (
          <div className="security-alert security-alert--error" role="alert">
            <IconAlertCircle size={18} className="alert-icon" />
            <div>
              <strong>Access Denied</strong>
              <p>{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="security-login-form">
          <div className="form-group">
            <label htmlFor="staff-identifier">
              Staff Identifier / Email
              <span className="field-required">*</span>
            </label>
            <div className="input-with-icon">
              <span className="input-icon">
                <IconShield size={16} />
              </span>
              <input
                id="staff-identifier"
                type="text"
                placeholder="e.g. staff1 or staff1@triage.internal"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                disabled={lockout.isLocked || loading}
                autoComplete="username"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="staff-password">
              Security Password
              <span className="field-required">*</span>
            </label>
            <div className="input-with-icon">
              <span className="input-icon">
                <IconKey size={16} />
              </span>
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
                {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
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
                <>
                  <IconLock size={16} />
                  <span>Authenticate & Enter Portal</span>
                  <IconArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Security Compliance Note */}
        <div className="compliance-bar">
          <span>256-bit AES Authenticated Session • SOC2 Compliance Monitored</span>
        </div>

        {/* Exit link back to Customer Portal */}
        <div className="login-footer-nav">
          <button type="button" className="btn-link" onClick={onCancel || onBackToSelect}>
            &larr; Switch to Public Customer Service Desk
          </button>
        </div>
      </div>
    </div>
  );
}
