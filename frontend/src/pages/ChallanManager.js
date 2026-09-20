import React, { useState, useEffect, useRef } from "react";

const API = process.env.REACT_APP_API_URL || "http://localhost:8000";

const TYPE_META = {
  no_helmet:      { label: "No Helmet",      color: "#ea580c", bg: "#fff7ed", icon: "⛑️" },
  triple_riding:  { label: "Triple Riding",  color: "#dc2626", bg: "#fef2f2", icon: "🏍️" },
  signal_jumping: { label: "Signal Jumping", color: "#7c3aed", bg: "#f5f3ff", icon: "🚦" },
  lane_violation: { label: "Lane Violation", color: "#0369a1", bg: "#e0f2fe", icon: "🛣️" },
  wrong_way:      { label: "Wrong Way",      color: "#be185d", bg: "#fdf2f8", icon: "⛔" },
  overspeeding:   { label: "Overspeeding",   color: "#b45309", bg: "#fffbeb", icon: "⚡" },
  both:           { label: "Both",           color: "#9333ea", bg: "#fdf4ff", icon: "⚠️" },
};

const STATUS_META = {
  open:     { label: "Open",     color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  paid:     { label: "Paid",     color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
  disputed: { label: "Disputed", color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
  cancelled:{ label: "Cancelled",color: "#6b7280", bg: "#f9fafb", border: "#e5e7eb" },
};

export default function ChallanManager({ token }) {
  const [violations, setViolations] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [selected, setSelected]     = useState(null);
  const [editMode, setEditMode]     = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [filter, setFilter]         = useState("all");
  const [search, setSearch]         = useState("");
  const [toast, setToast]           = useState(null);
  const [saving, setSaving]         = useState(false);
  const printRef                    = useRef(null);

  const headers = {
    Authorization:  `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchViolations = async () => {
    setLoading(true);
    try {
      const url = filter === "all"
        ? `${API}/api/violations/?limit=100`
        : `${API}/api/violations/?limit=100&status=${filter}`;
      const res  = await fetch(url, { headers });
      const data = await res.json();
      setViolations(Array.isArray(data) ? data : []);
    } catch {
      showToast("Failed to load challans", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchViolations(); }, [filter, token]);

  // ── Edit form state ──────────────────────────
  const [editForm, setEditForm] = useState({});

  const openEdit = (v) => {
    setSelected(v);
    setEditForm({
      plate_number:   v.plate_number   || "",
      location:       v.location       || "",
      fine_amount:    v.fine_amount     || 1000,
      status:         v.status          || "open",
      notes:          v.notes           || "",
      challan_text:   v.challan_text    || "",
      violation_type: v.violation_type  || "no_helmet",
    });
    setEditMode(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/violations/${selected.id}`, {
        method:  "PATCH",
        headers,
        body:    JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error("Save failed");
      showToast("✅ Challan updated successfully");
      setEditMode(false);
      setSelected(null);
      fetchViolations();
    } catch {
      showToast("Failed to save changes", "error");
    } finally {
      setSaving(false);
    }
  };

  const deleteViolation = async (id) => {
    try {
      await fetch(`${API}/api/violations/${id}`, { method: "DELETE", headers });
      showToast("🗑️ Challan deleted");
      setDeleteConfirm(null);
      setSelected(null);
      setEditMode(false);
      fetchViolations();
    } catch {
      showToast("Failed to delete", "error");
    }
  };

  const printChallan = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const win = window.open("", "_blank");
    win.document.write(`
      <html><head><title>VIATRA Challan</title>
      <style>
        body { font-family: monospace; padding: 30px; max-width: 600px; margin: auto; }
        h2 { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; }
        .row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #eee; }
        .label { color: #666; font-size: 12px; }
        .value { font-weight: bold; }
        pre { background: #f5f5f5; padding: 15px; font-size: 11px; line-height: 1.8; white-space: pre-wrap; }
        @media print { button { display: none; } }
      </style></head>
      <body>${content}
      <br/><button onclick="window.print()">🖨️ Print</button>
      </body></html>
    `);
    win.document.close();
  };

  // Filter + search
  const filtered = violations.filter(v => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      v.plate_number?.toLowerCase().includes(q) ||
      v.violation_type?.toLowerCase().includes(q) ||
      v.location?.toLowerCase().includes(q) ||
      String(v.id).includes(q)
    );
  });

  const fmtDate = (d) => d
    ? new Date(d).toLocaleString("en-IN", {
        day:"2-digit", month:"short", year:"numeric",
        hour:"2-digit", minute:"2-digit", second:"2-digit"
      })
    : "—";

  return (
    <div className="cm-page">
      {/* Toast */}
      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}

      {/* Header */}
      <div className="cm-header">
        <div>
          <h2 className="cm-title">📋 Challan Manager</h2>
          <p className="cm-sub">View, edit and manage all traffic violation challans</p>
        </div>
        <div className="cm-header-right">
          <span className="cm-count">{filtered.length} challans</span>
        </div>
      </div>

      {/* Filters + Search */}
      <div className="cm-toolbar">
        <div className="cm-filters">
          {["all","open","paid","disputed","cancelled"].map(f => (
            <button key={f}
              className={`cm-filter-btn ${filter === f ? "active" : ""}`}
              onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f === "open" && violations.filter(v => v.status === "open").length > 0 && (
                <span className="cm-filter-count">
                  {violations.filter(v => v.status === "open").length}
                </span>
              )}
            </button>
          ))}
        </div>
        <input
          className="cm-search"
          placeholder="🔍 Search plate, type, location..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="cm-table-card">
        {loading ? (
          <div className="cm-loading"><div className="loader-spinner"/></div>
        ) : filtered.length === 0 ? (
          <div className="cm-empty">
            <div style={{ fontSize: 40, marginBottom: 10 }}>📋</div>
            No challans found. Start monitoring to generate challans.
          </div>
        ) : (
          <div className="cm-table-wrap">
            <table className="cm-table">
              <thead>
                <tr>
                  <th>#ID</th>
                  <th>Timestamp ⏱️</th>
                  <th>Violation</th>
                  <th>Plate</th>
                  <th>Location</th>
                  <th>Riders</th>
                  <th>Fine</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => {
                  const meta   = TYPE_META[v.violation_type] || TYPE_META.no_helmet;
                  const status = STATUS_META[v.status]        || STATUS_META.open;
                  return (
                    <tr key={v.id}>
                      <td className="cm-id">#{v.id}</td>
                      <td className="cm-ts">
                        <div className="cm-ts-main">
                          {v.created_at
                            ? new Date(v.created_at).toLocaleDateString("en-IN",
                                { day:"2-digit", month:"short", year:"numeric" })
                            : "—"}
                        </div>
                        <div className="cm-ts-time">
                          {v.created_at
                            ? new Date(v.created_at).toLocaleTimeString("en-IN",
                                { hour:"2-digit", minute:"2-digit", second:"2-digit" })
                            : ""}
                        </div>
                      </td>
                      <td>
                        <span className="cm-type-badge"
                          style={{ color: meta.color, background: meta.bg }}>
                          {meta.icon} {meta.label}
                        </span>
                      </td>
                      <td className="cm-plate">
                        {v.plate_number || <span style={{ color: "#94a3b8" }}>Not detected</span>}
                      </td>
                      <td className="cm-loc">{v.location || "—"}</td>
                      <td style={{ textAlign: "center" }}>{v.rider_count || 1}</td>
                      <td className="cm-fine">₹{(v.fine_amount || 0).toLocaleString()}</td>
                      <td>
                        <span className="cm-status-badge"
                          style={{ color: status.color, background: status.bg,
                                   border: `1px solid ${status.border}` }}>
                          {status.label}
                        </span>
                      </td>
                      <td>
                        <div className="cm-actions">
                          <button className="cm-btn cm-btn-view"
                            onClick={() => { setSelected(v); setEditMode(false); }}>
                            👁 View
                          </button>
                          <button className="cm-btn cm-btn-edit"
                            onClick={() => openEdit(v)}>
                            ✏️ Edit
                          </button>
                          <button className="cm-btn cm-btn-delete"
                            onClick={() => setDeleteConfirm(v)}>
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── VIEW / EDIT MODAL ── */}
      {selected && (
        <div className="modal-overlay" onClick={() => { setSelected(null); setEditMode(false); }}>
          <div className="cm-modal" onClick={e => e.stopPropagation()}>

            {/* Modal header */}
            <div className="cm-modal-header">
              <div className="cm-modal-title">
                <span>{editMode ? "✏️ Edit Challan" : "📋 Challan Details"}</span>
                <span className="cm-modal-id">#{selected.id}</span>
              </div>
              <div className="cm-modal-header-actions">
                {!editMode && (
                  <>
                    <button className="cm-header-btn" onClick={() => openEdit(selected)}>
                      ✏️ Edit
                    </button>
                    <button className="cm-header-btn cm-header-btn-print" onClick={printChallan}>
                      🖨️ Print
                    </button>
                  </>
                )}
                <button className="modal-close"
                  onClick={() => { setSelected(null); setEditMode(false); }}>✕</button>
              </div>
            </div>

            {/* Snapshot */}
            {selected.snapshot_path && (
              <div className="modal-snapshot">
                <img src={`${API}/${selected.snapshot_path}`} alt="violation snapshot" />
                <div className="snapshot-overlay">
                  <span className="snapshot-ts">📸 {fmtDate(selected.created_at)}</span>
                </div>
              </div>
            )}

            {/* Printable content */}
            <div ref={printRef} style={{ display: "none" }}>
              <h2>VIATRA — Hyderabad Traffic Police</h2>
              <div className="row"><span className="label">Challan ID</span><span className="value">#{selected.id}</span></div>
              <div className="row"><span className="label">Timestamp</span><span className="value">{fmtDate(selected.created_at)}</span></div>
              <div className="row"><span className="label">Violation</span><span className="value">{selected.violation_type?.replace("_"," ").toUpperCase()}</span></div>
              <div className="row"><span className="label">Plate</span><span className="value">{selected.plate_number || "Not Detected"}</span></div>
              <div className="row"><span className="label">Location</span><span className="value">{selected.location}</span></div>
              <div className="row"><span className="label">Fine</span><span className="value">₹{selected.fine_amount}</span></div>
              <div className="row"><span className="label">Legal Section</span><span className="value">{selected.legal_section}</span></div>
              <div className="row"><span className="label">Status</span><span className="value">{selected.status?.toUpperCase()}</span></div>
              <pre>{selected.challan_text}</pre>
            </div>

            {editMode ? (
              /* ── EDIT FORM ── */
              <div className="cm-edit-form">
                <div className="cm-edit-grid">
                  <div className="cm-field">
                    <label>Violation Type</label>
                    <select className="cm-input"
                      value={editForm.violation_type}
                      onChange={e => setEditForm({...editForm, violation_type: e.target.value})}>
                      {Object.entries(TYPE_META).map(([k,v]) => (
                        <option key={k} value={k}>{v.icon} {v.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="cm-field">
                    <label>Status</label>
                    <select className="cm-input"
                      value={editForm.status}
                      onChange={e => setEditForm({...editForm, status: e.target.value})}>
                      {Object.entries(STATUS_META).map(([k,v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="cm-field">
                    <label>Vehicle Plate Number</label>
                    <input className="cm-input" placeholder="e.g. TS09AB1234"
                      value={editForm.plate_number}
                      onChange={e => setEditForm({...editForm, plate_number: e.target.value})} />
                  </div>
                  <div className="cm-field">
                    <label>Fine Amount (₹)</label>
                    <input type="number" className="cm-input"
                      value={editForm.fine_amount}
                      onChange={e => setEditForm({...editForm, fine_amount: parseInt(e.target.value)})} />
                  </div>
                  <div className="cm-field cm-field-full">
                    <label>Location</label>
                    <input className="cm-input"
                      value={editForm.location}
                      onChange={e => setEditForm({...editForm, location: e.target.value})} />
                  </div>
                  <div className="cm-field cm-field-full">
                    <label>Officer Notes</label>
                    <textarea className="cm-textarea" rows={3}
                      placeholder="Add notes, observations..."
                      value={editForm.notes}
                      onChange={e => setEditForm({...editForm, notes: e.target.value})} />
                  </div>
                  <div className="cm-field cm-field-full">
                    <label>Challan Text</label>
                    <textarea className="cm-textarea cm-challan-textarea" rows={8}
                      value={editForm.challan_text}
                      onChange={e => setEditForm({...editForm, challan_text: e.target.value})} />
                  </div>
                </div>

                <div className="cm-edit-actions">
                  <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>
                    {saving ? "💾 Saving..." : "💾 Save Changes"}
                  </button>
                  <button className="btn btn-secondary"
                    onClick={() => setEditMode(false)}>
                    Cancel
                  </button>
                  <button className="btn btn-danger"
                    onClick={() => setDeleteConfirm(selected)}>
                    🗑️ Delete Challan
                  </button>
                </div>
              </div>
            ) : (
              /* ── VIEW MODE ── */
              <div className="cm-view-body">
                {/* Timestamp proof banner */}
                <div className="cm-timestamp-proof">
                  <div className="cm-ts-proof-icon">⏱️</div>
                  <div>
                    <div className="cm-ts-proof-label">Recorded Timestamp (Proof)</div>
                    <div className="cm-ts-proof-val">{fmtDate(selected.created_at)}</div>
                  </div>
                  {selected.updated_at && (
                    <div style={{ marginLeft: "auto", textAlign: "right" }}>
                      <div className="cm-ts-proof-label">Last Updated</div>
                      <div className="cm-ts-proof-val" style={{ fontSize: 12 }}>
                        {fmtDate(selected.updated_at)}
                      </div>
                    </div>
                  )}
                </div>

                {/* Details grid */}
                <div className="cm-detail-grid">
                  {[
                    { label: "Challan ID",    val: `#${selected.id}` },
                    { label: "Violation",     val: TYPE_META[selected.violation_type]?.label || selected.violation_type,
                                              color: TYPE_META[selected.violation_type]?.color },
                    { label: "Vehicle Plate", val: selected.plate_number || "Not detected" },
                    { label: "Fine Amount",   val: `₹${(selected.fine_amount||0).toLocaleString()}`, color: "#dc2626" },
                    { label: "Riders",        val: selected.rider_count || 1 },
                    { label: "Speed",         val: selected.speed_kmh ? `${selected.speed_kmh} km/h` : "N/A" },
                    { label: "Legal Section", val: selected.legal_section || "MV Act 1988" },
                    { label: "Location",      val: selected.location || "—" },
                    { label: "Status",        val: STATUS_META[selected.status]?.label || selected.status,
                                              color: STATUS_META[selected.status]?.color },
                    { label: "Confidence",    val: selected.confidence ? `${(selected.confidence*100).toFixed(1)}%` : "—" },
                  ].map(d => (
                    <div className="cm-detail-row" key={d.label}>
                      <span className="cm-detail-label">{d.label}</span>
                      <span className="cm-detail-val" style={{ color: d.color }}>
                        {d.val}
                      </span>
                    </div>
                  ))}
                </div>

                {/* All violations */}
                {selected.all_violations && (
                  <div className="cm-all-violations">
                    <span className="cm-all-viol-label">All violations detected:</span>
                    {selected.all_violations.split(",").filter(Boolean).map(v => {
                      const m = TYPE_META[v.trim()] || TYPE_META.no_helmet;
                      return (
                        <span key={v} className="cm-viol-pill"
                          style={{ background: m.bg, color: m.color }}>
                          {m.icon} {m.label}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Notes */}
                {selected.notes && (
                  <div className="cm-notes">
                    <span className="cm-notes-label">📝 Officer Notes:</span>
                    <p>{selected.notes}</p>
                  </div>
                )}

                {/* Challan text */}
                {selected.challan_text && (
                  <div className="cm-challan-preview">
                    <div className="cm-challan-preview-header">
                      <span>📄 Official Challan</span>
                    </div>
                    <pre className="challan-text">{selected.challan_text}</pre>
                  </div>
                )}

                <div className="modal-actions">
                  <button className="btn btn-primary" onClick={printChallan}>
                    🖨️ Print Challan
                  </button>
                  <button className="btn btn-secondary" onClick={() => openEdit(selected)}>
                    ✏️ Edit
                  </button>
                  <button className="btn btn-danger" onClick={() => setDeleteConfirm(selected)}>
                    🗑️ Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM ── */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="cm-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="cm-confirm-icon">🗑️</div>
            <h3>Delete Challan #{deleteConfirm.id}?</h3>
            <p>This action cannot be undone. The challan record and snapshot will be permanently removed.</p>
            <div className="cm-confirm-actions">
              <button className="btn btn-danger"
                onClick={() => deleteViolation(deleteConfirm.id)}>
                Yes, Delete
              </button>
              <button className="btn btn-secondary"
                onClick={() => setDeleteConfirm(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
