import React, { useEffect, useRef, useState } from "react";
import {
  submitTicket,
  getTicket,
  listTickets,
  getUserTicketIds,
  getTicketStatusOverrides,
  urgencyLabel,
  formatTime,
  getAISentiment,
} from "./api.js";
import {
  IconUser,
  IconFileText,
  IconCheck,
  IconCopy,
  IconRefresh,
  IconSend,
  IconSparkles,
  IconBuilding,
  IconLogOut,
  IconAlertCircle,
  IconClock,
} from "./Icons.jsx";

const MAX = 2000;
const POLL_MS = 2000;
const POLL_MAX = 20;

const TEMPLATES = [
  {
    label: "Checkout Failed",
    text: "I have been trying to check out for over an hour and my credit card payment keeps failing at the final step.",
  },
  {
    label: "Application Crashing",
    text: "The application crashes immediately with a blank screen whenever I navigate to my account dashboard.",
  },
  {
    label: "Account Access Issue",
    text: "I forgot my password and the reset link emailed to me says expired. I cannot log in.",
  },
  {
    label: "General Inquiry",
    text: "How do I update the shipping address associated with an order placed earlier today?",
  },
];

export default function CustomerPortal({ user, onOpenAuth, onLogout, onBackToSelect }) {
  const [activeTab, setActiveTab] = useState("report"); // "report" | "my-tickets"
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState(null);
  const [myTickets, setMyTickets] = useState([]);
  const [statusOverrides, setStatusOverrides] = useState(() => getTicketStatusOverrides());
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const alive = useRef(true);

  useEffect(() => () => {
    alive.current = false;
  }, []);

  // Listen for resolution status updates from Staff Portal (cross-tab storage and same-window events)
  useEffect(() => {
    function handleStorageChange(e) {
      if (!e || e.key === "triage_staff_ticket_status" || e.type === "triage_status_updated") {
        setStatusOverrides(getTicketStatusOverrides());
      }
    }
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("triage_status_updated", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("triage_status_updated", handleStorageChange);
    };
  }, []);

  // Periodically refresh ticket status overrides when in "My Tickets"
  useEffect(() => {
    if (activeTab === "my-tickets") {
      loadMyTickets();
      const timer = setInterval(() => {
        setStatusOverrides(getTicketStatusOverrides());
      }, 3000);
      return () => clearInterval(timer);
    }
  }, [activeTab, user?.email]);

  async function loadMyTickets() {
    setLoadingTickets(true);
    try {
      const all = await listTickets();
      const myIds = getUserTicketIds(user?.email);
      // Strictly filter to tickets submitted by this specific customer account
      const mine = all.filter((t) => myIds.includes(t.ticketId));
      setMyTickets(mine);
      setStatusOverrides(getTicketStatusOverrides());
    } catch {
      // Graceful fallback
    } finally {
      setLoadingTickets(false);
    }
  }

  async function waitForResult(id) {
    for (let i = 0; i < POLL_MAX; i++) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      if (!alive.current) return;
      try {
        const t = await getTicket(id);
        if (t.status === "CLASSIFIED" || t.urgency) {
          setView({ kind: "triage", ticket: t });
          loadMyTickets();
          return;
        }
      } catch {}
    }
    setView({
      kind: "status",
      id,
      done: true,
      message: "Your ticket is safely logged in our database. AI triage is completing in the background.",
    });
    loadMyTickets();
  }

  async function onSubmit(e) {
    e.preventDefault();
    const body = text.trim();
    if (!body) {
      setView({ kind: "error", message: "Please describe what happened before sending." });
      return;
    }
    setBusy(true);
    setView({ kind: "status", message: "Dispatched to AWS API Gateway... Generating ticket ID..." });
    try {
      const id = await submitTicket(body, user?.email);
      setText("");
      setView({ kind: "status", id, message: "Ticket accepted! Running AI classification engine..." });
      await waitForResult(id);
    } catch (err) {
      setView({ kind: "error", message: err.message });
    } finally {
      setBusy(false);
    }
  }

  function handleCopy(id) {
    navigator.clipboard?.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  }

  const userTicketCount = getUserTicketIds(user?.email).length;

  return (
    <main className="page">
      <div className="portal-hero">
        <div className="portal-badge-row">
          <span className="badge badge--user">
            <IconUser size={14} />
            <span>Customer Service Desk</span>
          </span>
          <span className="user-greeting">
            Signed in as <strong>{user?.name || "Customer"}</strong>{" "}
            {user?.email ? `(${user.email})` : ""}
          </span>
          <div className="portal-hero-action-buttons">
            {onBackToSelect && (
              <button
                type="button"
                className="btn-switch-account"
                onClick={onBackToSelect}
                title="Return to Portal Selection"
              >
                Switch Portal
              </button>
            )}
            {onLogout && (
              <button
                type="button"
                className="btn-switch-account"
                onClick={onLogout}
                title="Sign out of customer account"
              >
                <IconLogOut size={14} />
                <span>Sign Out</span>
              </button>
            )}
          </div>
        </div>

        <h1>How can we help you today?</h1>
        <p className="lede">
          Submit your issue and our serverless AI pipeline will instantly rate its urgency and route it to the right department.
        </p>

        <div className="sub-nav-tabs">
          <button
            className={`sub-tab ${activeTab === "report" ? "sub-tab--active" : ""}`}
            onClick={() => setActiveTab("report")}
          >
            <IconFileText size={16} />
            <span>Submit New Ticket</span>
          </button>
          <button
            className={`sub-tab ${activeTab === "my-tickets" ? "sub-tab--active" : ""}`}
            onClick={() => setActiveTab("my-tickets")}
          >
            <IconClock size={16} />
            <span>My Submitted Tickets {userTicketCount > 0 && `(${userTicketCount})`}</span>
          </button>
        </div>
      </div>

      {activeTab === "report" ? (
        <>
          <div className="template-chips">
            <span className="template-label">Quick Templates:</span>
            {TEMPLATES.map((tmpl, idx) => (
              <button
                key={idx}
                type="button"
                className="chip-btn"
                onClick={() => setText(tmpl.text)}
              >
                {tmpl.label}
              </button>
            ))}
          </div>

          <form onSubmit={onSubmit} noValidate className="ticket-submit-form">
            <div className="field-head">
              <label className="field-label" htmlFor="problem-text">
                Describe the problem in detail:
              </label>
              <span className="counter-pill">{text.length} / {MAX} chars</span>
            </div>

            <textarea
              id="problem-text"
              maxLength={MAX}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Explain what went wrong, any error codes, and what you expected to happen..."
              rows={5}
            />

            <div className="field-foot">
              <span className="helper-note">
                Tips: Include order numbers, error messages, or steps to reproduce.
              </span>
              <button className="btn btn--primary" type="submit" disabled={busy}>
                {busy ? (
                  <>
                    <span className="spinner spinner--sm" /> Processing...
                  </>
                ) : (
                  <>
                    <IconSend size={16} />
                    <span>Submit Ticket</span>
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="result-area" aria-live="polite">
            {view?.kind === "status" && (
              <div className="card card--status">
                <div className="status-indicator">
                  {!view.done ? (
                    <span className="spinner" aria-hidden="true" />
                  ) : (
                    <IconCheck size={20} className="check-icon" />
                  )}
                  <div className="status-texts">
                    <strong>{view.message}</strong>
                    {view.id && (
                      <p className="meta-copy">
                        Tracking ID: <code>{view.id}</code>
                        <button
                          type="button"
                          className="btn-copy"
                          onClick={() => handleCopy(view.id)}
                        >
                          <IconCopy size={13} />
                          <span>{copiedId === view.id ? "Copied" : "Copy"}</span>
                        </button>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {view?.kind === "error" && (
              <div className="card card--error">
                <div className="error-title-row">
                  <IconAlertCircle size={20} />
                  <h3>We could not submit your ticket</h3>
                </div>
                <p>{view.message}</p>
              </div>
            )}

            {view?.kind === "triage" && (
              <CustomerTriageCard
                ticket={view.ticket}
                onCopy={handleCopy}
                copiedId={copiedId}
                statusOverride={statusOverrides[view.ticket.ticketId]}
              />
            )}
          </div>
        </>
      ) : (
        <div className="my-tickets-section">
          <div className="section-header-row">
            <div>
              <h2>Your Submitted Tickets</h2>
              <span className="meta">Tickets registered for {user?.email}</span>
            </div>
            <button
              className="btn btn--ghost-dark"
              onClick={loadMyTickets}
              disabled={loadingTickets}
            >
              <IconRefresh size={14} />
              <span>{loadingTickets ? "Refreshing..." : "Refresh Status"}</span>
            </button>
          </div>

          {loadingTickets && (
            <p className="meta">Checking your tickets in AWS DynamoDB...</p>
          )}

          {!loadingTickets && myTickets.length === 0 && (
            <div className="card empty-card">
              <p>You have not submitted any tickets with this account ({user?.email}) yet.</p>
              <button className="btn btn--primary" onClick={() => setActiveTab("report")}>
                Submit Your First Ticket
              </button>
            </div>
          )}

          <div className="tickets-grid">
            {myTickets.map((t) => {
              const currentStatus = statusOverrides[t.ticketId] || t.status || "CLASSIFIED";
              const isResolved = currentStatus === "RESOLVED";
              const isInProgress = currentStatus === "IN PROGRESS";

              return (
                <div
                  key={t.ticketId}
                  className={`card ticket-summary-card ticket-summary--${(t.urgency || "pending").toLowerCase()} ${
                    isResolved ? "ticket-summary-card--resolved" : ""
                  }`}
                >
                  <div className="ticket-card-header">
                    <div className="ticket-badge-group">
                      <span className={`tag tag--${(t.urgency || "pending").toLowerCase()}`}>
                        {urgencyLabel(t.urgency)} Priority
                      </span>
                      <span
                        className={`status-pill status-pill--${currentStatus.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        {isResolved && <IconCheck size={11} />}
                        {isInProgress && <IconClock size={11} />}
                        <span>{currentStatus}</span>
                      </span>
                    </div>

                    <span className="team-pill">
                      <IconBuilding size={13} />
                      <span>{t.team ? t.team.toUpperCase() : "TRIAGE PENDING"}</span>
                    </span>
                  </div>

                  <h4>{t.summary || t.text}</h4>
                  <p className="ticket-excerpt">{t.text}</p>

                  {/* Resolved banner if marked resolved by staff */}
                  {isResolved && (
                    <div className="ticket-resolved-banner">
                      <IconCheck size={14} />
                      <span>Status: Resolved by Support Staff</span>
                    </div>
                  )}

                  {t.reason && (
                    <p className="ticket-reason">
                      <strong>AI Analysis:</strong> {t.reason}
                    </p>
                  )}

                  <div className="ticket-card-footer">
                    <span className="time-meta">{formatTime(t.createdAt)}</span>
                    <span className="ticket-id-tag">ID: {t.ticketId.slice(0, 8)}...</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
}

function CustomerTriageCard({ ticket, onCopy, copiedId, statusOverride }) {
  const level = (ticket.urgency || "pending").toLowerCase();
  const sentiment = getAISentiment(ticket.text, ticket.urgency);
  const currentStatus = statusOverride || ticket.status || "CLASSIFIED";
  const isResolved = currentStatus === "RESOLVED";

  return (
    <div className={`card triage-card triage--${level} ${isResolved ? "triage-card--resolved" : ""}`}>
      <div className="triage-card-top">
        <div className="triage-top-left">
          <span className={`tag tag--${level}`}>{urgencyLabel(ticket.urgency)} Priority</span>
          <span
            className={`status-pill status-pill--${currentStatus.toLowerCase().replace(/\s+/g, "-")}`}
          >
            {isResolved && <IconCheck size={11} />}
            <span>Status: {currentStatus}</span>
          </span>
          <span className="team-pill">
            <IconBuilding size={13} />
            <span>Assigned: {ticket.team || "General Support"}</span>
          </span>
        </div>
        <span className="ai-model-tag">
          <IconSparkles size={14} />
          <span>{ticket.classifiedBy === "groq" ? "Groq LLaMA Engine" : "Rule-Based AI Engine"}</span>
        </span>
      </div>

      <h3>{ticket.summary || "Ticket Classified Successfully"}</h3>
      {ticket.reason && (
        <p className="triage-reason">
          <strong>Why:</strong> {ticket.reason}
        </p>
      )}

      {/* Progress Timeline */}
      <div className="ticket-timeline">
        <div className="timeline-step timeline-step--done">
          <span className="step-circle">1</span>
          <span>Logged in DynamoDB</span>
        </div>
        <div className="timeline-step timeline-step--done">
          <span className="step-circle">2</span>
          <span>AI Triage & Urgency</span>
        </div>
        <div className="timeline-step timeline-step--done">
          <span className="step-circle">3</span>
          <span>Dispatched to {ticket.team || "Team"}</span>
        </div>
        <div className={`timeline-step ${isResolved ? "timeline-step--done timeline-step--resolved" : ""}`}>
          <span className="step-circle">{isResolved ? <IconCheck size={10} /> : "4"}</span>
          <span>{isResolved ? "Agent Resolved" : "Agent Resolution"}</span>
        </div>
      </div>

      <div className="triage-footer">
        <div className="meta-copy">
          Ticket Tracking ID: <code>{ticket.ticketId}</code>
          <button
            type="button"
            className="btn-copy"
            onClick={() => onCopy(ticket.ticketId)}
          >
            <IconCopy size={13} />
            <span>{copiedId === ticket.ticketId ? "Copied" : "Copy"}</span>
          </button>
        </div>
        <span className="sentiment-indicator" style={{ color: sentiment.color }}>
          Sentiment: {sentiment.label}
        </span>
      </div>
    </div>
  );
}
