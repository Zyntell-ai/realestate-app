// src/RealtyDashboard.jsx
// ─── Full real estate dashboard: stats, viewings, agent view, calendar ────────
import { useState, useEffect, useCallback } from "react";
import {
  supabase,
  AGENTS,
  PROPERTY_TYPES,
  getViewings,
  getDashboardStats,
  getFullDaysForMonth,
  updateViewingStatus,
  cancelViewing,
} from "./lib/realty";

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  primary: "#1d4ed8",
  primary2: "#2563eb",
  sky:     "#eff6ff",
  navy:    "#0f172a",
  sub:     "#3b82f6",
  border:  "#bfdbfe",
  bg:      "#f8faff",
  card:    "#ffffff",
  red:     "#dc2626",
  green:   "#22c55e",
  amber:   "#f59e0b",
  purple:  "#7c3aed",
};

const STATUS_COLOR = {
  scheduled: { bg: "#dbeafe", text: "#1d4ed8", dot: "#2563eb" },
  confirmed: { bg: "#dcfce7", text: "#16a34a", dot: "#22c55e" },
  completed: { bg: "#e0e7ff", text: "#4338ca", dot: "#6366f1" },
  cancelled: { bg: "#fee2e2", text: "#dc2626", dot: "#ef4444" },
  no_show:   { bg: "#fef9c3", text: "#a16207", dot: "#ca8a04" },
};

const PROP_EMOJI = {
  "Apartment / Flat":   "🏢",
  "Villa / Bungalow":   "🏡",
  "Plot / Land":        "🌿",
  "Commercial / Office":"🏬",
  "Studio / 1BHK":      "🛏️",
};

// ─── Tiny reusable components ─────────────────────────────────────────────────
const Badge = ({ status }) => {
  const s = STATUS_COLOR[status] || STATUS_COLOR.scheduled;
  return (
    <span style={{
      background: s.bg, color: s.text,
      fontSize: 11, fontWeight: 600,
      padding: "3px 10px", borderRadius: 20,
      display: "inline-flex", alignItems: "center", gap: 5,
      whiteSpace: "nowrap",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, display: "inline-block" }} />
      {status.charAt(0).toUpperCase() + status.slice(1).replace("_", " ")}
    </span>
  );
};

const StatCard = ({ icon, label, value, sub, color, delay }) => (
  <div style={{
    background: C.card, borderRadius: 20,
    padding: "20px 22px",
    boxShadow: "0 2px 20px rgba(29,78,216,.07)",
    border: `1px solid ${C.border}`,
    animation: `dashSlideUp .5s ${delay}s cubic-bezier(.22,1,.36,1) both`,
    display: "flex", flexDirection: "column", gap: 3,
  }}>
    <div style={{ fontSize: 26 }}>{icon}</div>
    <div style={{
      fontSize: 32, fontWeight: 700,
      color: color || C.primary,
      fontFamily: "'DM Serif Display',serif",
      marginTop: 6, lineHeight: 1,
    }}>
      {value}
    </div>
    <div style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>{label}</div>
    {sub && <div style={{ fontSize: 11.5, color: "#64748b" }}>{sub}</div>}
  </div>
);

// ─── Mini calendar ────────────────────────────────────────────────────────────
function MiniCalendar({ year, month, fullDays, selectedDate, onSelect }) {
  const firstDay    = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const today       = new Date().toISOString().split("T")[0];
  const cells       = [];

  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const pad = (n) => String(n).padStart(2, "0");

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, marginBottom: 6 }}>
        {["S","M","T","W","T","F","S"].map((d, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: "#64748b", padding: "4px 0" }}>{d}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 }}>
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const dateStr = `${year}-${pad(month)}-${pad(d)}`;
          const isFull  = fullDays.has(dateStr);
          const isToday = dateStr === today;
          const isSel   = dateStr === selectedDate;
          return (
            <button key={i} onClick={() => onSelect(isSel ? null : dateStr)}
              style={{
                aspectRatio: "1", borderRadius: 8, fontSize: 12,
                fontWeight: isToday ? 700 : 500,
                border: isSel ? `2px solid ${C.primary}` : "2px solid transparent",
                background: isFull ? "#fee2e2" : isSel ? C.sky : isToday ? C.sky : "transparent",
                color:      isFull ? C.red   : isSel ? C.primary : isToday ? C.primary : C.navy,
                cursor: "pointer", transition: "all .15s", position: "relative",
              }}
            >
              {d}
              {isFull && (
                <span style={{ position:"absolute", top:1, right:2, fontSize:8, color:C.red, fontWeight:700 }}>●</span>
              )}
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 10, fontSize: 11, color: "#64748b" }}>
        <span><span style={{ color: C.red }}>●</span> Fully Booked</span>
        <span><span style={{ color: C.primary }}>●</span> Today / Selected</span>
      </div>
    </div>
  );
}

