import React from "react";

const TYPE_META = {
  no_helmet:     { label: "No Helmet",     color: "#ea580c", bg: "#fff7ed", border: "#fed7aa" },
  triple_riding: { label: "Triple Riding", color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
  both:          { label: "Both",          color: "#9333ea", bg: "#fdf4ff", border: "#e9d5ff" },
};

export default function ViolationLog({ violations, onSelect }) {
  return (
    <div className="violation-log">
      <div className="log-header">
        <span className="log-title">📋 Violation Log</span>
        <span className="log-count">{violations.length} records</span>
      </div>

      <div className="log-list">
        {violations.length === 0 ? (
          <div className="log-empty">
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
            No violations detected yet.<br />
            <span style={{ fontSize: 11 }}>Start monitoring to see results here.</span>
          </div>
        ) : (
          violations.map((v, i) => {
            const type = v.type || v.violation_type;
            const meta = TYPE_META[type] || TYPE_META.no_helmet;
            const time = v.timestamp || v.created_at
              ? new Date(v.timestamp || v.created_at).toLocaleTimeString("en-IN")
              : "--:--";

            return (
              <div key={v.id || i} className="log-item"
                style={{ borderLeftColor: meta.color }}
                onClick={() => onSelect(v)}>
                <div className="log-item-top">
                  <span className="log-badge"
                    style={{ color: meta.color, background: meta.bg, border: `1px solid ${meta.border}` }}>
                    {meta.label}
                  </span>
                  <span className="log-time">{time}</span>
                </div>
                <div className="log-item-bottom">
                  <span>🏍️ {v.rider_count || 1} rider(s)</span>
                  {v.plate_number && <span>🪪 {v.plate_number}</span>}
                  <span>📍 {v.location || "Unknown"}</span>
                </div>
                {v.confidence && (
                  <div className="log-confidence">
                    <div className="log-conf-bar" style={{ width: `${(v.confidence * 100).toFixed(0)}%` }} />
                    <span>{(v.confidence * 100).toFixed(0)}% confidence</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
