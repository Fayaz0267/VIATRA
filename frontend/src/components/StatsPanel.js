import React, { useState, useEffect, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

// ── Animated counter ─────────────────────────────
function AnimatedCount({ target, duration = 1000, color, prefix = "", suffix = "" }) {
  const [count, setCount] = useState(0);
  const prevRef = useRef(0);

  useEffect(() => {
    if (target === prevRef.current) return;
    const start    = prevRef.current;
    const diff     = target - start;
    const steps    = 40;
    const stepTime = duration / steps;
    let   step     = 0;

    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      const ease     = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setCount(Math.round(start + diff * ease));
      if (step >= steps) {
        clearInterval(timer);
        setCount(target);
        prevRef.current = target;
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [target]);

  return (
    <span style={{ color }}>
      {prefix}{typeof count === "number" ? count.toLocaleString() : count}{suffix}
    </span>
  );
}

const CARDS = [
  {
    key:   "total_violations",
    label: "Total Violations",
    icon:  "🚨",
    color: "#dc2626",
    bg:    "#fef2f2",
    border:"#fecaca",
    sub:   "All time",
  },
  {
    key:   "no_helmet",
    label: "No Helmet",
    icon:  "⛑️",
    color: "#ea580c",
    bg:    "#fff7ed",
    border:"#fed7aa",
    sub:   "Cases",
  },
  {
    key:   "triple_riding",
    label: "Triple Riding",
    icon:  "🏍️",
    color: "#d97706",
    bg:    "#fffbeb",
    border:"#fde68a",
    sub:   "Cases",
  },
  {
    key:   "challans_sent",
    label: "Challans Issued",
    icon:  "📋",
    color: "#1a56db",
    bg:    "#eff6ff",
    border:"#bfdbfe",
    sub:   "Generated",
  },
  {
    key:   "total_fines",
    label: "Total Fines",
    icon:  "💰",
    color: "#16a34a",
    bg:    "#f0fdf4",
    border:"#bbf7d0",
    sub:   "₹ Collected",
    prefix:"₹",
  },
];

export default function StatsPanel({ stats, newViolation }) {
  const [flash, setFlash] = useState(false);

  // Flash animation when new violation detected
  useEffect(() => {
    if (!newViolation) return;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 800);
    return () => clearTimeout(t);
  }, [newViolation]);

  const chartData = [
    { name: "No Helmet",   value: stats?.no_helmet      || 0 },
    { name: "Triple",      value: stats?.triple_riding   || 0 },
    { name: "Both",        value: stats?.both             || 0 },
    { name: "Signal",      value: stats?.signal_jumping   || 0 },
    { name: "Lane",        value: stats?.lane_violation   || 0 },
    { name: "Speed",       value: stats?.overspeeding     || 0 },
  ];

  const COLORS = ["#ea580c","#dc2626","#9333ea","#7c3aed","#0369a1","#b45309"];

  return (
    <div className={`stats-panel ${flash ? "stats-flash" : ""}`}>
      {/* Live indicator */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        marginBottom: 12, padding: "6px 12px",
        background: flash ? "#fef2f2" : "#f0fdf4",
        borderRadius: 8, border: `1px solid ${flash ? "#fecaca" : "#bbf7d0"}`,
        transition: "all 0.3s"
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: "50%",
          background: flash ? "#dc2626" : "#16a34a",
          display: "inline-block",
          animation: "dotPulse 1.2s ease-in-out infinite"
        }}/>
        <span style={{
          fontSize: 11, fontWeight: 700, letterSpacing: 1,
          color: flash ? "#dc2626" : "#15803d",
          textTransform: "uppercase"
        }}>
          {flash ? "🚨 NEW VIOLATION DETECTED!" : "● LIVE MONITORING"}
        </span>
        {stats?.total_violations > 0 && (
          <span style={{ marginLeft: "auto", fontSize: 11, color: "#64748b" }}>
            Today's total: <strong style={{ color: "#dc2626" }}>
              {stats.total_violations}
            </strong>
          </span>
        )}
      </div>

      {/* Stat cards */}
      <div className="stats-cards">
        {CARDS.map(c => (
          <div key={c.key}
            className={`stat-card ${flash && c.key === "total_violations" ? "stat-card-flash" : ""}`}
            style={{
              "--card-color": c.color,
              background: flash && c.key === "total_violations" ? "#fef2f2" : "#fff",
              transition: "all 0.3s",
            }}>
            <div className="stat-card-top">
              <span className="stat-label">{c.label}</span>
              <span className="stat-icon-box" style={{ background: c.bg }}>{c.icon}</span>
            </div>
            <div className="stat-value" style={{ fontSize: 28, fontWeight: 800 }}>
              <AnimatedCount
                target={
                  c.key === "total_fines"
                    ? (stats?.[c.key] || 0)
                    : (stats?.[c.key] || 0)
                }
                color={c.color}
                prefix={c.prefix || ""}
                duration={800}
              />
            </div>
            <div className="stat-sub">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="stats-chart">
        <p className="chart-title">Violation Breakdown</p>
        <ResponsiveContainer width="100%" height={110}>
          <BarChart data={chartData} barSize={22}
            margin={{ top:4, right:4, left:-28, bottom:0 }}>
            <XAxis dataKey="name"
              tick={{ fontSize:8, fill:"#94a3b8" }}
              axisLine={false} tickLine={false}/>
            <YAxis hide/>
            <Tooltip
              contentStyle={{
                background:"#fff", border:"1px solid #e2e8f0",
                borderRadius:8, fontSize:11
              }}/>
            <Bar dataKey="value" radius={[4,4,0,0]}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]}/>
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
