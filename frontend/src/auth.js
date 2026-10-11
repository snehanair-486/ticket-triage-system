/**
 * Smart Triage Security & Identity Service
 * Role-Based Access Control (RBAC), Session Management & Credential Verification
 */

// Authorized Internal Staff Directory
export const AUTHORIZED_STAFF_USERS = [
  {
    email: "saba.support@triage.internal",
    password: "Staff@2026",
    name: "Agent Saba",
    dept: "Tier 2 Triage Lead",
    role: "staff",
    badgeId: "STF-8821",
    clearance: "Level 2 Incident Lead",
  },
  {
    email: "tech.lead@triage.internal",
    password: "Tech@2026",
    name: "Jordan Blake",
    dept: "Tech Support Engineer",
    role: "staff",
    badgeId: "STF-4419",
    clearance: "Infrastructure & Bug Triage",
  },
  {
    email: "admin@triage.internal",
    password: "Admin@2026",
    name: "Dana Scully",
    dept: "Operations Director",
    role: "staff",
    badgeId: "STF-1001",
    clearance: "Admin & Compliance Lead",
  },
];

// Default Customer Accounts
const DEFAULT_CUSTOMERS = [
  {
    email: "alex.customer@email.com",
    password: "Customer@123",
    name: "Alex Morgan",
    role: "customer",
  },
  {
    email: "sarah.t@workmail.com",
    password: "Customer@123",
    name: "Sarah Thompson",
    role: "customer",
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

function recordFailedAttempt(email) {
  try {
    const status = getLockoutStatus();
    const attempts = status.attempts + 1;
    let lockedUntil = null;
    if (attempts >= MAX_FAILED_ATTEMPTS) {
      lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
    }
    localStorage.setItem(LOCKOUT_KEY, JSON.stringify({ attempts, lockedUntil, lastAttempt: Date.now() }));
    recordAuditLog("STAFF_LOGIN_FAILED", email, "staff", false, `Attempt ${attempts}/${MAX_FAILED_ATTEMPTS}`);
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
function createToken(email, role) {
  const payload = `${email}:${role}:${Date.now()}:${Math.random().toString(36).substring(2)}`;
  return btoa(payload);
}

/**
 * STAFF AUTHENTICATION
 */
export function authenticateStaff(email, password, remember = false) {
  const lockout = getLockoutStatus();
  if (lockout.isLocked) {
    throw new Error(
      `Security Lockout Active: Too many failed login attempts. Terminal locked for ${lockout.remainingSeconds} more seconds.`
    );
  }

  const cleanEmail = (email || "").trim().toLowerCase();
  const cleanPass = (password || "").trim();

  if (!cleanEmail || !cleanPass) {
    throw new Error("Please enter both staff email address and security password.");
  }

  const staffUser = AUTHORIZED_STAFF_USERS.find(
    (u) => u.email.toLowerCase() === cleanEmail
  );

  if (!staffUser || staffUser.password !== cleanPass) {
    recordFailedAttempt(cleanEmail);
    const updatedLock = getLockoutStatus();
    if (updatedLock.isLocked) {
      throw new Error(
        `Access Denied. Account locked for ${updatedLock.remainingSeconds} seconds due to ${MAX_FAILED_ATTEMPTS} failed attempts.`
      );
    }
    throw new Error(
      `Invalid staff credentials. Unauthorized access is audited. (${MAX_FAILED_ATTEMPTS - updatedLock.attempts} attempts remaining)`
    );
  }

  // Success
  resetFailedAttempts();
  const token = createToken(staffUser.email, "staff");
  const expiresAt = Date.now() + SESSION_DURATION_MS;

  const session = {
    role: "staff",
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

  recordAuditLog("STAFF_LOGIN_SUCCESS", staffUser.email, "staff", true, `Clearance: ${staffUser.clearance}`);
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
    recordAuditLog("STAFF_LOGOUT", current.email, "staff", true, "Session cleared");
  }
  try {
    sessionStorage.removeItem(STAFF_SESSION_KEY);
    localStorage.removeItem(STAFF_SESSION_KEY);
  } catch {}
}

/**
 * CUSTOMER AUTHENTICATION
 */
function getRegisteredCustomers() {
  try {
    const raw = localStorage.getItem(CUSTOMER_ACCOUNTS_KEY);
    if (!raw) {
      localStorage.setItem(CUSTOMER_ACCOUNTS_KEY, JSON.stringify(DEFAULT_CUSTOMERS));
      return DEFAULT_CUSTOMERS;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_CUSTOMERS;
  }
}

export function authenticateCustomer(email, password) {
  const cleanEmail = (email || "").trim().toLowerCase();
  const cleanPass = (password || "").trim();

  if (!cleanEmail || !cleanPass) {
    throw new Error("Please enter your email and password.");
  }

  const customers = getRegisteredCustomers();
  const match = customers.find((c) => c.email.toLowerCase() === cleanEmail);

  if (!match || match.password !== cleanPass) {
    throw new Error("Invalid customer credentials. Please verify your email and password.");
  }

  const session = {
    role: "customer",
    email: match.email,
    name: match.name,
    token: createToken(match.email, "customer"),
    authenticatedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(CUSTOMER_SESSION_KEY, JSON.stringify(session));
  } catch {}

  recordAuditLog("CUSTOMER_LOGIN", match.email, "customer", true);
  return session;
}

export function registerCustomer(name, email, password) {
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
  };

  customers.push(newAccount);
  try {
    localStorage.setItem(CUSTOMER_ACCOUNTS_KEY, JSON.stringify(customers));
  } catch {}

  return authenticateCustomer(cleanEmail, cleanPass);
}

export function getCustomerSession() {
  try {
    const raw = localStorage.getItem(CUSTOMER_SESSION_KEY);
    if (!raw) {
      // Default initial customer session
      return {
        role: "customer",
        name: "Alex Morgan",
        email: "alex.customer@email.com",
        isGuest: false,
      };
    }
    return JSON.parse(raw);
  } catch {
    return {
      role: "customer",
      name: "Alex Morgan",
      email: "alex.customer@email.com",
      isGuest: false,
    };
  }
}

export function logoutCustomer() {
  try {
    localStorage.removeItem(CUSTOMER_SESSION_KEY);
  } catch {}
}
