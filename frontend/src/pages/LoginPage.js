import React, { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const API = process.env.REACT_APP_API_URL || "http://localhost:8000";

// Simple math captcha
function generateCaptcha() {
  const a = Math.floor(Math.random() * 9) + 1;
  const b = Math.floor(Math.random() * 9) + 1;
  return { question: `${a} + ${b} = ?`, answer: String(a + b) };
}

export default function LoginPage() {
  const [loginType, setLoginType] = useState(null); // null | "public" | "officer"
  const { login } = useAuth();
  const navigate   = useNavigate();
  const [backendOk, setBackendOk] = useState(null);
  const layer1 = useRef(null);
  const layer2 = useRef(null);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${API}/api/public/health`,
          { signal: AbortSignal.timeout(3000) });
        setBackendOk(res.ok);
      } catch { setBackendOk(false); }
    };
    check();
    const i = setInterval(check, 10000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    const fn = () => {
      const y = window.scrollY;
      if (layer1.current) layer1.current.style.transform = `translateY(${y*.4}px)`;
      if (layer2.current) layer2.current.style.transform = `translateY(${y*.2}px)`;
    };
    window.addEventListener("scroll", fn, { passive:true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <div className="auth-page">
      <div className="auth-bg"/>
      <div className="auth-layer1" ref={layer1}/>
      <div className="auth-layer2" ref={layer2}/>
      <div className="auth-grid"/>
      <div className="auth-orb auth-orb1"/>
      <div className="auth-orb auth-orb2"/>

      {/* Navbar */}
      <nav className="auth-nav">
        <div className="auth-nav-brand">
          <div className="auth-nav-icon">🛡️</div>
          <div>
            <div className="auth-nav-title">VIATRA</div>
            <div className="auth-nav-sub">Violation Intelligence And Traffic Real-time Analysis</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{
            display:"flex",alignItems:"center",gap:6,padding:"5px 12px",
            borderRadius:20,fontSize:11,
            background:backendOk?"rgba(74,222,128,0.15)":"rgba(239,68,68,0.15)",
            border:`1px solid ${backendOk?"rgba(74,222,128,0.4)":"rgba(239,68,68,0.4)"}`,
            color:backendOk?"#4ade80":"#f87171"
          }}>
            <span style={{width:7,height:7,borderRadius:"50%",display:"inline-block",
              background:backendOk?"#4ade80":"#f87171",
              animation:backendOk?"dotPulse 1.5s ease-in-out infinite":"none"}}/>
            {backendOk===null?"Checking...":backendOk?"Server Online":"Server Offline"}
          </div>
          <div className="auth-nav-badge">🇮🇳 Hyderabad Traffic Police</div>
        </div>
      </nav>

      <div className="auth-center">
        {/* Left hero */}
        <div className="auth-hero">
          <div className="auth-hero-badge">
            <span className="auth-hero-dot"/>
            <span>AI-Powered · Real-Time · 24/7 Monitoring</span>
          </div>
          <h1 className="auth-hero-title">
            <span style={{color:"#fff"}}>Intelligent</span><br/>
            <span className="auth-hero-accent">Traffic Enforcement</span>
          </h1>
          <p className="auth-hero-desc">
            VIATRA uses YOLO11 + ByteTrack + Plate Recognizer to detect
            traffic violations automatically — no helmet, triple riding,
            signal jumping and more. Official AI-powered challans in Telugu.
          </p>
          <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:28}}>
            {["⛑️ No Helmet","🏍️ Triple Riding","🚦 Signal Jump",
              "🛣️ Lane Violation","⛔ Wrong Way","⚡ Overspeeding"].map(v=>(
              <span key={v} style={{
                background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.18)",
                borderRadius:20,padding:"4px 12px",fontSize:11,
                color:"rgba(255,255,255,0.85)",display:"flex",alignItems:"center",gap:5
              }}>{v}</span>
            ))}
          </div>
          <div className="auth-hero-stats">
            {[{val:"YOLO11",label:"AI Model"},{val:"97%",label:"Accuracy"},
              {val:"Any Angle",label:"Camera"},{val:"Auto",label:"Challan"}].map(s=>(
              <div className="auth-hero-stat" key={s.label}>
                <div className="auth-hero-stat-val">{s.val}</div>
                <div className="auth-hero-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — login selector or form */}
        <div className="glass-card">
          {!loginType ? (
            <LoginSelector
              onSelect={setLoginType}
              backendOk={backendOk}
            />
          ) : loginType === "public" ? (
            <PublicLogin onBack={() => setLoginType(null)} navigate={navigate}/>
          ) : (
            <OfficerLogin
              onBack={() => setLoginType(null)}
              login={login}
              navigate={navigate}
              backendOk={backendOk}
            />
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="auth-footer-bar">
        {[
          {icon:"🎯",val:"YOLO11",label:"Detection"},
          {icon:"🔄",val:"ByteTrack",label:"Tracking"},
          {icon:"🧠",val:"MediaPipe",label:"Pose"},
          {icon:"📋",val:"Plate API",label:"Plate Read"},
          {icon:"🤖",val:"Gemini AI",label:"Challan"},
        ].map(s=>(
          <div className="auth-footer-stat" key={s.label}>
            <span>{s.icon}</span><strong>{s.val}</strong><span>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Login Type Selector ───────────────────────────
function LoginSelector({ onSelect, backendOk }) {
  return (
    <div style={{textAlign:"center"}}>
      <div className="glass-card-header">
        <div className="glass-card-icon">🛡️</div>
        <h2 className="glass-card-title">Welcome to VIATRA</h2>
        <p className="glass-card-sub">Hyderabad Traffic Police · Official Portal</p>
      </div>

      <p style={{color:"rgba(255,255,255,0.7)",fontSize:13,marginBottom:28,
        padding:"0 10px",lineHeight:1.6}}>
        Select how you want to access the portal
      </p>

      <div style={{display:"flex",flexDirection:"column",gap:14,padding:"0 8px 20px"}}>
        {/* Public login */}
        <button onClick={() => onSelect("public")} className="login-type-btn login-type-public">
          <div className="login-type-icon">🚗</div>
          <div className="login-type-text">
            <div className="login-type-title">Public / Citizen Login</div>
            <div className="login-type-sub">Check your vehicle challans, contest violations, report incidents</div>
          </div>
          <div className="login-type-arrow">→</div>
        </button>

        {/* Officer login */}
        <button onClick={() => onSelect("officer")} className="login-type-btn login-type-officer"
          disabled={backendOk===false}>
          <div className="login-type-icon">👮</div>
          <div className="login-type-text">
            <div className="login-type-title">Traffic Officer Login</div>
            <div className="login-type-sub">Access live monitoring dashboard, manage challans, analytics</div>
          </div>
          <div className="login-type-arrow">→</div>
        </button>
      </div>

      <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",padding:"0 0 8px"}}>
        🔒 Secured by Telangana Traffic Police · VIATRA v5.0
      </div>
    </div>
  );
}

// ── Public Login ──────────────────────────────────
function PublicLogin({ onBack, navigate }) {
  const [vehicleNo, setVehicleNo]   = useState("");
  const [captcha, setCaptcha]       = useState(generateCaptcha);
  const [captchaAns, setCaptchaAns] = useState("");
  const [error, setError]           = useState("");
  const [loading, setLoading]       = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    setError("");

    if (captchaAns.trim() !== captcha.answer) {
      setCaptcha(generateCaptcha());
      setCaptchaAns("");
      setError("❌ Incorrect captcha answer. Please try again.");
      return;
    }

    const clean = vehicleNo.toUpperCase().replace(/[^A-Z0-9]/g,"");
    if (clean.length < 4) {
      setError("Please enter at least 4 characters of your vehicle number");
      return;
    }

    setLoading(true);
    try {
      navigate(`/public/challan?plate=${clean}`);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="glass-card-header">
        <button onClick={onBack} className="back-btn">← Back</button>
        <div className="glass-card-icon">🚗</div>
        <h2 className="glass-card-title">Citizen Portal</h2>
        <p className="glass-card-sub">Check your vehicle challans instantly</p>
      </div>

      {error && <div className="auth-error"><span>⚠️</span> {error}</div>}

      <form onSubmit={handleSearch} className="auth-form">
        <div className="auth-field">
          <label className="auth-label">Vehicle Registration Number</label>
          <div className="auth-input-wrap">
            <span className="auth-input-icon">🚗</span>
            <input className="auth-input"
              placeholder="e.g. TS09AB1234 or MH12DE1234"
              value={vehicleNo}
              onChange={e => setVehicleNo(e.target.value.toUpperCase())}
              maxLength={15}
              required/>
          </div>
          <span style={{fontSize:10,color:"rgba(255,255,255,0.4)",marginTop:3}}>
            Enter your full or partial vehicle number
          </span>
        </div>

        {/* Captcha */}
        <div className="auth-field">
          <label className="auth-label">Security Check</label>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <div style={{
              background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.2)",
              borderRadius:8,padding:"10px 18px",fontSize:18,fontWeight:700,
              color:"#fbbf24",letterSpacing:4,fontFamily:"monospace",whiteSpace:"nowrap"
            }}>
              {captcha.question}
            </div>
            <div className="auth-input-wrap" style={{flex:1}}>
              <input className="auth-input" placeholder="Your answer"
                value={captchaAns}
                onChange={e => setCaptchaAns(e.target.value)}
                maxLength={3} required/>
            </div>
            <button type="button" onClick={() => { setCaptcha(generateCaptcha()); setCaptchaAns(""); }}
              style={{background:"none",border:"1px solid rgba(255,255,255,0.2)",
                borderRadius:8,padding:"10px 12px",color:"rgba(255,255,255,0.6)",
                cursor:"pointer",fontSize:14}}>🔄</button>
          </div>
        </div>

        <button type="submit" className="auth-submit" disabled={loading}>
          {loading ? "🔍 Searching..." : "🔍 Search Challans →"}
        </button>
      </form>

      <div style={{
        marginTop:16,padding:"12px 16px",
        background:"rgba(59,130,246,0.12)",
        border:"1px solid rgba(59,130,246,0.25)",
        borderRadius:10,fontSize:11,
        color:"rgba(255,255,255,0.6)",lineHeight:1.7
      }}>
        🔒 <strong style={{color:"rgba(255,255,255,0.8)"}}>Your data is secure.</strong><br/>
        We only show challans linked to your vehicle number.<br/>
        Payment via official <span style={{color:"#60a5fa"}}>echallan.tspolice.gov.in</span>
      </div>
    </div>
  );
}

// ── Officer Login ─────────────────────────────────
function OfficerLogin({ onBack, login, navigate, backendOk }) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const officer = await login(email, password);
      if (officer.role === "admin")           navigate("/admin");
      else if (officer.status === "approved") navigate("/dashboard");
      else                                    navigate("/pending");
    } catch (err) {
      const msg = err.message || "";
      if (msg.includes("Cannot connect")) setError("❌ Backend offline. Start the server first.");
      else if (msg.includes("PENDING"))   setError("⏳ Account awaiting admin approval.");
      else if (msg.includes("REJECTED"))  setError("❌ Account rejected. Contact admin.");
      else setError(msg || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="glass-card-header">
        <button onClick={onBack} className="back-btn">← Back</button>
        <div className="glass-card-icon">👮</div>
        <h2 className="glass-card-title">Officer Login</h2>
        <p className="glass-card-sub">VIATRA · Hyderabad Traffic Police</p>
      </div>

      {backendOk === false && (
        <div className="auth-error" style={{marginBottom:12}}>
          🔴 <strong>Backend offline.</strong> Run: <code>uvicorn app.main:app --reload --port 8000</code>
        </div>
      )}
      {error && <div className="auth-error"><span>⚠️</span> {error}</div>}

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="auth-field">
          <label className="auth-label">Email Address</label>
          <div className="auth-input-wrap">
            <span className="auth-input-icon">✉</span>
            <input type="email" className="auth-input"
              placeholder="officer@viatra.gov.in"
              value={email} onChange={e => setEmail(e.target.value)} required/>
          </div>
        </div>
        <div className="auth-field">
          <label className="auth-label">Password</label>
          <div className="auth-input-wrap">
            <span className="auth-input-icon">🔒</span>
            <input type={showPass?"text":"password"} className="auth-input"
              placeholder="Enter your password"
              value={password} onChange={e => setPassword(e.target.value)} required/>
            <button type="button" className="auth-eye"
              onClick={() => setShowPass(!showPass)}>
              {showPass?"🙈":"👁"}
            </button>
          </div>
        </div>
        <button type="submit" className="auth-submit"
          disabled={loading || backendOk===false}>
          {loading ? <span className="auth-submit-loading"><span className="btn-spinner"/> Signing in...</span>
            : "Sign In →"}
        </button>
      </form>

      <div className="auth-divider"><span>New officer?</span></div>
      <Link to="/register" className="auth-register-btn">Request Access</Link>
      <div className="auth-admin-hint">
        <span>🛡️</span>
        <span>Admin: admin@viatra.gov.in / Admin@1234</span>
      </div>
    </div>
  );
}
