// Edit API_BASE here if the backend URL (or stage) ever changes. No trailing slash.
// Edit API_BASE here or set VITE_API_BASE in .env. No trailing slash.
export const API_BASE = (import.meta.env && import.meta.env.VITE_API_BASE) || "https://1jgh0qrgfg.execute-api.ap-southeast-2.amazonaws.com";

export function urgencyLabel(urgency) {
  return urgency ? urgency.charAt(0) + urgency.slice(1).toLowerCase() : "Analysing";
}

export function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

async function request(path, options) {
  let res;
  try {
    res = await fetch(API_BASE.replace(/\/+$/, "") + path, options);
  } catch {
    throw new Error("Cannot reach the server. Check your connection. If it keeps happening, the backend may be blocking this site (CORS).");
  }
  let data = null;
  try { data = await res.json(); } catch { /* body was not JSON */ }
  if (!res.ok) {
    const err = new Error((data && (data.error || data.message)) || "Request failed (" + res.status + ")");
    err.status = res.status;
    throw err;
  }
  return data;
}

function normalizeTicket(raw) {
  const t = (raw && raw.ticket) || raw || {};
  return {
    ticketId: t.ticketId || t.id || "",
    text: t.text || "",
    status: String(t.status || "PENDING").toUpperCase(),
    urgency: t.urgency ? String(t.urgency).toUpperCase() : "",
    team: t.team ? String(t.team).toLowerCase() : "",
    summary: t.summary || "",
    reason: t.reason || "",
    createdAt: t.createdAt || "",
  };
}

function normalizeList(data) {
  const list = Array.isArray(data) ? data : (data && (data.tickets || data.items)) || [];
  return list.map(normalizeTicket);
}

export async function submitTicket(text) {
  const data = await request("/tickets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const id = data && (data.ticketId || data.id);
  if (!id) throw new Error("The server did not return a ticket ID.");
  return id;
}

export async function listTickets() {
  return normalizeList(await request("/tickets"));
}

// Falls back to finding the ticket in the list if GET /tickets/{id} isn't ready.
export async function getTicket(id) {
  try {
    return normalizeTicket(await request("/tickets/" + encodeURIComponent(id)));
  } catch (e) {
    const found = (await listTickets()).find((t) => t.ticketId === id);
    if (found) return found;
    throw e;
  }
}

