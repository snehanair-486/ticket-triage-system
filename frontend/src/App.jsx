import React, { useEffect, useState } from "react";
import PortalSelect from "./PortalSelect.jsx";
import CustomerPortal from "./CustomerPortal.jsx";
import CustomerLogin from "./CustomerLogin.jsx";
import StaffPortal from "./StaffPortal.jsx";
import StaffLogin from "./StaffLogin.jsx";
import CustomerAuthModal from "./CustomerAuthModal.jsx";
import {
  getStaffSession,
  getCustomerSession,
  logoutStaff,
  logoutCustomer,
} from "./auth.js";
import {
  IconShield,
  IconUser,
  IconLock,
  IconLogOut,
  IconSparkles,
} from "./Icons.jsx";

function getRouteFromHash() {
  const hash = window.location.hash;
  if (hash === "#/queue" || hash === "#/staff") {
    return "staff";
  }
  if (hash === "#/customer" || hash === "#/customer/login" || hash === "#/customer/register") {
    return "customer";
  }
  // Default on load: side-by-side portal chooser
  return "select";
}

export default function App() {
  const [route, setRoute] = useState(getRouteFromHash);
  const [customerInitialMode, setCustomerInitialMode] = useState("login");
  const [staffSession, setStaffSession] = useState(() => getStaffSession());
  const [customerSession, setCustomerSession] = useState(() => getCustomerSession());
  const [showCustomerAuth, setShowCustomerAuth] = useState(false);

  // Sync route on hash change and enforce security route guard
  useEffect(() => {
    function handleHashChange() {
      const newRoute = getRouteFromHash();
      setRoute(newRoute);
      if (window.location.hash === "#/customer/register") {
        setCustomerInitialMode("register");
      } else {
        setCustomerInitialMode("login");
      }

      if (newRoute === "staff") {
        setStaffSession(getStaffSession());
      } else if (newRoute === "customer") {
        setCustomerSession(getCustomerSession());
      }
    }
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // Navigation helpers
  function navigateTo(hash) {
    window.location.hash = hash;
  }

  function handleSelectCustomer() {
    setCustomerInitialMode("login");
    navigateTo("#/customer");
  }

  function handleSelectCustomerRegister() {
    setCustomerInitialMode("register");
    navigateTo("#/customer/register");
  }

  function handleSelectStaff() {
    navigateTo("#/staff");
  }

  function handleBackToSelect() {
    navigateTo("#/");
  }

  // Staff auth handlers
  function handleStaffLoginSuccess(newSession) {
    setStaffSession(newSession);
    navigateTo("#/staff");
  }

  function handleStaffLogout() {
    logoutStaff();
    setStaffSession(null);
  }

  // Customer auth handlers
  function handleCustomerLoginSuccess(newSession) {
    setCustomerSession(newSession);
    setShowCustomerAuth(false);
    navigateTo("#/customer");
  }

  function handleCustomerLogout() {
    logoutCustomer();
    setCustomerSession(null);
  }

  return (
    <div className="app-root theme--dark">
      {/* Universal Standard Dark Header */}
      <header className="site-head">
        <div className="site-head-in">
          <div className="brand-group">
            <a className="brand" href="#/" onClick={(e) => { e.preventDefault(); handleBackToSelect(); }}>
              <span className="mark" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span className="brand-title">Smart Triage</span>
              <span className="brand-badge">AWS AI</span>
            </a>

            <nav className="header-nav-links" aria-label="Portal Navigation">
              <button
                type="button"
                className={`nav-pill ${route === "select" ? "nav-pill--active" : ""}`}
                onClick={handleBackToSelect}
              >
                Portals
              </button>
              <button
                type="button"
                className={`nav-pill ${route === "customer" ? "nav-pill--active" : ""}`}
                onClick={handleSelectCustomer}
              >
                Customer Desk
              </button>
              <button
                type="button"
                className={`nav-pill ${route === "staff" ? "nav-pill--active" : ""}`}
                onClick={handleSelectStaff}
              >
                Staff Portal
              </button>
            </nav>
          </div>

          <div className="header-actions">
            {/* Show logged in staff info if in staff route or signed in */}
            {route === "staff" && staffSession && (
              <div className="role-indicator role-indicator--staff">
                <IconShield size={16} className="role-avatar" />
                <div className="role-texts">
                  <span className="role-name">{staffSession.name}</span>
                  <span className="role-title">{staffSession.dept}</span>
                </div>
                <button
                  type="button"
                  className="btn btn--header-logout"
                  onClick={handleStaffLogout}
                  title="Lock terminal and end staff session"
                >
                  <IconLock size={14} />
                  <span>Lock Terminal</span>
                </button>
              </div>
            )}

            {/* Show logged in customer info if in customer route or signed in */}
            {route === "customer" && customerSession && (
              <div className="role-indicator role-indicator--customer">
                <IconUser size={16} className="role-avatar" />
                <div className="role-texts">
                  <span className="role-name">{customerSession.name}</span>
                  <span className="role-title">{customerSession.email}</span>
                </div>
                <button
                  type="button"
                  className="btn btn--header-logout"
                  onClick={handleCustomerLogout}
                  title="Sign out of customer account"
                >
                  <IconLogOut size={14} />
                  <span>Sign Out</span>
                </button>
              </div>
            )}

            {/* If on portal selection screen, show quick status badges */}
            {route === "select" && (
              <div className="header-portal-status">
                {customerSession && (
                  <span className="active-session-chip" onClick={handleSelectCustomer}>
                    <IconUser size={12} />
                    <span>Customer: {customerSession.name.split(" ")[0]}</span>
                  </span>
                )}
                {staffSession && (
                  <span className="active-session-chip active-session-chip--staff" onClick={handleSelectStaff}>
                    <IconShield size={12} />
                    <span>Staff: {staffSession.name.split(" ")[0]}</span>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Portals View */}
      <div className="main-content-wrapper">
        {route === "select" ? (
          <PortalSelect
            customerSession={customerSession}
            staffSession={staffSession}
            onSelectCustomer={handleSelectCustomer}
            onSelectStaff={handleSelectStaff}
            onSelectCustomerRegister={handleSelectCustomerRegister}
            onLogoutCustomer={handleCustomerLogout}
            onLogoutStaff={handleStaffLogout}
          />
        ) : route === "staff" ? (
          staffSession ? (
            <StaffPortal
              user={staffSession}
              onLogout={handleStaffLogout}
              onBackToSelect={handleBackToSelect}
            />
          ) : (
            <StaffLogin
              onLoginSuccess={handleStaffLoginSuccess}
              onCancel={handleSelectCustomer}
              onBackToSelect={handleBackToSelect}
            />
          )
        ) : (
          customerSession ? (
            <CustomerPortal
              user={customerSession}
              onOpenAuth={() => setShowCustomerAuth(true)}
              onLogout={handleCustomerLogout}
              onBackToSelect={handleBackToSelect}
            />
          ) : (
            <CustomerLogin
              onLoginSuccess={handleCustomerLoginSuccess}
              onGoToStaff={handleSelectStaff}
              onBackToSelect={handleBackToSelect}
              initialMode={customerInitialMode}
            />
          )
        )}
      </div>

      {/* Standard Footer */}
      <footer className="site-footer">
        <div className="footer-content">
          <div className="footer-tech">
            <IconSparkles size={14} />
            <span>Serverless Architecture • AWS API Gateway + Lambda + DynamoDB + Groq AI</span>
          </div>
          <div className="footer-links">
            <a href="#/" onClick={(e) => { e.preventDefault(); handleBackToSelect(); }}>
              Portal Selection
            </a>
            <span className="sep">•</span>
            <a href="#/customer" onClick={(e) => { e.preventDefault(); handleSelectCustomer(); }}>
              Customer Desk
            </a>
            <span className="sep">•</span>
            <a href="#/staff" onClick={(e) => { e.preventDefault(); handleSelectStaff(); }}>
              Staff Command Center
            </a>
            <span className="sep">•</span>
            <a
              href="https://github.com/snehanair-486/ticket-triage-system"
              target="_blank"
              rel="noreferrer"
            >
              GitHub Repository
            </a>
          </div>
        </div>
      </footer>

      {/* Customer Authentication Modal (if invoked inside portal) */}
      {showCustomerAuth && (
        <CustomerAuthModal
          currentCustomer={customerSession}
          onLoginSuccess={handleCustomerLoginSuccess}
          onClose={() => setShowCustomerAuth(false)}
          onGoToStaff={handleSelectStaff}
        />
      )}
    </div>
  );
}
