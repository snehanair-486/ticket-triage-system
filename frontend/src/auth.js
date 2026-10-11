/**
 * Smart Triage Security & Identity Service
 * Role-Based Access Control (RBAC), Session Management & Credential Verification
 */

// 3 Authorized Internal Staff Accounts (Only defined in code, not displayed in UI)
export const AUTHORIZED_STAFF_USERS = [
  {
    username: "staff1",
    email: "staff1@triage.internal",
    password: "staff1@123",
    name: "Staff Member 1",
    dept: "Tier 1 Support",
    role: "staff",
    badgeId: "STF-001",
    clearance: "Level 1 Support Specialist",
  },
  {
    username: "staff2",
    email: "staff2@triage.internal",
    password: "staff2@123",
    name: "Staff Member 2",
    dept: "Technical Operations",
    role: "staff",
    badgeId: "STF-002",
    clearance: "Level 2 Incident Lead",
  },
  {
    username: "staff3",
    email: "staff3@triage.internal",
    password: "staff3@123",
    name: "Staff Member 3",
    dept: "System Administration",
    role: "staff",
    badgeId: "STF-003",
    clearance: "Operations Administrator",
  },
];

const STAFF_SESSION_KEY = "triage_staff_session";
const CUSTOMER_SESSION_KEY = "triage_customer_session";
const CUSTOMER_ACCOUNTS_KEY = "triage_registered_customers";
const LOCKOUT_KEY = "triage_auth_lockout_state";
const AUDIT_LOG_KEY = "triage_security_audit_log";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 1000; // 30 seconds cooldown
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours

/**
 * Audit log recording
 */
export function recordAuditLog(eventType, email, role, success, details = "") {
  try {
    const raw = localStorage.getItem(AUDIT_LOG_KEY);
    const logs = raw ? JSON.parse(raw) : [];
    logs.unshift({
      id: "LOG-" + Math.random().toString(36).substring(2, 9).toUpperCase(),
      timestamp: new Date().toISOString(),
      eventType,
      email,
      role,
      success,
      details,
    });
    // Keep last 40 entries
    localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(logs.slice(0, 40)));
  } catch {}
}

