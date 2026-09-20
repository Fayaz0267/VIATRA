import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const RANKS = ["Constable", "Head Constable", "ASI", "SI", "Inspector", "DSP", "SP", "SSP"];
const STATIONS = [
  "Hyderabad Central", "Cyberabad", "Rachakonda", "Secunderabad",
  "Kukatpally", "LB Nagar", "Uppal", "Miyapur", "KPHB", "Madhapur"
];

export default function RegisterPage() {
  const [form, setForm]       = useState({
    name: "", email: "", password: "", confirm: "",
    badge_number: "", rank: "", station: "", phone: ""
  });
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { register }          = useAuth();
  const navigate              = useNavigate();

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirm) {
      setError("Passwords do not match"); return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters"); return;
    }
    setLoading(true);
    try {
      await register({
        name:         form.name,
        email:        form.email,
        password:     form.password,
        badge_number: form.badge_number,
        rank:         form.rank,
        station:      form.station,
        phone:        form.phone,
      });
      setSuccess(true);
      setTimeout(() => navigate("/"), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) return (
    <div className="auth-page">
      <div className="auth-bg"/>
      <div className="auth-grid"/>
      <div className="auth-orb auth-orb1"/>
      <div className="auth-orb auth-orb2"/>
      <div className="success-card">
        <div className="success-icon">✅</div>
        <h2 className="success-title">Registration Successful!</h2>
        <p className="success-desc">
          Your request has been submitted. An admin will review
          and approve your account shortly.
        </p>
        <p className="success-redirect">Redirecting to login...</p>
      </div>
    </div>
  );

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
            <div className="auth-nav-sub">Officer Registration</div>
          </div>
        </div>
        <Link to="/" className="auth-nav-back">← Back to Login</Link>
      </nav>

      <div className="auth-center auth-center-single">
        <div className="glass-card glass-card-wide">
          <div className="glass-card-header">
            <div className="glass-card-icon">👮</div>
            <h2 className="glass-card-title">Officer Registration</h2>
            <p className="glass-card-sub">Submit your details for admin approval</p>
          </div>

          {error && <div className="auth-error"><span>⚠️</span> {error}</div>}

          <form onSubmit={handleSubmit} className="auth-form">
            {/* Row 1 */}
            <div className="auth-row">
              <div className="auth-field">
                <label className="auth-label">Full Name *</label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon">👤</span>
                  <input className="auth-input" placeholder="Ravi Kumar"
                    value={form.name} onChange={e => set("name", e.target.value)} required />
                </div>
              </div>
              <div className="auth-field">
                <label className="auth-label">Badge Number</label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon">🪪</span>
                  <input className="auth-input" placeholder="HYD-1234"
                    value={form.badge_number} onChange={e => set("badge_number", e.target.value)} />
                </div>
              </div>
            </div>

            {/* Row 2 */}
            <div className="auth-row">
              <div className="auth-field">
                <label className="auth-label">Rank</label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon">⭐</span>
                  <select className="auth-input auth-select"
                    value={form.rank} onChange={e => set("rank", e.target.value)}>
                    <option value="">Select rank</option>
                    {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div className="auth-field">
                <label className="auth-label">Station</label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon">🏢</span>
                  <select className="auth-input auth-select"
                    value={form.station} onChange={e => set("station", e.target.value)}>
                    <option value="">Select station</option>
                    {STATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Row 3 */}
            <div className="auth-row">
              <div className="auth-field">
                <label className="auth-label">Email Address *</label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon">✉</span>
                  <input type="email" className="auth-input" placeholder="officer@police.gov.in"
                    value={form.email} onChange={e => set("email", e.target.value)} required />
                </div>
              </div>
              <div className="auth-field">
                <label className="auth-label">Phone Number</label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon">📱</span>
                  <input className="auth-input" placeholder="+91 98765 43210"
                    value={form.phone} onChange={e => set("phone", e.target.value)} />
                </div>
              </div>
            </div>

            {/* Row 4 */}
            <div className="auth-row">
              <div className="auth-field">
                <label className="auth-label">Password *</label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon">🔒</span>
                  <input type="password" className="auth-input" placeholder="Min 6 characters"
                    value={form.password} onChange={e => set("password", e.target.value)} required />
                </div>
              </div>
              <div className="auth-field">
                <label className="auth-label">Confirm Password *</label>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon">🔒</span>
                  <input type="password" className="auth-input" placeholder="Re-enter password"
                    value={form.confirm} onChange={e => set("confirm", e.target.value)} required />
                </div>
              </div>
            </div>

            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? (
                <span className="auth-submit-loading">
                  <span className="btn-spinner"/> Submitting...
                </span>
              ) : "Submit Registration →"}
            </button>
          </form>

          <div className="auth-divider"><span>Already registered?</span></div>
          <Link to="/" className="auth-register-btn">Back to Login</Link>
        </div>
      </div>
    </div>
  );
}
