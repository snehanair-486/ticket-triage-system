import { useEffect, useRef, useState } from "react";
import { submitTicket, getTicket, urgencyLabel } from "./api.js";

const MAX = 2000;
const POLL_MS = 2000;
const POLL_MAX = 20;

export default function ReportPage() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState(null); // { kind: "status" | "error" | "triage", ... }
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

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
      } catch { /* keep trying: result may not be ready */ }
    }
    setView({
      kind: "status", id, done: true,
      message: "Your ticket is saved, but rating it is taking longer than usual. Staff can already see it in the queue.",
    });
  }

  async function onSubmit(e) {
    e.preventDefault();
    const body = text.trim();
    if (!body) {
      setView({ kind: "error", message: "Describe your problem before sending." });
      return;
    }
    setBusy(true);
    setView({ kind: "status", message: "Sending your ticket..." });
    try {
      const id = await submitTicket(body);
      setText("");
      setView({ kind: "status", id, message: "Ticket received. Rating how urgent it is..." });
      await waitForResult(id);
    } catch (err) {
      setView({ kind: "error", message: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <h1>Report a problem</h1>
      <p className="lede">Describe what happened. We rate how urgent it is and send it to the right team.</p>

      <form onSubmit={onSubmit} noValidate>
        <label className="field-label" htmlFor="text">What went wrong?</label>
        <textarea
          id="text" maxLength={MAX} value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Example: I have been trying to check out for an hour and my payment keeps failing."
        />
        <div className="field-foot">
          <span>Include what you tried and what you expected.</span>
          <span>{text.length} / {MAX}</span>
        </div>
        <button className="btn" type="submit" disabled={busy}>Send ticket</button>
      </form>

      <div className="result" aria-live="polite">
        {view?.kind === "status" && (
          <div className="card">
            <p className="status">
              {!view.done && <span className="spinner" aria-hidden="true" />}
              <span>{view.message}</span>
            </p>
            {view.id && <p className="meta">Ticket ID: {view.id}</p>}
          </div>
        )}
        {view?.kind === "error" && (
          <div className="card card--error">
            <h2>We could not send your ticket</h2>
            <p>{view.message}</p>
          </div>
        )}
        {view?.kind === "triage" && <Triage t={view.ticket} />}
      </div>
    </main>
  );
}

function Triage({ t }) {
  const level = (t.urgency || "pending").toLowerCase();
  return (
    <div className={"card triage triage--" + level}>
      <h2>{urgencyLabel(t.urgency)} priority</h2>
      <p>Sent to the {t.team || "general"} team.</p>
      {t.summary && <p>{t.summary}</p>}
      {t.reason && <p className="meta">Why: {t.reason}</p>}
      <p className="meta">Ticket ID: {t.ticketId}</p>
    </div>
  );
}