export function getAuditLogs() {
  try {
    const raw = localStorage.getItem(AUDIT_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Check lockout status
 */
export function getLockoutStatus() {
  try {
    const raw = localStorage.getItem(LOCKOUT_KEY);
    if (!raw) return { isLocked: false, remainingSeconds: 0, attempts: 0 };
    const data = JSON.parse(raw);
    const now = Date.now();
    if (data.lockedUntil && data.lockedUntil > now) {
      const remaining = Math.ceil((data.lockedUntil - now) / 1000);
      return { isLocked: true, remainingSeconds: remaining, attempts: data.attempts || MAX_FAILED_ATTEMPTS };
    }
    // Expired lock
    if (data.lockedUntil && data.lockedUntil <= now) {
      localStorage.removeItem(LOCKOUT_KEY);
      return { isLocked: false, remainingSeconds: 0, attempts: 0 };
    }
    return { isLocked: false, remainingSeconds: 0, attempts: data.attempts || 0 };
  } catch {
    return { isLocked: false, remainingSeconds: 0, attempts: 0 };
  }
}

function recordFailedAttempt(identifier) {
  try {
    const status = getLockoutStatus();
    const attempts = status.attempts + 1;
    let lockedUntil = null;
    if (attempts >= MAX_FAILED_ATTEMPTS) {
      lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
    }
    localStorage.setItem(LOCKOUT_KEY, JSON.stringify({ attempts, lockedUntil, lastAttempt: Date.now() }));
    recordAuditLog("STAFF_LOGIN_FAILED", identifier, "staff", false, `Attempt ${attempts}/${MAX_FAILED_ATTEMPTS}`);
  } catch {}
}

function resetFailedAttempts() {
  try {
    localStorage.removeItem(LOCKOUT_KEY);
  } catch {}
}

/**
 * Generate Secure Token
 */
function createToken(identifier, role) {
  const payload = `${identifier}:${role}:${Date.now()}:${Math.random().toString(36).substring(2)}`;
  return btoa(payload);
}

/**
 * STAFF AUTHENTICATION
 * Accepts username (e.g. staff1, staff2, staff3) or full internal email.
 */
export function authenticateStaff(identifier, password, remember = false) {
  const lockout = getLockoutStatus();
  if (lockout.isLocked) {
    throw new Error(
      `Security Lockout Active: Too many failed login attempts. Terminal locked for ${lockout.remainingSeconds} more seconds.`
    );
  }

  const cleanId = (identifier || "").trim().toLowerCase();
  const cleanPass = (password || "").trim();

  if (!cleanId || !cleanPass) {
    throw new Error("Please enter both staff identifier and password.");
  }

  const staffUser = AUTHORIZED_STAFF_USERS.find(
    (u) =>
      u.email.toLowerCase() === cleanId ||
      u.username.toLowerCase() === cleanId ||
      u.email.toLowerCase().startsWith(cleanId + "@")
  );

  if (!staffUser || staffUser.password !== cleanPass) {
    recordFailedAttempt(cleanId);
    const updatedLock = getLockoutStatus();
    if (updatedLock.isLocked) {
      throw new Error(
        `Access Denied. Account locked for ${updatedLock.remainingSeconds} seconds due to repeated failed attempts.`
      );
    }
    throw new Error(
      `Invalid staff credentials. Unauthorized access is audited. (${MAX_FAILED_ATTEMPTS - updatedLock.attempts} attempts remaining)`
    );
  }

  // Success
  resetFailedAttempts();
  const token = createToken(staffUser.username, "staff");
  const expiresAt = Date.now() + SESSION_DURATION_MS;

  const session = {
    role: "staff",
    username: staffUser.username,
    email: staffUser.email,
    name: staffUser.name,
    dept: staffUser.dept,
    badgeId: staffUser.badgeId,
    clearance: staffUser.clearance,
    token,
    expiresAt,
    authenticatedAt: new Date().toISOString(),
  };

  const payload = JSON.stringify(session);
  if (remember) {
    localStorage.setItem(STAFF_SESSION_KEY, payload);
    sessionStorage.removeItem(STAFF_SESSION_KEY);
  } else {
    sessionStorage.setItem(STAFF_SESSION_KEY, payload);
    localStorage.removeItem(STAFF_SESSION_KEY);
  }

  recordAuditLog("STAFF_LOGIN_SUCCESS", staffUser.username, "staff", true, `Clearance: ${staffUser.clearance}`);
  return session;
}

export function getStaffSession() {
  try {
    const raw = sessionStorage.getItem(STAFF_SESSION_KEY) || localStorage.getItem(STAFF_SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session || session.role !== "staff" || !session.token) return null;
    if (session.expiresAt && Date.now() > session.expiresAt) {
      logoutStaff();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function logoutStaff() {
  const current = getStaffSession();
  if (current) {
    recordAuditLog("STAFF_LOGOUT", current.username || current.email, "staff", true, "Session cleared");
  }
  try {
    sessionStorage.removeItem(STAFF_SESSION_KEY);
    localStorage.removeItem(STAFF_SESSION_KEY);
  } catch {}
}

/**
 * CUSTOMER AUTHENTICATION & REGISTRATION
 * No hardcoded accounts. Registered accounts stored locally in browser storage.
 */
function getRegisteredCustomers() {
  try {
    const raw = localStorage.getItem(CUSTOMER_ACCOUNTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function authenticateCustomer(email, password, remember = false) {
  const cleanEmail = (email || "").trim().toLowerCase();
  const cleanPass = (password || "").trim();

  if (!cleanEmail || !cleanPass) {
    throw new Error("Please enter both customer email and password.");
  }

  const customers = getRegisteredCustomers();
  const match = customers.find((c) => c.email.toLowerCase() === cleanEmail);

  if (!match || match.password !== cleanPass) {
    throw new Error("Invalid customer credentials. Please check your email or create a new account.");
  }

  const session = {
    role: "customer",
    email: match.email,
    name: match.name,
    token: createToken(match.email, "customer"),
    expiresAt: Date.now() + SESSION_DURATION_MS,
    authenticatedAt: new Date().toISOString(),
  };

  const payload = JSON.stringify(session);
  if (remember) {
    localStorage.setItem(CUSTOMER_SESSION_KEY, payload);
    sessionStorage.removeItem(CUSTOMER_SESSION_KEY);
  } else {
    sessionStorage.setItem(CUSTOMER_SESSION_KEY, payload);
    localStorage.removeItem(CUSTOMER_SESSION_KEY);
  }

  recordAuditLog("CUSTOMER_LOGIN", match.email, "customer", true);
  return session;
}

export function registerCustomer(name, email, password, remember = false) {
  const cleanName = (name || "").trim();
  const cleanEmail = (email || "").trim().toLowerCase();
  const cleanPass = (password || "").trim();

  if (!cleanName || !cleanEmail || !cleanPass) {
    throw new Error("All fields (Name, Email, Password) are required.");
  }
  if (cleanPass.length < 6) {
    throw new Error("Password must be at least 6 characters long.");
  }

  const customers = getRegisteredCustomers();
  if (customers.some((c) => c.email.toLowerCase() === cleanEmail)) {
    throw new Error("An account with this email already exists. Please sign in.");
  }

  const newAccount = {
    name: cleanName,
    email: cleanEmail,
    password: cleanPass,
    role: "customer",
    registeredAt: new Date().toISOString(),
  };

  customers.push(newAccount);
  try {
    localStorage.setItem(CUSTOMER_ACCOUNTS_KEY, JSON.stringify(customers));
  } catch {}

  return authenticateCustomer(cleanEmail, cleanPass, remember);
}

export function getCustomerSession() {
  try {
    const raw = sessionStorage.getItem(CUSTOMER_SESSION_KEY) || localStorage.getItem(CUSTOMER_SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session || session.role !== "customer" || !session.token) return null;
    if (session.expiresAt && Date.now() > session.expiresAt) {
      logoutCustomer();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function logoutCustomer() {
  const current = getCustomerSession();
  if (current) {
    recordAuditLog("CUSTOMER_LOGOUT", current.email, "customer", true, "Customer session cleared");
  }
  try {
    sessionStorage.removeItem(CUSTOMER_SESSION_KEY);
    localStorage.removeItem(CUSTOMER_SESSION_KEY);
  } catch {}
}
