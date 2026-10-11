import { useEffect, useRef, useState } from "react";
import { submitTicket, getTicket, listTickets, getMyTicketIds, urgencyLabel, formatTime, getAISentiment } from "./api.js";

const MAX = 2000;
const POLL_MS = 2000;
const POLL_MAX = 20;

const TEMPLATES = [
  { label: "💳 Checkout Failed", text: "I have been trying to check out for over an hour and my credit card payment keeps failing at the final step." },
  { label: "🚨 App Crashing", text: "The application crashes immediately with a blank screen whenever I navigate to my account dashboard." },
  { label: "🔐 Account Access", text: "I forgot my password and the reset link emailed to me says expired. I cannot log in." },
  { label: "❓ General Inquiry", text: "How do I update the shipping address associated with an order placed earlier today?" },
];

export default function CustomerPortal({ user, onOpenAuth, onLogout }) {
  const [activeTab, setActiveTab] = useState("report"); // "report" | "my-tickets"
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState(null);
  const [myTickets, setMyTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const alive = useRef(true);

  useEffect(() => () => { alive.current = false; }, []);

  // Fetch customer's own tickets when switching to "My Tickets"
  useEffect(() => {
    if (activeTab === "my-tickets") {
      loadMyTickets();
    }
  }, [activeTab]);

  async function loadMyTickets() {
    setLoadingTickets(true);
    try {
      const all = await listTickets();
      const myIds = getMyTicketIds();
      // Match submitted IDs or fallback to showing recent tickets
      const mine = all.filter((t) => myIds.includes(t.ticketId));
      setMyTickets(mine.length > 0 ? mine : all.slice(0, 3));
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
          return;
        }
      } catch {}
    }
    setView({
      kind: "status",
      id,
      done: true,
      message: "Your ticket is safely logged in our database! AI triage is completing in the background.",
    });
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
      const id = await submitTicket(body);
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

  return (
    <main className="page">
      <div className="portal-hero">
        <div className="portal-badge-row">
          <span className="badge badge--user">👤 Customer Service Desk</span>
          <span className="user-greeting">
            Signed in as <strong>{user?.name || "Customer"}</strong> {user?.email ? `(${user.email})` : ""}
          </span>
          {onLogout && (
            <button
              type="button"
              className="btn-switch-account"
              onClick={onLogout}
              title="Sign out of customer account"
            >
              Sign Out 🚪
            </button>
          )}
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
            ✏️ Report a New Problem
          </button>
          <button
            className={`sub-tab ${activeTab === "my-tickets" ? "sub-tab--active" : ""}`}
            onClick={() => setActiveTab("my-tickets")}
          >
            📋 My Submitted Tickets {myTickets.length > 0 && `(${myTickets.length})`}
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
              <span className="helper-note">💡 Tips: Include order numbers, error messages, or steps to reproduce.</span>
              <button className="btn btn--primary" type="submit" disabled={busy}>
                {busy ? "Processing on AWS..." : "🚀 Submit Ticket"}
              </button>
            </div>
          </form>

          <div className="result-area" aria-live="polite">
            {view?.kind === "status" && (
              <div className="card card--status">
                <div className="status-indicator">
                  {!view.done ? <span className="spinner" aria-hidden="true" /> : <span className="check-icon">✓</span>}
                  <div className="status-texts">
                    <strong>{view.message}</strong>
                    {view.id && (
                      <p className="meta-copy">
                        Tracking ID: <code>{view.id}</code>
                        <button type="button" className="btn-copy" onClick={() => handleCopy(view.id)}>
                          {copiedId === view.id ? "Copied! ✓" : "Copy"}
                        </button>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {view?.kind === "error" && (
              <div className="card card--error">
                <h3>⚠️ We could not submit your ticket</h3>
                <p>{view.message}</p>
              </div>
            )}

            {view?.kind === "triage" && (
              <CustomerTriageCard ticket={view.ticket} onCopy={handleCopy} copiedId={copiedId} />
            )}
          </div>
        </>
      ) : (
        <div className="my-tickets-section">
          <div className="section-header-row">
            <h2>Your Support History</h2>
            <button className="btn btn--ghost" onClick={loadMyTickets} disabled={loadingTickets}>
              {loadingTickets ? "Refreshing..." : "🔄 Refresh Status"}
            </button>
          </div>

          {loadingTickets && <p className="meta">Loading your tickets from AWS DynamoDB...</p>}

          {!loadingTickets && myTickets.length === 0 && (
            <div className="card empty-card">
              <p>You haven't submitted any tickets in this session yet.</p>
              <button className="btn btn--primary" onClick={() => setActiveTab("report")}>
                Submit Your First Ticket
              </button>
            </div>
          )}

          <div className="tickets-grid">
            {myTickets.map((t) => (
              <div key={t.ticketId} className={`card ticket-summary-card ticket-summary--${(t.urgency || "pending").toLowerCase()}`}>
                <div className="ticket-card-header">
                  <span className={`tag tag--${(t.urgency || "pending").toLowerCase()}`}>
                    {urgencyLabel(t.urgency)} Priority
                  </span>
                  <span className="team-pill">🏢 {t.team || "Triage Pending"}</span>
                </div>
                <h4>{t.summary || t.text}</h4>
                <p className="ticket-excerpt">{t.text}</p>
                {t.reason && <p className="ticket-reason"><strong>AI Analysis:</strong> {t.reason}</p>}
                <div className="ticket-card-footer">
                  <span className="time-meta">{formatTime(t.createdAt)}</span>
                  <span className="ticket-id-tag">ID: {t.ticketId.slice(0, 8)}...</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

function CustomerTriageCard({ ticket, onCopy, copiedId }) {
  const level = (ticket.urgency || "pending").toLowerCase();
  const sentiment = getAISentiment(ticket.text, ticket.urgency);

  return (
    <div className={`card triage-card triage--${level}`}>
      <div className="triage-card-top">
        <div>
          <span className={`tag tag--${level}`}>{urgencyLabel(ticket.urgency)} Priority</span>
          <span className="team-pill">Assigned: {ticket.team || "General Support"}</span>
        </div>
        <span className="ai-model-tag">
          🤖 {ticket.classifiedBy === "groq" ? "Groq LLaMA Engine" : "Hybrid Heuristic AI"}
        </span>
      </div>

      <h3>{ticket.summary || "Ticket Classified Successfully"}</h3>
      {ticket.reason && <p className="triage-reason"><strong>Why:</strong> {ticket.reason}</p>}

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
        <div className="timeline-step">
          <span className="step-circle">4</span>
          <span>Agent Resolution</span>
        </div>
      </div>

      <div className="triage-footer">
        <div className="meta-copy">
          Ticket Tracking ID: <code>{ticket.ticketId}</code>
          <button type="button" className="btn-copy" onClick={() => onCopy(ticket.ticketId)}>
            {copiedId === ticket.ticketId ? "Copied! ✓" : "Copy"}
          </button>
        </div>
        <span className="sentiment-indicator" style={{ color: sentiment.color }}>
          Sentiment: {sentiment.label}
        </span>
      </div>
    </div>
  );
}
