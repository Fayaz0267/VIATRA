import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function PendingPage() {
  const { officer, logout } = useAuth();
  const navigate            = useNavigate();

  const handleLogout = () => { logout(); navigate("/"); };

  return (
    <div className="auth-page">
      <div className="auth-bg"/>
      <div className="auth-grid"/>
      <div className="auth-orb auth-orb1"/>
      <div className="auth-orb auth-orb2"/>

      <nav className="auth-nav">
        <div className="auth-nav-brand">
          <div className="auth-nav-icon">🛡️</div>
          <div>
            <div className="auth-nav-title">VIATRA</div>
            <div className="auth-nav-sub">Account Status</div>
          </div>
        </div>
        <button onClick={handleLogout} className="auth-nav-back">Logout</button>
      </nav>

      <div className="auth-center auth-center-single">
        <div className="glass-card pending-card">
          <div className="pending-icon-wrap">
            <div className="pending-pulse"/>
            <div className="pending-icon">⏳</div>
          </div>

          <h2 className="pending-title">Awaiting Approval</h2>
          <p className="pending-desc">
            Hello <strong>{officer?.name || "Officer"}</strong>, your registration
            has been submitted successfully. An admin will review your request shortly.
          </p>

          <div className="pending-details">
            <div className="pending-detail-row">
              <span className="pending-detail-label">Email</span>
              <span className="pending-detail-val">{officer?.email || "—"}</span>
            </div>
            <div className="pending-detail-row">
              <span className="pending-detail-label">Badge</span>
              <span className="pending-detail-val">{officer?.badge_number || "—"}</span>
            </div>
            <div className="pending-detail-row">
              <span className="pending-detail-label">Station</span>
              <span className="pending-detail-val">{officer?.station || "—"}</span>
            </div>
            <div className="pending-detail-row">
              <span className="pending-detail-label">Status</span>
              <span className="pending-status-badge">Pending Review</span>
            </div>
          </div>

          <div className="pending-steps">
            <div className="pending-step done">
              <div className="pending-step-dot">✓</div>
              <div>
                <div className="pending-step-title">Registration Submitted</div>
                <div className="pending-step-sub">Your details have been recorded</div>
              </div>
            </div>
            <div className="pending-step active">
              <div className="pending-step-dot pending-step-pulse">2</div>
              <div>
                <div className="pending-step-title">Admin Review</div>
                <div className="pending-step-sub">Waiting for admin approval</div>
              </div>
            </div>
            <div className="pending-step">
              <div className="pending-step-dot pending-step-inactive">3</div>
              <div>
                <div className="pending-step-title">Access Granted</div>
                <div className="pending-step-sub">You'll be notified on approval</div>
              </div>
            </div>
          </div>

          <button onClick={handleLogout} className="auth-submit" style={{ marginTop: "8px" }}>
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}
