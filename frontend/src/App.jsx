import { useEffect, useState } from "react";
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

function getRouteFromHash() {
  const hash = window.location.hash;
  if (hash === "#/queue" || hash === "#/staff") {
    return "staff";
  }
  return "customer";
}

export default function App() {
  const [route, setRoute] = useState(getRouteFromHash);
  const [staffSession, setStaffSession] = useState(() => getStaffSession());
  const [customerSession, setCustomerSession] = useState(() => getCustomerSession());
  const [showCustomerAuth, setShowCustomerAuth] = useState(false);

  // Sync route on hash change and enforce security route guard
  useEffect(() => {
    function handleHashChange() {
      const newRoute = getRouteFromHash();
      setRoute(newRoute);
      if (newRoute === "staff") {
        // Verify current staff session validity
        const validSession = getStaffSession();
        setStaffSession(validSession);
      } else {
        // Verify current customer session validity
        const validCust = getCustomerSession();
        setCustomerSession(validCust);
      }
    }
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // Staff handlers
  function handleStaffLoginSuccess(newSession) {
    setStaffSession(newSession);
    window.location.hash = "#/queue";
  }

  function handleStaffLogout() {
    logoutStaff();
    setStaffSession(null);
  }

  function handleStaffCancel() {
    window.location.hash = "#/";
  }

  // Customer handlers
  function handleCustomerLoginSuccess(newSession) {
    setCustomerSession(newSession);
    setShowCustomerAuth(false);
  }

  function handleCustomerLogout() {
    logoutCustomer();
    setCustomerSession(null);
  }

  function handleGoToStaff() {
    window.location.hash = "#/queue";
  }

  return (
    <div className={`app-root ${route === "staff" ? "theme--staff" : "theme--customer"}`}>
      {/* Dynamic Header tailored to the active portal */}
      {route === "staff" ? (
        <header className="site-head site-head--staff">
          <div className="site-head-in">
            <div className="brand-group">
              <a className="brand" href="#/queue">
                <span className="mark mark--staff" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <span className="brand-title">Smart Triage</span>
                <span className="brand-badge brand-badge--staff">Staff Ops</span>
              </a>
              <span className="security-status-badge">
                <span className="dot dot--pulse" />
                {staffSession ? "SECURE SESSION" : "AUTHENTICATION GATE"}
              </span>
            </div>

            <div className="header-actions">
              {staffSession ? (
                <>
                  <div className="role-indicator role-indicator--staff">
                    <span className="role-avatar">🛡️</span>
                    <div className="role-texts">
                      <span className="role-name">{staffSession.name}</span>
                      <span className="role-title">{staffSession.dept}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn--header-logout"
                    onClick={handleStaffLogout}
                    title="Lock terminal and end staff session"
                  >
                    🔒 Lock & Sign Out
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn btn--header-exit"
                  onClick={handleStaffCancel}
                >
                  ← Customer Service Desk
                </button>
              )}
            </div>
          </div>
        </header>
      ) : (
        <header className="site-head site-head--customer">
          <div className="site-head-in">
            <div className="brand-group">
              <a className="brand" href="#/">
                <span className="mark" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <span className="brand-title">Smart Triage</span>
                <span className="brand-badge">AWS AI</span>
              </a>
              <span className="portal-subheading">Customer Service Desk</span>
            </div>

            <div className="header-actions">
              {customerSession ? (
                <>
                  {/* Customer Account Identity */}
                  <div
                    className="role-indicator role-indicator--customer"
                    title={`Signed in as ${customerSession.name}`}
                  >
                    <span className="role-avatar">👤</span>
                    <div className="role-texts">
                      <span className="role-name">{customerSession.name}</span>
                      <span className="role-title">{customerSession.email}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn--header-logout"
                    onClick={handleCustomerLogout}
                    title="Sign out of customer account"
                  >
                    🚪 Sign Out
                  </button>
                </>
              ) : (
                <div className="security-status-badge">
                  <span className="dot dot--pulse" />
                  AUTHENTICATION REQUIRED
                </div>
              )}

              <button
                type="button"
                className="btn btn--staff-gateway"
                onClick={handleGoToStaff}
                title="Restricted Staff Portal Access"
              >
                🔒 Staff Access
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Main View Portals */}
      {route === "staff" ? (
        staffSession ? (
          <StaffPortal user={staffSession} onLogout={handleStaffLogout} />
        ) : (
          <StaffLogin
            onLoginSuccess={handleStaffLoginSuccess}
            onCancel={handleStaffCancel}
          />
        )
      ) : (
        customerSession ? (
          <CustomerPortal
            user={customerSession}
            onOpenAuth={() => setShowCustomerAuth(true)}
            onLogout={handleCustomerLogout}
          />
        ) : (
          <CustomerLogin
            onLoginSuccess={handleCustomerLoginSuccess}
            onGoToStaff={handleGoToStaff}
          />
        )
      )}

      {/* Footer */}
      <footer className="site-footer">
        <div className="footer-content">
          <span>🚀 Serverless Architecture • AWS API Gateway + Lambda + DynamoDB + Groq AI</span>
          <span className="footer-links">
            {route === "staff" ? (
              <a href="#/">← Customer Service Desk</a>
            ) : (
              <a href="#/queue">Staff Command Center (Restricted) 🔒</a>
            )}
            <span className="sep">•</span>
            <a href="https://github.com/snehanair-486/ticket-triage-system" target="_blank" rel="noreferrer">
              GitHub Repository
            </a>
          </span>
        </div>
      </footer>

      {/* Customer Authentication Modal (if invoked while in customer portal) */}
      {showCustomerAuth && (
        <CustomerAuthModal
          currentCustomer={customerSession}
          onLoginSuccess={handleCustomerLoginSuccess}
          onClose={() => setShowCustomerAuth(false)}
          onGoToStaff={handleGoToStaff}
        />
      )}
    </div>
  );
}
