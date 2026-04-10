// src/App.jsx
import { useState } from "react";
import RealtyChatbot from "./RealtyChatbot";
import RealtyDashboard from "./RealtyDashboard";

const NAV_H = 56;

const TABS = [
  { id: "chatbot",   label: "Property Advisor", icon: "🏠" },
  { id: "dashboard", label: "Viewings Dashboard", icon: "📋" },
];

export default function App() {
  const [page, setPage] = useState("chatbot");

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');

        /* ── Nav ── */
        .app-nav {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 1000;
          height: ${NAV_H}px;
          background: rgba(255,255,255,0.95);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-bottom: 1px solid #bfdbfe;
          display: flex;
          align-items: center;
          padding: 0 20px;
          gap: 8px;
          box-shadow: 0 2px 16px rgba(29,78,216,.07);
        }

        .app-nav-logo {
          display: flex;
          align-items: center;
          gap: 8px;
          text-decoration: none;
          flex-shrink: 0;
          margin-right: 4px;
        }
        .app-nav-logo-icon {
          width: 32px;
          height: 32px;
          background: linear-gradient(135deg, #1d4ed8, #2563eb);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          flex-shrink: 0;
        }
        .app-nav-logo-text {
          font-family: 'DM Serif Display', serif;
          color: #1d4ed8;
          font-size: 17px;
          line-height: 1;
        }
        @media (max-width: 360px) {
          .app-nav-logo-text { display: none; }
        }

        .nav-tabs {
          display: flex;
          align-items: center;
          gap: 4px;
          flex: 1;
        }

        .nav-tab {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          border-radius: 10px;
          border: none;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all .2s ease;
          white-space: nowrap;
          background: transparent;
          color: #3b82f6;
          position: relative;
        }
        .nav-tab.active {
          background: #eff6ff;
          color: #1d4ed8;
          font-weight: 600;
        }
        .nav-tab:not(.active):hover {
          background: #f8faff;
          color: #1d4ed8;
        }
        .nav-tab-label { display: inline; }
        @media (max-width: 420px) {
          .nav-tab { padding: 7px 10px; }
          .nav-tab-label { display: none; }
          .nav-tab { font-size: 18px; }
        }

        /* ── Page content ── */
        .app-page {
          flex: 1;
          padding-top: ${NAV_H}px;
          display: flex;
          flex-direction: column;
          min-height: 100dvh;
        }
      `}</style>

      <nav className="app-nav">
        <a href="/" className="app-nav-logo" onClick={(e) => e.preventDefault()}>
          <div className="app-nav-logo-icon">🏠</div>
          <span className="app-nav-logo-text">PropNest Realty</span>
        </a>

        <div className="nav-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`nav-tab${page === tab.id ? " active" : ""}`}
              onClick={() => setPage(tab.id)}
            >
              <span>{tab.icon}</span>
              <span className="nav-tab-label">{tab.label}</span>
            </button>
          ))}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: "#22c55e",
            boxShadow: "0 0 6px #22c55e88",
            animation: "navPulse 2s infinite",
          }} />
          <style>{`@keyframes navPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.6;transform:scale(.8)}}`}</style>
          <span style={{ fontSize: 11.5, color: "#3b82f6", fontWeight: 500 }}>Live</span>
        </div>
      </nav>

      <div className="app-page">
        {page === "chatbot"   && <RealtyChatbot />}
        {page === "dashboard" && <RealtyDashboard />}
      </div>
    </>
  );
}
