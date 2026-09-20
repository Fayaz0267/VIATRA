import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import LiveFeed       from "../components/LiveFeed";
import ViolationLog   from "../components/ViolationLog";
import StatsPanel     from "../components/StatsPanel";
import ChallanModal   from "../components/ChallanModal";
import AnalyticsPage  from "./AnalyticsPage";
import ChallanManager from "./ChallanManager";
import { playViolationAlert, playStartupSound, playChallanSound } from "../components/SoundAlert";

const API = process.env.REACT_APP_API_URL || "http://localhost:8000";

export default function Dashboard() {
  const { officer, token, logout } = useAuth();
  const navigate                   = useNavigate();
  const [activeTab, setActiveTab]  = useState("live");
  const [violations, setViolations] = useState([]);
  const [stats, setStats]           = useState(null);
  const [selected, setSelected]     = useState(null);
  const [isConnected, setConnected] = useState(false);
  const [currentTime, setTime]      = useState(new Date());
  const [soundOn, setSoundOn]       = useState(true);
  const [newViolation, setNewViolation] = useState(null);
  const [totalToday, setTotalToday]     = useState(0);
  const [flashCount, setFlashCount]     = useState(0);
  const layer1 = useRef(null);
  const layer2 = useRef(null);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Parallax
  useEffect(() => {
    const fn = () => {
      const y = window.scrollY;
      if (layer1.current) layer1.current.style.transform = `translateY(${y*.3}px)`;
      if (layer2.current) layer2.current.style.transform = `translateY(${y*.15}px)`;
    };
    window.addEventListener("scroll", fn, { passive:true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const headers = useCallback(() => ({
    "Authorization": `Bearer ${token}`,
    "Content-Type":  "application/json",
  }), [token]);

  // Fetch stats
  useEffect(() => {
    if (!token) return;
    const fetch_ = async () => {
      try {
        const res = await fetch(`${API}/api/stats/summary`, { headers: headers() });
        if (res.ok) {
          const data = await res.json();
          setStats(data);
          setTotalToday(data.total_violations || 0);
        }
        else if (res.status === 401) { logout(); navigate("/"); }
      } catch {}
    };
    fetch_();
    const i = setInterval(fetch_, 5000);
    return () => clearInterval(i);
  }, [token]);

  // Fetch violations
  useEffect(() => {
    if (!token) return;
    const fetch_ = async () => {
      try {
        const res = await fetch(`${API}/api/violations/?limit=20`, { headers: headers() });
        if (res.ok) setViolations(await res.json());
        else if (res.status === 401) { logout(); navigate("/"); }
      } catch {}
    };
    fetch_();
    const i = setInterval(fetch_, 3000);
    return () => clearInterval(i);
  }, [token]);

  // Handle new violation — sound + counter
  const handleNewViolation = useCallback((v) => {
    setViolations(prev => [v, ...prev.slice(0, 49)]);
    setNewViolation(v);
    setFlashCount(c => c + 1);
    setTotalToday(c => c + 1);

    // Sound alert
    if (soundOn) {
      playViolationAlert(v.type || "default");
      // Play challan sound after short delay
      setTimeout(() => playChallanSound(), 600);
    }

    // Clear new violation indicator after 4s
    setTimeout(() => setNewViolation(null), 4000);
  }, [soundOn]);

  const tabs = [
    { id:"live",      icon:"📹", label:"Live Monitor"    },
    { id:"challans",  icon:"📋", label:"Challan Manager" },
    { id:"analytics", icon:"📊", label:"Analytics"       },
  ];

  return (
    <div className="dash-page">
      <div className="dash-parallax-bg"/>
      <div className="dash-parallax-l1" ref={layer1}/>
      <div className="dash-parallax-l2" ref={layer2}/>
      <div className="dash-grid"/>

      {/* Sidebar */}
      <aside className="dash-sidebar">
        <div className="dash-sidebar-brand">
          <div className="dash-brand-icon">🛡️</div>
          <div>
            <div className="dash-brand-title">VIATRA</div>
            <div className="dash-brand-sub">v5.0 · YOLO11</div>
          </div>
        </div>

        <nav className="dash-nav">
          {tabs.map(t => (
            <button key={t.id}
              className={`dash-nav-item ${activeTab===t.id?"active":""}`}
              onClick={() => setActiveTab(t.id)}>
              <span className="dash-nav-icon">{t.icon}</span>
              <span>{t.label}</span>
              {t.id==="challans" && flashCount>0 && (
                <span style={{
                  marginLeft:"auto",background:"#dc2626",color:"#fff",
                  borderRadius:"50%",width:18,height:18,fontSize:10,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontWeight:700,animation:"dotPulse 1.2s ease-in-out infinite"
                }}>{flashCount}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Live violation counter */}
        <div style={{
          margin:"12px",padding:"14px",
          background: newViolation
            ? "linear-gradient(135deg,#fef2f2,#fee2e2)"
            : "rgba(255,255,255,0.05)",
          border: `1px solid ${newViolation ? "#fecaca" : "rgba(255,255,255,0.1)"}`,
          borderRadius:12,transition:"all 0.4s",
          textAlign:"center"
        }}>
          <div style={{
            fontSize:42,fontWeight:900,
            color: newViolation ? "#dc2626" : "#fff",
            fontFamily:"'Poppins',sans-serif",
            transition:"all 0.3s",
            textShadow: newViolation ? "0 0 20px rgba(220,38,38,0.5)" : "none",
            animation: newViolation ? "counterPop 0.4s ease" : "none"
          }}>
            {totalToday.toLocaleString()}
          </div>
          <div style={{
            fontSize:10,fontWeight:700,letterSpacing:2,
            color: newViolation ? "#dc2626" : "rgba(255,255,255,0.5)",
            textTransform:"uppercase",marginBottom:6
          }}>
            {newViolation ? "🚨 VIOLATION!" : "TOTAL VIOLATIONS"}
          </div>
          {newViolation && (
            <div style={{
              fontSize:11,color:"#dc2626",fontWeight:600,
              animation:"fadeUp 0.3s ease"
            }}>
              {newViolation.type?.replace("_"," ").toUpperCase()}
              {newViolation.plate_number && ` · ${newViolation.plate_number}`}
            </div>
          )}
        </div>

        {/* Sound toggle */}
        <button onClick={() => setSoundOn(!soundOn)}
          style={{
            margin:"0 12px",padding:"8px 12px",
            background: soundOn ? "rgba(74,222,128,0.1)" : "rgba(255,255,255,0.05)",
            border: `1px solid ${soundOn ? "rgba(74,222,128,0.3)" : "rgba(255,255,255,0.1)"}`,
            borderRadius:8,cursor:"pointer",
            display:"flex",alignItems:"center",gap:8,width:"calc(100% - 24px)"
          }}>
          <span style={{fontSize:16}}>{soundOn ? "🔔" : "🔕"}</span>
          <span style={{fontSize:11,color:soundOn?"#4ade80":"rgba(255,255,255,0.4)",fontWeight:600}}>
            Sound {soundOn ? "ON" : "OFF"}
          </span>
        </button>

        <div className="dash-sidebar-info">
          <div className="dash-clock">
            {currentTime.toLocaleTimeString("en-IN",{hour12:false})}
          </div>
          <div className="dash-date">
            {currentTime.toLocaleDateString("en-IN",
              {day:"2-digit",month:"short",year:"numeric"})}
          </div>
          <div className={`dash-status ${isConnected?"connected":""}`}>
            <span className="dash-status-dot"/>
            {isConnected ? "LIVE" : "STANDBY"}
          </div>
        </div>

        <div className="dash-sidebar-footer">
          <div className="dash-officer-info">
            <div className="dash-officer-avatar">
              {officer?.name?.[0]?.toUpperCase()||"O"}
            </div>
            <div>
              <div className="dash-officer-name">{officer?.name}</div>
              <div className="dash-officer-rank">{officer?.rank||"Officer"}</div>
            </div>
          </div>
          <button className="dash-logout"
            onClick={() => { logout(); navigate("/"); }}>
            Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="dash-main">
        {activeTab==="live" && (
          <>
            <StatsPanel
              stats={stats}
              newViolation={newViolation}
            />
            <div className="main-grid">
              <LiveFeed
                onViolation={handleNewViolation}
                onConnectionChange={setConnected}
              />
              <ViolationLog violations={violations} onSelect={setSelected}/>
            </div>
          </>
        )}
        {activeTab==="challans"  && <ChallanManager token={token}/>}
        {activeTab==="analytics" && <AnalyticsPage  token={token}/>}
      </main>

      {selected && (
        <ChallanModal violation={selected} onClose={() => setSelected(null)}/>
      )}
    </div>
  );
}
