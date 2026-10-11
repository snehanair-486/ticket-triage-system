import React, { useEffect, useMemo, useState } from "react";
import {
  listTickets,
  urgencyLabel,
  formatTime,
  getAISentiment,
  getTicketStatusOverrides,
  setTicketStatusOverride,
} from "./api.js";
import {
  IconShield,
  IconLock,
  IconSearch,
  IconCopy,
  IconSparkles,
  IconBuilding,
  IconCheck,
  IconClock,
  IconArrowLeft,
} from "./Icons.jsx";

const REFRESH_MS = 5000;
const RANK = { HIGH: 0, MEDIUM: 1, LOW: 2 };
const rank = (t) => (t.urgency in RANK ? RANK[t.urgency] : 3);

export default function StaffPortal({ user, onLogout, onBackToSelect }) {
  const [tickets, setTickets] = useState([]);
  const [statusText, setStatusText] = useState("Connecting to AWS API Gateway...");
  const [isError, setIsError] = useState(false);
  const [urgencyFilter, setUrgencyFilter] = useState("all");
  const [teamFilter, setTeamFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [dedup, setDedup] = useState(true);
  const [openIds, setOpenIds] = useState(() => new Set());
  const [statusOverrides, setStatusOverrides] = useState(() => getTicketStatusOverrides());
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    let stop = false;
    async function load() {
      try {
        const data = await listTickets();
        if (stop) return;
        setTickets(data);
        setStatusText("Synchronized with DynamoDB • " + new Date().toLocaleTimeString());
        setIsError(false);
      } catch (e) {
        if (!stop) {
          setStatusText("Cannot reach API: " + e.message + " Retrying in 5s...");
          setIsError(true);
        }
      }
    }
    load();
    const timer = setInterval(() => {
      if (!document.hidden) load();
    }, REFRESH_MS);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, []);

  function toggleRow(id, isOpen) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      isOpen ? next.add(id) : next.delete(id);
      return next;
    });
  }

  function handleStatusChange(id, newStatus) {
    setTicketStatusOverride(id, newStatus);
    setStatusOverrides(getTicketStatusOverrides());
  }

  function handleCopy(id) {
    navigator.clipboard?.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  // Filter and deduplicate tickets
  const filteredTickets = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const raw = tickets.filter((t) => {
      const currentStatus = statusOverrides[t.ticketId] || t.status || "CLASSIFIED";
      if (statusFilter !== "all" && currentStatus !== statusFilter) return false;
      if (urgencyFilter === "PENDING" && t.urgency) return false;
      if (urgencyFilter !== "all" && urgencyFilter !== "PENDING" && t.urgency !== urgencyFilter) return false;
      if (teamFilter !== "all" && t.team !== teamFilter) return false;
      if (q) {
        const textMatch = t.text.toLowerCase().includes(q);
        const idMatch = t.ticketId.toLowerCase().includes(q);
        const reasonMatch = (t.reason || "").toLowerCase().includes(q);
        const summaryMatch = (t.summary || "").toLowerCase().includes(q);
        if (!textMatch && !idMatch && !reasonMatch && !summaryMatch) return false;
      }
      return true;
    });

    if (!dedup) {
      return raw.sort((a, b) => rank(a) - rank(b) || (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
    }

    // Group identical text incidents
    const groups = new Map();
    for (const t of raw) {
      const key = (t.text || "").trim().toLowerCase();
      if (!groups.has(key)) {
        groups.set(key, { ...t, count: 1 });
      } else {
        const existing = groups.get(key);
        existing.count += 1;
        if (t.createdAt > existing.createdAt) {
          existing.createdAt = t.createdAt;
          existing.ticketId = t.ticketId;
        }
      }
    }

    return Array.from(groups.values()).sort(
      (a, b) => rank(a) - rank(b) || (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0)
    );
  }, [tickets, urgencyFilter, teamFilter, statusFilter, searchTerm, dedup, statusOverrides]);

  const count = (u) => tickets.filter((t) => t.urgency === u).length;
  const high = count("HIGH");
  const med = count("MEDIUM");
  const low = count("LOW");
  const total = tickets.length || 1;

  return (
    <main className="page page--wide">
      {/* Staff Header Banner */}
      <div className="staff-header-banner">
        <div>
          <div className="portal-badge-row">
            <span className="badge badge--staff">
              <IconShield size={14} />
              <span>Staff Triage Operations</span>
            </span>
            <span className="user-greeting">
              Logged in as <strong>{user?.name || "Agent"}</strong> ({user?.dept || "Tier 1 Support"})
            </span>
          </div>
          <h1>AI Triage Command Center</h1>
          <p className="lede">
            Real-time incident ingestion stream. Review AI classifications, prioritize high-impact outages, and manage ticket lifecycle.
          </p>
        </div>
        <div className="staff-header-actions-col">
          <div className="connection-pill" style={{ borderColor: isError ? "var(--high)" : "var(--low)" }}>
            <span className={`dot ${isError ? "dot--error" : "dot--pulse"}`} />
            <span>{statusText}</span>
          </div>
          <div className="staff-btn-row">
            {onBackToSelect && (
              <button
                type="button"
                className="btn btn--ghost-dark"
                onClick={onBackToSelect}
                title="Return to Portal Selection"
              >
                Switch Portal
              </button>
            )}
            {onLogout && (
              <button
                type="button"
                className="btn btn--staff-lock"
                onClick={onLogout}
                title="Lock terminal and end staff session"
              >
                <IconLock size={14} />
                <span>Lock & Sign Out</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Analytics Metric Cards */}
      <div className="analytics-grid" aria-live="polite">
        <div className="stat-card">
          <span className="stat-label">Total Ingested</span>
          <b className="stat-number">{tickets.length}</b>
          <span className="stat-meta">Active DynamoDB items</span>
        </div>
        <div className="stat-card stat-card--high">
          <span className="stat-label">High Urgency</span>
          <b className="stat-number">{high}</b>
          <span className="stat-meta">{((high / total) * 100).toFixed(0)}% of total volume</span>
        </div>
        <div className="stat-card stat-card--med">
          <span className="stat-label">Medium Priority</span>
          <b className="stat-number">{med}</b>
          <span className="stat-meta">{((med / total) * 100).toFixed(0)}% of volume</span>
        </div>
        <div className="stat-card stat-card--low">
          <span className="stat-label">Low / Routine</span>
          <b className="stat-number">{low}</b>
          <span className="stat-meta">{((low / total) * 100).toFixed(0)}% of volume</span>
        </div>
      </div>

      {/* Volume Distribution Bar */}
      <div className="mix-bar" aria-hidden="true">
        <i className="m-high" style={{ width: (high / total) * 100 + "%" }} title={`High: ${high}`} />
        <i className="m-medium" style={{ width: (med / total) * 100 + "%" }} title={`Medium: ${med}`} />
        <i className="m-low" style={{ width: (low / total) * 100 + "%" }} title={`Low: ${low}`} />
      </div>

      {/* Advanced Filter Toolbar */}
      <div className="staff-toolbar">
        <div className="search-wrap">
          <IconSearch size={16} className="search-icon" />
          <input
            type="search"
            placeholder="Search keywords, customer text, or ticket ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="toolbar-controls">
          <label>
            Urgency:
            <select value={urgencyFilter} onChange={(e) => setUrgencyFilter(e.target.value)}>
              <option value="all">All Urgencies ({tickets.length})</option>
              <option value="HIGH">High Priority ({high})</option>
              <option value="MEDIUM">Medium Priority ({med})</option>
              <option value="LOW">Low Priority ({low})</option>
              <option value="PENDING">Analysing</option>
            </select>
          </label>

          <label>
            Department:
            <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
              <option value="all">All Departments</option>
              <option value="tech">Tech & Infra</option>
              <option value="finance">Finance & Billing</option>
              <option value="account">Account Access</option>
              <option value="general">General Support</option>
            </select>
          </label>

          <label>
            View:
            <select value={dedup ? "grouped" : "all"} onChange={(e) => setDedup(e.target.value === "grouped")}>
              <option value="grouped">Grouped Incidents ({filteredTickets.length})</option>
              <option value="all">All Raw Invocations ({tickets.length})</option>
            </select>
          </label>
        </div>
      </div>

      {/* Queue List */}
      <div className="ticket-queue-list">
        {filteredTickets.length === 0 && (
          <div className="card empty-card">
            <p>
              {tickets.length ? "No tickets match your active search filters." : "No tickets yet. Ingestion pipeline is standing by."}
            </p>
          </div>
        )}

        {filteredTickets.map((t) => {
          const currentStatus = statusOverrides[t.ticketId] || t.status || "CLASSIFIED";
          const sentiment = getAISentiment(t.text, t.urgency);
          const isOpen = openIds.has(t.ticketId);

          return (
            <details
              key={t.ticketId}
              className={`row row--${(t.urgency || "pending").toLowerCase()} ${currentStatus === "RESOLVED" ? "row--resolved" : ""}`}
              open={isOpen}
              onToggle={(e) => toggleRow(t.ticketId, e.currentTarget.open)}
            >
              <summary className="row-head">
                <span className={`tag tag--${(t.urgency || "pending").toLowerCase()}`}>
                  {urgencyLabel(t.urgency)}
                </span>

                {t.count > 1 && (
                  <span className="tag tag--count" title={`${t.count} duplicate complaints combined`}>
                    {t.count} reports
                  </span>
                )}

                <span className="row-main">
                  <strong>{t.summary || t.text}</strong>
                </span>

                <span className="row-team">
                  <IconBuilding size={13} />
                  <span>{t.team ? t.team.toUpperCase() : "GENERAL"}</span>
                </span>

                <span className={`status-pill status-pill--${currentStatus.toLowerCase().replace(/\s+/g, "-")}`}>
                  {currentStatus}
                </span>

                <time className="row-time">{formatTime(t.createdAt)}</time>
              </summary>

              <div className="row-body">
                <div className="inspector-grid">
                  <div className="inspector-main">
                    <h4>Customer Statement:</h4>
                    <p className="complaint-quote">"{t.text}"</p>

                    {t.reason && (
                      <div className="ai-explanation-box">
                        <div className="ai-expl-header">
                          <IconSparkles size={16} />
                          <strong>AI Classification Rationale:</strong>
                        </div>
                        <p>{t.reason}</p>
                      </div>
                    )}
                  </div>

                  <div className="inspector-sidebar">
                    <div className="ai-metric-panel">
                      <div className="metric-row">
                        <span>Urgency Severity:</span>
                        <strong style={{ color: sentiment.color }}>{sentiment.score}/100</strong>
                      </div>
                      <div className="severity-bar">
                        <div className="severity-fill" style={{ width: sentiment.score + "%", background: sentiment.color }} />
                      </div>

                      <div className="metric-row">
                        <span>Customer Sentiment:</span>
                        <span className="sentiment-tag" style={{ color: sentiment.color }}>
                          {sentiment.label}
                        </span>
                      </div>

                      <div className="metric-row">
                        <span>Model Pipeline:</span>
                        <span className="model-chip">
                          {t.classifiedBy === "groq" ? "Groq LLaMA 20B" : "Rule-Based Engine"}
                        </span>
                      </div>
                    </div>

                    {/* Agent Status Actions */}
                    <div className="agent-action-box">
                      <span className="action-title">Incident Actions:</span>
                      <div className="action-btn-group">
                        <button
                          type="button"
                          className={`btn-action ${currentStatus === "IN PROGRESS" ? "btn-action--active" : ""}`}
                          onClick={() => handleStatusChange(t.ticketId, "IN PROGRESS")}
                        >
                          <IconClock size={13} />
                          <span>In Progress</span>
                        </button>
                        <button
                          type="button"
                          className={`btn-action ${currentStatus === "RESOLVED" ? "btn-action--active" : ""}`}
                          onClick={() => handleStatusChange(t.ticketId, "RESOLVED")}
                        >
                          <IconCheck size={13} />
                          <span>Resolved</span>
                        </button>
                      </div>
                    </div>

                    <div className="ticket-id-meta">
                      <code>ID: {t.ticketId}</code>
                      <button type="button" className="btn-copy" onClick={() => handleCopy(t.ticketId)}>
                        <IconCopy size={13} />
                        <span>{copiedId === t.ticketId ? "Copied" : "Copy"}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </main>
  );
}
