import { useEffect, useState } from "react";
import ReportPage from "./ReportPage.jsx";
import Dashboard from "./Dashboard.jsx";

// Hash-based tabs (#/ and #/queue) so it works on S3/CloudFront with no server rewrites.
const getRoute = () => (window.location.hash === "#/queue" ? "queue" : "report");

export default function App() {
  const [route, setRoute] = useState(getRoute());
  useEffect(() => {
    const onHash = () => setRoute(getRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return (
    <>
      <header className="site-head">
        <div className="site-head-in">
          <a className="brand" href="#/">
            <span className="mark" aria-hidden="true"><i /><i /><i /></span>
            Ticket Triage
          </a>
          <nav>
            <a href="#/" aria-current={route === "report" ? "page" : undefined}>Report a problem</a>
            <a href="#/queue" aria-current={route === "queue" ? "page" : undefined}>Staff queue</a>
          </nav>
        </div>
      </header>
      {route === "queue" ? <Dashboard /> : <ReportPage />}
    </>
  );
}
