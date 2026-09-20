import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const API = process.env.REACT_APP_API_URL || "http://localhost:8000";

const STATUS_META = {
  pending:  { label: "Pending",  color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  approved: { label: "Approved", color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
  rejected: { label: "Rejected", color: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
};

export default function AdminPage() {
  const { officer, token, logout } = useAuth();
  const navigate                   = useNavigate();
  const [officers, setOfficers]    = useState([]);
  const [summary, setSummary]      = useState(null);
  const [filter, setFilter]        = useState("pending");
  const [loading, setLoading]      = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [toast, setToast]          = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [offRes, sumRes] = await Promise.all([
        fetch(`${API}/api/admin/officers?status=${filter}`, { headers }),
        fetch(`${API}/api/admin/summary`, { headers })
      ]);
      setOfficers(await offRes.json());
      setSummary(await sumRes.json());
    } catch (e) {
      showToast("Failed to load data", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [filter]);

  const approve = async (id, name) => {
    setActionLoading(id);
    try {
      await fetch(`${API}/api/admin/officers/${id}/approve`, { method: "PATCH", headers });
      showToast(`✅ ${name} approved successfully`);
      fetchData();
    } catch { showToast("Failed to approve", "error"); }
    finally { setActionLoading(null); }
  };

  const reject = async (id, name) => {
    if (!window.confirm(`Reject ${name}?`)) return;
    setActionLoading(id);
    try {
      await fetch(`${API}/api/admin/officers/${id}/reject`, { method: "PATCH", headers });
      showToast(`${name} has been rejected`, "error");
      fetchData();
    } catch { showToast("Failed to reject", "error"); }
    finally { setActionLoading(null); }
  };

  const deleteOfficer = async (id, name) => {
    if (!window.confirm(`Permanently delete ${name}?`)) return;
    setActionLoading(id);
    try {
      await fetch(`${API}/api/admin/officers/${id}`, { method: "DELETE", headers });
      showToast(`${name} deleted`);
      fetchData();
    } catch { showToast("Failed to delete", "error"); }
    finally { setActionLoading(null); }
  };

  return (
    <div className="admin-page">
      {/* Toast */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
      )}

      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">
          <div className="admin-brand-icon">🛡️</div>
          <div>
            <div className="admin-brand-title">VIATRA</div>
            <div className="admin-brand-sub">Admin Panel</div>
          </div>
        </div>

        <nav className="admin-nav">
          <button
            className={`admin-nav-item ${filter === "pending"  ? "active" : ""}`}
            onClick={() => setFilter("pending")}
          >
            <span>⏳</span> Pending
            {summary?.pending > 0 && <span className="admin-nav-badge">{summary.pending}</span>}
          </button>
          <button
            className={`admin-nav-item ${filter === "approved" ? "active" : ""}`}
            onClick={() => setFilter("approved")}
          >
            <span>✅</span> Approved
          </button>
          <button
            className={`admin-nav-item ${filter === "rejected" ? "active" : ""}`}
            onClick={() => setFilter("rejected")}
          >
            <span>❌</span> Rejected
          </button>
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-officer-info">
            <div className="admin-officer-avatar">
              {officer?.name?.[0]?.toUpperCase() || "A"}
            </div>
            <div>
              <div className="admin-officer-name">{officer?.name}</div>
              <div className="admin-officer-role">Super Admin</div>
            </div>
          </div>
          <button className="admin-logout" onClick={() => { logout(); navigate("/"); }}>
            Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="admin-main">
        {/* Header */}
        <div className="admin-header">
          <div>
            <h1 className="admin-title">Officer Management</h1>
            <p className="admin-subtitle">Review and manage officer access requests</p>
          </div>
        </div>

        {/* Summary cards */}
        {summary && (
          <div className="admin-summary">
            {[
              { label: "Total Officers", val: summary.total,    icon: "👮", color: "#1a56db" },
              { label: "Pending",        val: summary.pending,  icon: "⏳", color: "#d97706" },
              { label: "Approved",       val: summary.approved, icon: "✅", color: "#16a34a" },
              { label: "Rejected",       val: summary.rejected, icon: "❌", color: "#dc2626" },
            ].map((c) => (
              <div className="admin-sum-card" key={c.label}
                style={{ borderTopColor: c.color }}>
                <div className="admin-sum-icon">{c.icon}</div>
                <div className="admin-sum-val" style={{ color: c.color }}>{c.val}</div>
                <div className="admin-sum-label">{c.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Officers table */}
        <div className="admin-table-card">
          <div className="admin-table-header">
            <span className="admin-table-title">
              {filter.charAt(0).toUpperCase() + filter.slice(1)} Officers
            </span>
            <span className="admin-table-count">{officers.length} records</span>
          </div>

          {loading ? (
            <div className="admin-loading">
              <div className="loader-spinner"/>
            </div>
          ) : officers.length === 0 ? (
            <div className="admin-empty">
              No {filter} officers found.
            </div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Officer</th>
                    <th>Badge</th>
                    <th>Rank</th>
                    <th>Station</th>
                    <th>Phone</th>
                    <th>Registered</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {officers.map((o) => {
                    const meta = STATUS_META[o.status] || STATUS_META.pending;
                    return (
                      <tr key={o.id}>
                        <td>
                          <div className="admin-officer-cell">
                            <div className="admin-cell-avatar">
                              {o.name[0].toUpperCase()}
                            </div>
                            <div>
                              <div className="admin-cell-name">{o.name}</div>
                              <div className="admin-cell-email">{o.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="admin-cell-mono">{o.badge_number || "—"}</td>
                        <td>{o.rank || "—"}</td>
                        <td>{o.station || "—"}</td>
                        <td>{o.phone || "—"}</td>
                        <td className="admin-cell-date">
                          {o.created_at ? new Date(o.created_at).toLocaleDateString("en-IN") : "—"}
                        </td>
                        <td>
                          <span className="admin-status-badge"
                            style={{ color: meta.color, background: meta.bg, border: `1px solid ${meta.border}` }}>
                            {meta.label}
                          </span>
                        </td>
                        <td>
                          <div className="admin-actions">
                            {o.status === "pending" && (
                              <>
                                <button
                                  className="admin-btn admin-btn-approve"
                                  onClick={() => approve(o.id, o.name)}
                                  disabled={actionLoading === o.id}
                                >
                                  {actionLoading === o.id ? "..." : "Approve"}
                                </button>
                                <button
                                  className="admin-btn admin-btn-reject"
                                  onClick={() => reject(o.id, o.name)}
                                  disabled={actionLoading === o.id}
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            {o.status === "approved" && (
                              <button
                                className="admin-btn admin-btn-reject"
                                onClick={() => reject(o.id, o.name)}
                                disabled={actionLoading === o.id}
                              >
                                Revoke
                              </button>
                            )}
                            {o.status === "rejected" && (
                              <button
                                className="admin-btn admin-btn-approve"
                                onClick={() => approve(o.id, o.name)}
                                disabled={actionLoading === o.id}
                              >
                                Re-approve
                              </button>
                            )}
                            <button
                              className="admin-btn admin-btn-delete"
                              onClick={() => deleteOfficer(o.id, o.name)}
                              disabled={actionLoading === o.id}
                            >
                              Delete
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
      </main>
    </div>
  );
}
