import React, { useState, useEffect } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, AreaChart, Area
} from "recharts";

const API    = process.env.REACT_APP_API_URL || "http://localhost:8000";
const COLORS = ["#f97316", "#dc2626", "#a855f7", "#1a56db", "#16a34a"];

export default function AnalyticsPage({ token }) {
  const [summary,  setSummary]  = useState(null);
  const [byDay,    setByDay]    = useState([]);
  const [byType,   setByType]   = useState([]);
  const [byHour,   setByHour]   = useState([]);
  const [byLoc,    setByLoc]    = useState([]);
  const [loading,  setLoading]  = useState(true);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [s, d, t, h, l] = await Promise.all([
          fetch(`${API}/api/stats/summary`,     { headers }).then(r => r.json()),
          fetch(`${API}/api/stats/by-day`,      { headers }).then(r => r.json()),
          fetch(`${API}/api/stats/by-type`,     { headers }).then(r => r.json()),
          fetch(`${API}/api/stats/by-hour`,     { headers }).then(r => r.json()),
          fetch(`${API}/api/stats/by-location`, { headers }).then(r => r.json()),
        ]);
        setSummary(s); setByDay(d); setByType(t); setByHour(h); setByLoc(l);
      } catch (e) {
        console.error("Analytics fetch failed", e);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
    const i = setInterval(fetchAll, 30000);
    return () => clearInterval(i);
  }, [token]);

  if (loading) return (
    <div className="analytics-loading">
      <div className="loader-spinner"/>
      <p>Loading analytics...</p>
    </div>
  );

  const pieData = byType.map(t => ({
    name:  t.type.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase()),
    value: t.count
  }));

  const hourData = Array.from({ length: 24 }, (_, i) => ({
    hour:  `${i}:00`,
    count: byHour.find(h => h.hour === i)?.count || 0
  }));

  const recoveryRate = summary
    ? Math.round(((summary.paid || 0) / Math.max(summary.total_violations, 1)) * 100)
    : 0;

  return (
    <div className="analytics-page">
      <div className="analytics-header">
        <h2 className="analytics-title">📊 Analytics Dashboard</h2>
        <span className="analytics-sub">Real-time violation intelligence</span>
      </div>

      {/* KPI Cards */}
      {summary && (
        <div className="analytics-kpis">
          {[
            { label: "Total Violations", val: summary.total_violations, icon: "🚨", color: "#dc2626" },
            { label: "Total Fines",      val: `₹${(summary.total_fines||0).toLocaleString()}`, icon: "💰", color: "#16a34a" },
            { label: "Open Cases",       val: summary.open || 0,        icon: "📂", color: "#d97706" },
            { label: "Paid",             val: summary.paid || 0,        icon: "✅", color: "#1a56db" },
            { label: "Recovery Rate",    val: `${recoveryRate}%`,       icon: "📈", color: "#a855f7" },
          ].map(k => (
            <div className="analytics-kpi" key={k.label} style={{ borderTopColor: k.color }}>
              <div className="kpi-icon">{k.icon}</div>
              <div className="kpi-val" style={{ color: k.color }}>{k.val}</div>
              <div className="kpi-label">{k.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Charts grid */}
      <div className="analytics-grid">

        {/* Violations over time */}
        <div className="analytics-chart-card analytics-chart-wide">
          <div className="chart-card-header">
            <span className="chart-card-title">Violations Over Time</span>
            <span className="chart-card-sub">Last 30 days</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={byDay} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="violGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#dc2626" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#dc2626" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false}
                tickFormatter={d => d?.slice(5) || ""} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#1e293b", fontWeight: 600 }}
              />
              <Area type="monotone" dataKey="count" stroke="#dc2626" strokeWidth={2}
                fill="url(#violGrad)" name="Violations" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* By type pie */}
        <div className="analytics-chart-card">
          <div className="chart-card-header">
            <span className="chart-card-title">By Violation Type</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                dataKey="value" nameKey="name" paddingAngle={3}>
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip
                contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12 }}
              />
              <Legend iconType="circle" iconSize={10}
                formatter={v => <span style={{ fontSize: 11, color: "#64748b" }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* By hour */}
        <div className="analytics-chart-card">
          <div className="chart-card-header">
            <span className="chart-card-title">Violations by Hour</span>
            <span className="chart-card-sub">Peak hours</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={hourData} barSize={10} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="hour" tick={{ fontSize: 9, fill: "#94a3b8" }} tickLine={false} axisLine={false}
                interval={3} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey="count" fill="#1a56db" radius={[3, 3, 0, 0]} name="Violations" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Fines collected over time */}
        <div className="analytics-chart-card analytics-chart-wide">
          <div className="chart-card-header">
            <span className="chart-card-title">Fines Collected Over Time</span>
            <span className="chart-card-sub">₹ per day</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={byDay} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false}
                tickFormatter={d => d?.slice(5) || ""} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false}
                tickFormatter={v => `₹${v}`} />
              <Tooltip
                contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12 }}
                formatter={v => [`₹${v}`, "Fines"]}
              />
              <Line type="monotone" dataKey="fines" stroke="#16a34a" strokeWidth={2.5}
                dot={false} name="Fines (₹)" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Top locations */}
        <div className="analytics-chart-card">
          <div className="chart-card-header">
            <span className="chart-card-title">Top Violation Hotspots</span>
          </div>
          <div className="hotspots-list">
            {byLoc.length === 0 ? (
              <div className="hotspots-empty">No location data yet</div>
            ) : byLoc.map((loc, i) => (
              <div key={i} className="hotspot-item">
                <div className="hotspot-rank">#{i + 1}</div>
                <div className="hotspot-info">
                  <div className="hotspot-name">{loc.location}</div>
                  <div className="hotspot-bar-wrap">
                    <div className="hotspot-bar"
                      style={{ width: `${Math.round((loc.count / byLoc[0].count) * 100)}%` }}/>
                  </div>
                </div>
                <div className="hotspot-count">{loc.count}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
