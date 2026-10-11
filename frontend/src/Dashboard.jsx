import { useEffect, useMemo, useState } from "react";
import { listTickets, urgencyLabel, formatTime } from "./api.js";

const REFRESH_MS = 5000;
const RANK = { HIGH: 0, MEDIUM: 1, LOW: 2 };
const rank = (t) => (t.urgency in RANK ? RANK[t.urgency] : 3);

export default function Dashboard() {
  const [tickets, setTickets] = useState([]);
  const [status, setStatus] = useState({ text: "Loading tickets...", error: false });
  const [urgency, setUrgency] = useState("all");
  const [team, setTeam] = useState("all");
  const [open, setOpen] = useState(() => new Set());

  useEffect(() => {
    let stop = false;
    async function load() {
      try {
        const data = await listTickets();
        if (stop) return;
        setTickets(data);
        setStatus({ text: "Updated " + new Date().toLocaleTimeString(), error: false });
      } catch (e) {
        if (!stop) setStatus({ text: "Can't load tickets: " + e.message + " Retrying every 5 seconds.", error: true });
      }
    }
    load();
    const timer = setInterval(() => { if (!document.hidden) load(); }, REFRESH_MS);
    return () => { stop = true; clearInterval(timer); };
  }, []);

  const shown = useMemo(() => {
    return tickets
      .filter((t) => {
        if (urgency === "PENDING" && t.urgency) return false;
        if (urgency !== "all" && urgency !== "PENDING" && t.urgency !== urgency) return false;
        if (team !== "all" && t.team !== team) return false;
        return true;
      })
      .sort((a, b) => rank(a) - rank(b) || (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  }, [tickets, urgency, team]);

  const count = (u) => tickets.filter((t) => t.urgency === u).length;
  const high = count("HIGH"), med = count("MEDIUM"), low = count("LOW");
  const analysing = tickets.filter((t) => !t.urgency).length;
  const total = tickets.length || 1;

  function toggle(id, isOpen) {
    setOpen((prev) => {
      const next = new Set(prev);
      isOpen ? next.add(id) : next.delete(id);
      return next;
    });
  }

  return (
    <main className="page page--wide">
      <h1>Ticket queue</h1>
      <p className="lede">The most urgent tickets are at the top. Select a ticket to read the full message.</p>

      <div className="stats" aria-live="polite">
        <Stat n={tickets.length} label="total tickets" />
        <Stat n={high} label="high priority" cls="high" />
        <Stat n={analysing} label="being analysed" />
      </div>
      <div className="mix" aria-hidden="true">
        <i className="m-high" style={{ width: (high / total) * 100 + "%" }} />
        <i className="m-medium" style={{ width: (med / total) * 100 + "%" }} />
        <i className="m-low" style={{ width: (low / total) * 100 + "%" }} />
      </div>

      <div className="toolbar">
        <label>Urgency
          <select value={urgency} onChange={(e) => setUrgency(e.target.value)}>
            <option value="all">All urgencies</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
            <option value="PENDING">Analysing</option>
          </select>
        </label>
        <label>Team
          <select value={team} onChange={(e) => setTeam(e.target.value)}>
            <option value="all">All teams</option>
            <option value="finance">Finance</option>
            <option value="tech">Tech</option>
            <option value="account">Account</option>
            <option value="general">General</option>
          </select>
        </label>
      </div>

      <p id="updated" className={"meta" + (status.error ? " error" : "")} aria-live="polite">{status.text}</p>

      <div className="list">
        {shown.length === 0 && (
          <p className="empty">
            {tickets.length ? "No tickets match these filters." : "No tickets yet. New tickets appear here within a few seconds."}
          </p>
        )}
        {shown.map((t) => (
          <details
            key={t.ticketId}
            className={"row row--" + (t.urgency || "pending").toLowerCase()}
            open={open.has(t.ticketId)}
            onToggle={(e) => toggle(t.ticketId, e.currentTarget.open)}
          >
            <summary className="row-head">
              <span className={"tag tag--" + (t.urgency || "pending").toLowerCase()}>{urgencyLabel(t.urgency)}</span>
              <span className="row-main">{t.summary || t.text}</span>
              <span className="row-team">{t.team || "Unassigned"}</span>
              <time className="row-time">{formatTime(t.createdAt)}</time>
            </summary>
            <div className="row-body">
              <p>{t.text}</p>
              {t.reason && <p className="meta">Why: {t.reason}</p>}
              <p className="meta">Status: {t.status}</p>
              <p className="meta">Ticket ID: {t.ticketId}</p>
            </div>
          </details>
        ))}
      </div>
    </main>
  );
}

function Stat({ n, label, cls }) {
  return (
    <div className={"stat" + (cls ? " stat--" + cls : "")}>
      <b>{n}</b>
      <span>{label}</span>
    </div>
  );
}
