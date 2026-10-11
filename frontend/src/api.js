// Edit API_BASE here if the backend URL (or stage) ever changes. No trailing slash.
// Edit API_BASE here or set VITE_API_BASE in .env. No trailing slash.

export const API_BASE =
  (import.meta.env && import.meta.env.VITE_API_BASE) ||
  "https://1jgh0qrgfg.execute-api.ap-southeast-2.amazonaws.com";

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
    classifiedBy: t.classifiedBy || "",
    createdAt: t.createdAt || "",
  };
}

function normalizeList(data) {
  const list = Array.isArray(data) ? data : (data && (data.tickets || data.items)) || [];
  return list.map(normalizeTicket);
}

// User-specific ticket tracking prefix
const USER_TICKETS_PREFIX = "triage_user_tickets_";

export function getUserTicketIds(email) {
  if (!email) return [];
  try {
    const key = USER_TICKETS_PREFIX + email.trim().toLowerCase();
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}

export function saveUserTicketId(email, id) {
  if (!email || !id) return;
  try {
    const key = USER_TICKETS_PREFIX + email.trim().toLowerCase();
    const list = getUserTicketIds(email);
    if (!list.includes(id)) {
      list.unshift(id);
      localStorage.setItem(key, JSON.stringify(list));
    }
  } catch {}
}

// Legacy fallback
export function getMyTicketIds(email) {
  if (email) return getUserTicketIds(email);
  try {
    return JSON.parse(localStorage.getItem("triage_my_ticket_ids") || "[]");
  } catch {
    return [];
  }
}

export function saveMyTicketId(id, email) {
  if (email) {
    saveUserTicketId(email, id);
    return;
  }
  try {
    const list = JSON.parse(localStorage.getItem("triage_my_ticket_ids") || "[]");
    if (!list.includes(id)) {
      list.unshift(id);
      localStorage.setItem("triage_my_ticket_ids", JSON.stringify(list));
    }
  } catch {}
}

export async function submitTicket(text, userEmail = "") {
  const data = await request("/tickets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const id = data && (data.ticketId || data.id);
  if (!id) throw new Error("The server did not return a ticket ID.");
  if (userEmail) {
    saveUserTicketId(userEmail, id);
  } else {
    saveMyTicketId(id);
  }
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

// Staff ticket resolution state stored in localStorage for demo responsiveness
const RESOLVED_TICKETS_KEY = "triage_staff_ticket_status";
export function getTicketStatusOverrides() {
  try {
    return JSON.parse(localStorage.getItem(RESOLVED_TICKETS_KEY) || "{}");
  } catch {
    return {};
  }
}

export function setTicketStatusOverride(id, status) {
  try {
    const map = getTicketStatusOverrides();
    map[id] = status;
    localStorage.setItem(RESOLVED_TICKETS_KEY, JSON.stringify(map));
    window.dispatchEvent(new Event("triage_status_updated"));
  } catch {}
}

// AI Severity & Sentiment inference helpers for display
export function getAISentiment(text = "", urgency = "") {
  const lower = text.toLowerCase();
  if (urgency === "HIGH" || lower.includes("urgent") || lower.includes("crash") || lower.includes("broken") || lower.includes("frustrated")) {
    return { label: "High Frustration / Escalated", color: "var(--high)", score: 88 };
  }
  if (urgency === "MEDIUM" || lower.includes("fail") || lower.includes("problem") || lower.includes("waiting")) {
    return { label: "Dissatisfied / Blocked", color: "var(--medium)", score: 64 };
  }
  return { label: "Neutral / Inquiring", color: "var(--low)", score: 28 };
}
