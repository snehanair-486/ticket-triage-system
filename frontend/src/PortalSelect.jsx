import React from "react";
import {
  IconUser,
  IconShield,
  IconArrowRight,
  IconCheck,
  IconLock,
  IconSparkles,
} from "./Icons.jsx";

export default function PortalSelect({
  customerSession,
  staffSession,
  onSelectCustomer,
  onSelectStaff,
  onSelectCustomerRegister,
  onLogoutCustomer,
  onLogoutStaff,
}) {
  return (
    <div className="portal-select-view">
      <div className="portal-select-hero">
        <div className="platform-tag">
          <IconSparkles size={14} />
          <span>Serverless AI Ticket Triage</span>
        </div>
        <h1 className="portal-select-title">Incident Triage & Support System</h1>
        <p className="portal-select-subtitle">
          Select your portal to proceed. Submit and monitor customer support requests, or manage the internal incident triage queue.
        </p>
      </div>

      <div className="portal-cards-grid">
        {/* Customer Portal Card */}
        <div className="portal-choice-card portal-choice-card--customer">
          <div className="portal-choice-header">
            <div className="portal-choice-icon-wrap portal-choice-icon-wrap--customer">
              <IconUser size={26} />
            </div>
            <div className="portal-choice-badge portal-choice-badge--customer">
              Customer Desk
            </div>
          </div>

          <h2 className="portal-choice-title">Customer Portal</h2>
          <p className="portal-choice-desc">
            Submit service requests, obtain automated AI triage ratings, and track resolution status in real time.
          </p>

          <ul className="portal-feature-list">
            <li>
              <IconCheck size={16} className="feature-check" />
              <span>Instant AI urgency evaluation & department routing</span>
            </li>
            <li>
              <IconCheck size={16} className="feature-check" />
              <span>Track submitted tickets in AWS DynamoDB</span>
            </li>
            <li>
              <IconCheck size={16} className="feature-check" />
              <span>Customer account registration & history</span>
            </li>
          </ul>

          <div className="portal-choice-footer">
            {customerSession ? (
              <div className="portal-active-user-box">
                <div className="active-user-meta">
                  <span className="user-active-dot" />
                  <span>
                    Signed in as <strong>{customerSession.name}</strong>
                  </span>
                </div>
                <div className="choice-btn-group">
                  <button
                    type="button"
                    className="btn btn--primary btn--full"
                    onClick={onSelectCustomer}
                  >
                    <span>Enter Customer Desk</span>
                    <IconArrowRight size={16} />
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost-dark btn--sm"
                    onClick={onLogoutCustomer}
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            ) : (
              <div className="choice-btn-group">
                <button
                  type="button"
                  className="btn btn--primary btn--full"
                  onClick={onSelectCustomer}
                >
                  <span>Customer Sign In</span>
                  <IconArrowRight size={16} />
                </button>
                <button
                  type="button"
                  className="btn btn--secondary btn--full"
                  onClick={onSelectCustomerRegister}
                >
                  Create Account
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Staff Portal Card */}
        <div className="portal-choice-card portal-choice-card--staff">
          <div className="portal-choice-header">
            <div className="portal-choice-icon-wrap portal-choice-icon-wrap--staff">
              <IconShield size={26} />
            </div>
            <div className="portal-choice-badge portal-choice-badge--staff">
              Authorized Staff
            </div>
          </div>

          <h2 className="portal-choice-title">Staff Portal</h2>
          <p className="portal-choice-desc">
            Internal operations command center for support engineers, incident leads, and system administrators.
          </p>

          <ul className="portal-feature-list">
            <li>
              <IconCheck size={16} className="feature-check" />
              <span>Live incident ingestion queue & severity filtering</span>
            </li>
            <li>
              <IconCheck size={16} className="feature-check" />
              <span>AI rationale inspection & duplicate aggregation</span>
            </li>
            <li>
              <IconCheck size={16} className="feature-check" />
              <span>Direct ticket status overrides & workflow tracking</span>
            </li>
          </ul>

          <div className="portal-choice-footer">
            {staffSession ? (
              <div className="portal-active-user-box">
                <div className="active-user-meta">
                  <span className="user-active-dot user-active-dot--staff" />
                  <span>
                    Authenticated: <strong>{staffSession.name}</strong> ({staffSession.dept})
                  </span>
                </div>
                <div className="choice-btn-group">
                  <button
                    type="button"
                    className="btn btn--staff-primary btn--full"
                    onClick={onSelectStaff}
                  >
                    <span>Open Command Center</span>
                    <IconArrowRight size={16} />
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost-dark btn--sm"
                    onClick={onLogoutStaff}
                  >
                    Lock Terminal
                  </button>
                </div>
              </div>
            ) : (
              <div className="choice-btn-group">
                <button
                  type="button"
                  className="btn btn--staff-primary btn--full"
                  onClick={onSelectStaff}
                >
                  <IconLock size={16} />
                  <span>Staff Login</span>
                  <IconArrowRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