// ─── Viewing row (desktop table) ──────────────────────────────────────────────
function ViewingRow({ viewing, onStatusChange, onCancel }) {
  const [open, setOpen] = useState(false);
  const agent = AGENTS.find((a) => a.name === viewing.agent);
  const propEmoji = PROP_EMOJI[viewing.property_type] || "🏠";

  return (
    <>
      <tr
        onClick={() => setOpen(!open)}
        style={{ cursor: "pointer", transition: "background .15s" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f6ff")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <td style={tdStyle}>
          <div style={{ fontWeight: 600, color: C.navy, fontSize: 13.5 }}>{viewing.client_name}</div>
          <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 1 }}>{viewing.phone}</div>
        </td>
        <td style={tdStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>{propEmoji}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>{viewing.property_type}</div>
              {viewing.area && <div style={{ fontSize: 11, color: "#64748b" }}>📍 {viewing.area}</div>}
            </div>
          </div>
        </td>
        <td style={tdStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: agent?.color || C.primary, display: "inline-block", flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>{viewing.agent}</div>
              <div style={{ fontSize: 11, color: "#64748b" }}>{agent?.specialty}</div>
            </div>
          </div>
        </td>
        <td style={tdStyle}>
          <div style={{ fontSize: 13, color: C.navy }}>
            {new Date(viewing.date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </div>
          <div style={{ fontSize: 12, color: "#64748b" }}>{viewing.time_slot}</div>
        </td>
        <td style={tdStyle}><Badge status={viewing.status} /></td>
        <td style={tdStyle}>
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            {viewing.whatsapp_sent  && <span title="WhatsApp sent"   style={{ fontSize: 15 }}>📲</span>}
            {viewing.gcal_event_id  && <span title="Calendar synced" style={{ fontSize: 15 }}>📅</span>}
          </div>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={6} style={{ padding: "0 16px 14px", background: "#f0f6ff" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingTop: 10 }}>
              {viewing.status !== "confirmed" && viewing.status !== "cancelled" && (
                <ActionBtn label="✅ Confirm"         color={C.green}   onClick={() => onStatusChange(viewing.id, "confirmed")} />
              )}
              {viewing.status !== "completed" && viewing.status !== "cancelled" && (
                <ActionBtn label="🏆 Mark Completed"  color={C.purple}  onClick={() => onStatusChange(viewing.id, "completed")} />
              )}
              {viewing.status !== "no_show" && viewing.status !== "cancelled" && (
                <ActionBtn label="🚫 No Show"         color={C.amber}   onClick={() => onStatusChange(viewing.id, "no_show")} />
              )}
              {viewing.status !== "cancelled" && (
                <ActionBtn label="❌ Cancel"          color={C.red}     onClick={() => onCancel(viewing.id)} />
              )}
              {viewing.budget && (
                <div style={{ fontSize: 12.5, color: "#64748b", padding: "6px 12px", background: "#fff", borderRadius: 8, border: `1px solid ${C.border}` }}>
                  💰 Budget: {viewing.budget}
                </div>
              )}
              {viewing.notes && (
                <div style={{ fontSize: 12.5, color: "#64748b", padding: "6px 12px", background: "#fff", borderRadius: 8, border: `1px solid ${C.border}` }}>
                  📝 {viewing.notes}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function ActionBtn({ label, color, onClick }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{
        background: color + "1a", color, border: `1px solid ${color}44`,
        borderRadius: 8, padding: "6px 14px",
        fontSize: 12.5, fontWeight: 600, cursor: "pointer", transition: "all .15s",
        fontFamily: "'DM Sans',sans-serif",
      }}
    >
      {label}
    </button>
  );
}

const tdStyle = { padding: "13px 16px", verticalAlign: "middle", borderBottom: `1px solid ${C.border}` };

// ─── Mobile Viewing Card ──────────────────────────────────────────────────────
function ViewingCard({ viewing, onStatusChange, onCancel }) {
  const [open, setOpen] = useState(false);
  const agent     = AGENTS.find((a) => a.name === viewing.agent);
  const propEmoji = PROP_EMOJI[viewing.property_type] || "🏠";

  return (
    <div style={{
      background: C.card, borderRadius: 14,
      border: `1px solid ${C.border}`,
      overflow: "hidden", marginBottom: 10,
      boxShadow: "0 1px 8px rgba(29,78,216,.05)",
    }}>
      <div onClick={() => setOpen(!open)}
        style={{ padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 12 }}
      >
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: (agent?.color || C.primary) + "20",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, flexShrink: 0,
        }}>{propEmoji}</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: C.navy }}>{viewing.client_name}</div>
            <Badge status={viewing.status} />
          </div>
          <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 3 }}>
            {viewing.property_type} {viewing.area ? `· ${viewing.area}` : ""}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 12 }}>
            <span style={{ color: C.navy }}>
              📅 {new Date(viewing.date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            </span>
            <span style={{ color: C.navy }}>🕐 {viewing.time_slot}</span>
            {viewing.whatsapp_sent && <span>📲</span>}
          </div>
        </div>

        <div style={{ fontSize: 14, color: "#64748b", flexShrink: 0, paddingTop: 2 }}>
          {open ? "▲" : "▼"}
        </div>
      </div>

      {open && (
        <div style={{ padding: "0 16px 14px", borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
          <div style={{ fontSize: 12.5, color: "#64748b", marginBottom: 8 }}>
            👨‍💼 {viewing.agent} {agent?.specialty ? `(${agent.specialty})` : ""}
          </div>
          {viewing.budget && <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>💰 {viewing.budget}</div>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {viewing.status !== "confirmed" && viewing.status !== "cancelled" && (
              <ActionBtn label="✅ Confirm"    color={C.green}  onClick={() => onStatusChange(viewing.id, "confirmed")} />
            )}
            {viewing.status !== "completed" && viewing.status !== "cancelled" && (
              <ActionBtn label="🏆 Completed"  color={C.purple} onClick={() => onStatusChange(viewing.id, "completed")} />
            )}
            {viewing.status !== "no_show" && viewing.status !== "cancelled" && (
              <ActionBtn label="🚫 No Show"    color={C.amber}  onClick={() => onStatusChange(viewing.id, "no_show")} />
            )}
            {viewing.status !== "cancelled" && (
              <ActionBtn label="❌ Cancel"     color={C.red}    onClick={() => onCancel(viewing.id)} />
            )}
          </div>
          {viewing.phone && <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>📱 {viewing.phone}</div>}
        </div>
      )}
    </div>
  );
}

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────
export default function RealtyDashboard() {
  const now = new Date();
  const [stats,       setStats]      = useState({ total: 0, today: 0, thisMonth: 0, topType: "—" });
  const [viewings,    setViewings]   = useState([]);
  const [fullDays,    setFullDays]   = useState(new Set());
  const [loading,     setLoading]    = useState(true);
  const [calYear,     setCalYear]    = useState(now.getFullYear());
  const [calMonth,    setCalMonth]   = useState(now.getMonth() + 1);
  const [filterAgent, setFilterAgt]  = useState("");
  const [filterDate,  setFilterDate] = useState("");
  const [filterStatus,setFilterSt]   = useState("");
  const [filterType,  setFilterType] = useState("");
  const [activeTab,   setActiveTab]  = useState("all");
  const [sidebarOpen, setSidebar]    = useState(true);

  // ── Data fetching ──────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const currentDate = new Date();
      const [s, vs, fd] = await Promise.all([
        getDashboardStats(),
        getViewings({
          agent:         filterAgent  || undefined,
          date:          (activeTab === "today" ? currentDate.toISOString().split("T")[0] : filterDate) || undefined,
          status:        filterStatus || undefined,
          property_type: filterType   || undefined,
        }),
        getFullDaysForMonth(calYear, calMonth),
      ]);
      setStats(s);
      setViewings(vs);
      setFullDays(fd);
    } finally {
      setLoading(false);
    }
  }, [filterAgent, filterDate, filterStatus, filterType, activeTab, calYear, calMonth]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    const channel = supabase
      .channel("viewings-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "viewings" }, fetchAll)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [fetchAll]);

  const handleStatusChange = async (id, status) => {
    await updateViewingStatus(id, status);
    fetchAll();
  };
  const handleCancel = async (id) => {
    if (window.confirm("Cancel this viewing?")) {
      await cancelViewing(id);
      fetchAll();
    }
  };

  const calPrev = () => {
    if (calMonth === 1) { setCalYear(y => y - 1); setCalMonth(12); }
    else setCalMonth(m => m - 1);
  };
  const calNext = () => {
    if (calMonth === 12) { setCalYear(y => y + 1); setCalMonth(1); }
    else setCalMonth(m => m + 1);
  };

  const monthName = new Date(calYear, calMonth - 1).toLocaleString("en-IN", { month: "long", year: "numeric" });

  const agentStats = AGENTS.map((a) => {
    const all      = viewings.filter((v) => v.agent === a.name);
    const todayVws = all.filter((v) => v.date === now.toISOString().split("T")[0]);
    return { ...a, total: all.length, today: todayVws.length };
  });

  const navTabClick = (id) => {
    setActiveTab(id);
    if (window.innerWidth < 768) setSidebar(false);
  };

  const filterAgtClick = (name) => {
    setFilterAgt(filterAgent === name ? "" : name);
    setActiveTab("all");
    if (window.innerWidth < 768) setSidebar(false);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        body { font-family:'DM Sans',sans-serif; }
        @keyframes dashSlideUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes dashFadeIn  { from{opacity:0} to{opacity:1} }
        select { font-family:'DM Sans',sans-serif; }
        table  { border-collapse:collapse; width:100%; }
        th     { text-align:left; font-size:11px; font-weight:700; color:#64748b; letter-spacing:.8px; text-transform:uppercase; padding:10px 16px; background:#f8faff; border-bottom:2px solid ${C.border}; white-space:nowrap; }
        tr:last-child td { border-bottom:none !important; }

        .dash-layout { display:flex; min-height:calc(100dvh - 56px); background:${C.bg}; }

        .dash-sidebar {
          width: 260px; flex-shrink: 0;
          background: #fff; border-right: 1px solid ${C.border};
          display: flex; flex-direction: column;
          transition: transform .3s cubic-bezier(.22,1,.36,1), width .3s cubic-bezier(.22,1,.36,1);
          overflow: hidden;
        }
        .dash-sidebar.closed { width: 0; }
        @media (max-width: 768px) {
          .dash-sidebar {
            position: fixed; top: 56px; left: 0; bottom: 0;
            z-index: 400; width: 270px !important;
            transform: translateX(0); box-shadow: 4px 0 32px rgba(0,0,0,.14);
          }
          .dash-sidebar.closed { transform: translateX(-100%); width: 270px !important; }
        }

        .dash-backdrop { display: none; }
        @media (max-width: 768px) {
          .dash-backdrop {
            display: block; position: fixed; inset: 56px 0 0 0;
            z-index: 300; background: rgba(15,23,42,.4);
            backdrop-filter: blur(2px); animation: dashFadeIn .2s ease;
          }
        }

        .dash-main { flex: 1; overflow-y: auto; padding: 24px 28px; min-width: 0; }
        @media (max-width: 640px) { .dash-main { padding: 16px 14px; } }

        .stats-grid {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 14px; margin-bottom: 24px;
        }
        @media (max-width: 480px) { .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; } }

        .filter-bar {
          background: ${C.card}; border-radius: 14px; padding: 12px 16px;
          margin-bottom: 18px; border: 1px solid ${C.border};
          display: flex; gap: 10px; flex-wrap: wrap; align-items: center;
        }
        .filter-select {
          border: 1px solid ${C.border}; border-radius: 8px; padding: 7px 12px;
          font-size: 13px; color: ${C.navy}; background: ${C.bg};
          outline: none; cursor: pointer; font-family:'DM Sans',sans-serif;
        }
        .filter-select:focus { border-color: ${C.primary}; }

        .table-wrap {
          background: ${C.card}; border-radius: 18px;
          overflow: hidden; border: 1px solid ${C.border};
          box-shadow: 0 2px 20px rgba(29,78,216,.06);
        }
        .table-scroll { overflow-x: auto; }

        .view-table-view { display: block; }
        .view-cards-view { display: none; }
        @media (max-width: 640px) {
          .view-table-view { display: none; }
          .view-cards-view { display: block; padding: 12px; }
        }

        .agent-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(185px, 1fr));
          gap: 14px; margin-bottom: 24px;
        }
        @media (max-width: 480px) { .agent-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; } }

        .dash-topbar { display: flex; align-items: center; gap: 14px; margin-bottom: 22px; flex-wrap: wrap; }

        .sidebar-toggle {
          border: 1px solid ${C.border}; background: ${C.card}; border-radius: 10px;
          width: 38px; height: 38px; display: flex; align-items: center; justify-content: center;
          cursor: pointer; font-size: 17px; transition: all .15s; flex-shrink: 0;
        }
        .sidebar-toggle:hover { background: ${C.sky}; border-color: ${C.primary}; }

        .refresh-btn {
          background: ${C.primary}; color: #fff; border: none; border-radius: 10px;
          padding: 8px 16px; cursor: pointer; font-family:'DM Sans',sans-serif;
          font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px;
          transition: all .18s; flex-shrink: 0; margin-left: auto;
        }
        .refresh-btn:hover { background: #2563eb; transform: translateY(-1px); }

        .sidebar-nav-item {
          width: 100%; text-align: left; padding: 10px 14px; border-radius: 12px;
          border: none; cursor: pointer; display: flex; align-items: center; gap: 10px;
          font-family:'DM Sans',sans-serif; font-size: 14px; margin-bottom: 3px; transition: all .15s;
        }
        .sidebar-agt-item {
          width: 100%; text-align: left; padding: 8px 14px; border-radius: 10px;
          border: none; cursor: pointer; display: flex; align-items: center; gap: 8px;
          font-family:'DM Sans',sans-serif; font-size: 13px; margin-bottom: 2px; transition: all .15s;
        }
      `}</style>

      <div className="dash-layout">

        {sidebarOpen && <div className="dash-backdrop" onClick={() => setSidebar(false)} />}

        {/* ── SIDEBAR ── */}
        <aside className={`dash-sidebar${sidebarOpen ? "" : " closed"}`}>
          <div style={{ padding: "24px 22px 18px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
            <div style={{ fontFamily: "'DM Serif Display',serif", fontSize: 21, color: C.primary }}>PropNest</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Realty Management</div>
          </div>

          <nav style={{ padding: "14px 10px", flex: 1, overflowY: "auto" }}>
            {[
              { id: "all",    icon: "📋", label: "All Viewings" },
              { id: "today",  icon: "📅", label: "Today's Viewings" },
              { id: "agents", icon: "👨‍💼", label: "By Agent" },
            ].map((tab) => (
              <button key={tab.id} className="sidebar-nav-item"
                onClick={() => navTabClick(tab.id)}
                style={{
                  background: activeTab === tab.id ? C.sky : "transparent",
                  color:      activeTab === tab.id ? C.primary : C.navy,
                  fontWeight: activeTab === tab.id ? 600 : 400,
                }}
              >
                <span style={{ fontSize: 16 }}>{tab.icon}</span>
                {tab.label}
              </button>
            ))}

            <div style={{ height: 1, background: C.border, margin: "12px 4px" }} />
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: .8, padding: "0 6px 8px", textTransform: "uppercase" }}>
              Agents
            </div>
            {AGENTS.map((agent) => (
              <button key={agent.name} className="sidebar-agt-item"
                onClick={() => filterAgtClick(agent.name)}
                style={{
                  background: filterAgent === agent.name ? agent.color + "1a" : "transparent",
                  color:      filterAgent === agent.name ? agent.color : "#64748b",
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: agent.color, display: "inline-block", flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 600, color: filterAgent === agent.name ? agent.color : C.navy, fontSize: 12.5 }}>
                    {agent.name}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>{agent.specialty}</div>
                </div>
              </button>
            ))}
          </nav>

          {/* Mini Calendar */}
          <div style={{ padding: "14px 18px 20px", borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <button onClick={calPrev} style={{ border: "none", background: "none", cursor: "pointer", color: "#64748b", fontSize: 18, padding: "2px 6px", borderRadius: 6 }}>‹</button>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>{monthName}</div>
              <button onClick={calNext} style={{ border: "none", background: "none", cursor: "pointer", color: "#64748b", fontSize: 18, padding: "2px 6px", borderRadius: 6 }}>›</button>
            </div>
            <MiniCalendar
              year={calYear} month={calMonth}
              fullDays={fullDays} selectedDate={filterDate}
              onSelect={(d) => { setFilterDate(d || ""); setActiveTab("all"); }}
            />
          </div>
        </aside>

        {/* ── MAIN ── */}
        <main className="dash-main">

          <div className="dash-topbar">
            <button className="sidebar-toggle" onClick={() => setSidebar(!sidebarOpen)}>
              {sidebarOpen ? "✕" : "☰"}
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ fontFamily: "'DM Serif Display',serif", fontSize: 24, color: C.navy, lineHeight: 1.2 }}>
                {activeTab === "today" ? "Today's Viewings" : activeTab === "agents" ? "By Agent" : "Property Viewings"}
              </h1>
              <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 3 }}>
                {now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </div>
            </div>
            {loading && <div style={{ fontSize: 12, color: "#64748b", animation: "dashFadeIn .3s", flexShrink: 0 }}>⟳ Loading…</div>}
            <button className="refresh-btn" onClick={fetchAll}>↺ Refresh</button>
          </div>

          {/* ── STATS ── */}
          <div className="stats-grid">
            <StatCard icon="🏠" label="Total Viewings"  value={stats.total}     color={C.primary}  delay={0}    sub="All time" />
            <StatCard icon="📅" label="Today's Schedule" value={stats.today}     color="#0369a1"    delay={0.05} sub="Viewings today" />
            <StatCard icon="📆" label="This Month"       value={stats.thisMonth} color={C.purple}   delay={0.1}  sub={monthName} />
            <StatCard icon="🏆" label="Top Property"     value={stats.topType === "Apartment / Flat" ? "Apts" : stats.topType === "Villa / Bungalow" ? "Villas" : stats.topType === "Plot / Land" ? "Plots" : stats.topType === "Commercial / Office" ? "Commercial" : stats.topType}
              color="#0f766e" delay={0.15} sub="Most viewed this month" />
          </div>

          {/* ── AGENT CARDS ── */}
          {activeTab === "agents" && (
            <div className="agent-grid">
              {agentStats.map((agent, i) => (
                <div key={agent.name}
                  onClick={() => { setFilterAgt(agent.name); setActiveTab("all"); }}
                  style={{
                    background: C.card, borderRadius: 18, padding: "18px",
                    cursor: "pointer",
                    border: `1.5px solid ${filterAgent === agent.name ? agent.color : C.border}`,
                    boxShadow: `0 2px 14px ${agent.color}18`,
                    animation: `dashSlideUp .4s ${i * 0.06}s cubic-bezier(.22,1,.36,1) both`,
                    transition: "transform .15s, box-shadow .15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = `0 8px 28px ${agent.color}30`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)";   e.currentTarget.style.boxShadow = `0 2px 14px ${agent.color}18`; }}
                >
                  <div style={{ width: 38, height: 38, borderRadius: 11, background: agent.color + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, marginBottom: 10 }}>
                    👨‍💼
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: C.navy }}>{agent.name}</div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{agent.specialty}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{agent.areas.join(", ")}</div>
                  <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: agent.color }}>{agent.today}</div>
                      <div style={{ fontSize: 10.5, color: "#64748b" }}>Today</div>
                    </div>
                    <div style={{ width: 1, background: C.border }} />
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: agent.color }}>{agent.total}</div>
                      <div style={{ fontSize: 10.5, color: "#64748b" }}>Total</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 10, display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {agent.days.map((d) => (
                      <span key={d} style={{ fontSize: 10, fontWeight: 600, background: agent.color + "18", color: agent.color, padding: "2px 7px", borderRadius: 6 }}>{d}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── FILTERS ── */}
          <div className="filter-bar">
            <div style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>Filter:</div>
            <select className="filter-select" value={filterAgent} onChange={(e) => setFilterAgt(e.target.value)}>
              <option value="">All Agents</option>
              {AGENTS.map((a) => <option key={a.name} value={a.name}>{a.name}</option>)}
            </select>
            <select className="filter-select" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="">All Property Types</option>
              {PROPERTY_TYPES.map((pt) => <option key={pt.id} value={pt.label}>{pt.emoji} {pt.label}</option>)}
            </select>
            <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="filter-select" />
            <select className="filter-select" value={filterStatus} onChange={(e) => setFilterSt(e.target.value)}>
              <option value="">All Status</option>
              <option value="scheduled">Scheduled</option>
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
              <option value="no_show">No Show</option>
              <option value="cancelled">Cancelled</option>
            </select>
            {(filterAgent || filterDate || filterStatus || filterType) && (
              <button onClick={() => { setFilterAgt(""); setFilterDate(""); setFilterSt(""); setFilterType(""); }}
                style={{ border: `1px solid ${C.red}44`, background: C.red + "11", color: C.red, borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontSize: 12.5 }}>
                ✕ Clear
              </button>
            )}
            <div style={{ marginLeft: "auto", fontSize: 12.5, color: "#64748b", fontWeight: 500 }}>
              {viewings.length} viewing{viewings.length !== 1 ? "s" : ""}
            </div>
          </div>

          {/* ── VIEWINGS TABLE / CARDS ── */}
          {viewings.length === 0 && !loading ? (
            <div style={{ background: C.card, borderRadius: 18, border: `1px solid ${C.border}`, padding: "60px 0", textAlign: "center", color: "#64748b" }}>
              <div style={{ fontSize: 42, marginBottom: 12 }}>🏠</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: C.navy }}>No viewings found</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Try adjusting your filters</div>
            </div>
          ) : (
            <>
              <div className="view-table-view table-wrap">
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Client</th>
                        <th>Property</th>
                        <th>Agent</th>
                        <th>Date & Time</th>
                        <th>Status</th>
                        <th>Links</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewings.map((v) => (
                        <ViewingRow key={v.id} viewing={v} onStatusChange={handleStatusChange} onCancel={handleCancel} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="view-cards-view">
                {viewings.map((v) => (
                  <ViewingCard key={v.id} viewing={v} onStatusChange={handleStatusChange} onCancel={handleCancel} />
                ))}
              </div>
            </>
          )}

          {/* ── FULLY BOOKED ALERT ── */}
          {fullDays.size > 0 && (
            <div style={{
              marginTop: 18,
              background: "#fee2e2", border: `1px solid #fca5a5`,
              borderRadius: 14, padding: "14px 20px",
              display: "flex", alignItems: "flex-start", gap: 12,
            }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>🔴</span>
              <div>
                <div style={{ fontWeight: 700, color: "#dc2626", fontSize: 14 }}>
                  {fullDays.size} day{fullDays.size !== 1 ? "s" : ""} all agents fully booked this month
                </div>
                <div style={{ fontSize: 12.5, color: "#ef4444", marginTop: 3 }}>
                  {Array.from(fullDays).sort().map((d) =>
                    new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })
                  ).join(" · ")}
                </div>
              </div>
            </div>
          )}

          <div style={{ height: 32 }} />
        </main>
      </div>
    </>
  );
}
