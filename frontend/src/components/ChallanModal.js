import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

const API = process.env.REACT_APP_API_URL || "http://localhost:8000";

const TYPE_META = {
  no_helmet:     { label: "No Helmet",     color: "#ea580c", icon: "⛑️" },
  triple_riding: { label: "Triple Riding", color: "#dc2626", icon: "🏍️" },
  both:          { label: "Both",          color: "#9333ea", icon: "⚠️" },
};

export default function ChallanModal({ violation, onClose }) {
  const { token }               = useAuth();
  const [challan, setChallan]   = useState(violation.challan_text || null);
  const [loading, setLoading]   = useState(false);
  const [copied, setCopied]     = useState(false);

  const type = violation.type || violation.violation_type;
  const meta = TYPE_META[type] || TYPE_META.no_helmet;

  useEffect(() => { if (!challan) generateChallan(); }, []);

  const generateChallan = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/challan/generate`, {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:  `Bearer ${token}`
        },
        body: JSON.stringify({
          violation_type: type,
          rider_count:    violation.rider_count || 1,
          location:       violation.location    || "Unknown",
          fine_amount:    violation.fine_amount || 1000,
        }),
      });
      const data = await res.json();
      setChallan(data.challan);
    } catch { setChallan("Failed to generate challan. Please try again."); }
    finally   { setLoading(false); }
  };

  const downloadChallan = () => {
    const blob = new Blob([challan], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `challan_${violation.id || Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyChallan = () => {
    navigator.clipboard.writeText(challan || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const time = violation.timestamp || violation.created_at
    ? new Date(violation.timestamp || violation.created_at).toLocaleString("en-IN")
    : "Just now";

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="modal-icon">{meta.icon}</span>
            <span className="modal-title">Violation Details</span>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Snapshot */}
        {violation.snapshot && (
          <div className="modal-snapshot">
            <img src={`${API}${violation.snapshot}`} alt="violation" />
          </div>
        )}

        {/* Details */}
        <div className="modal-details">
          {[
            { label: "Type",        val: meta.label,                        color: meta.color },
            { label: "Time",        val: time },
            { label: "Riders",      val: violation.rider_count || 1 },
            { label: "Plate",       val: violation.plate_number || "Not detected" },
            { label: "Location",    val: violation.location || "Unknown" },
            { label: "Fine",        val: `₹${(violation.fine_amount || 1000).toLocaleString()}`, color: "#dc2626", big: true },
          ].map(d => (
            <div className="detail-row" key={d.label}>
              <span className="detail-label">{d.label}</span>
              <span className="detail-value"
                style={{ color: d.color || undefined, fontSize: d.big ? 20 : undefined, fontWeight: d.big ? 700 : undefined }}>
                {d.val}
              </span>
            </div>
          ))}
        </div>

        {/* Challan */}
        <div className="challan-section">
          <div className="challan-header">
            <span className="challan-label">📄 AI-Generated Challan</span>
            <div style={{ display:"flex", gap:6 }}>
              <button className="btn-regen" onClick={copyChallan} disabled={!challan}>
                {copied ? "✅ Copied" : "📋 Copy"}
              </button>
              <button className="btn-regen" onClick={generateChallan} disabled={loading}>
                {loading ? "⏳" : "↻ Regenerate"}
              </button>
            </div>
          </div>
          <div className="challan-body">
            {loading ? (
              <div className="challan-loading">
                <div className="spinner" />
                <span>Generating via AI ({process.env.REACT_APP_LLM_PROVIDER || "Gemini"})...</span>
              </div>
            ) : (
              <pre className="challan-text">{challan || "No challan generated yet."}</pre>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={downloadChallan} disabled={!challan}>
            ⬇ Download Challan
          </button>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
