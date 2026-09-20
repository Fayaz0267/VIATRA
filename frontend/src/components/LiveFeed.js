import React, { useRef, useEffect, useState, useCallback } from "react";

const WS_URL = (process.env.REACT_APP_WS_URL || "ws://localhost:8000")
  .replace("http://","ws://").replace("https://","wss://");
const FPS = 6;

export default function LiveFeed({ onViolation, onConnectionChange }) {
  const videoRef     = useRef(null);
  const canvasRef    = useRef(null);
  const wsRef        = useRef(null);
  const intervalRef  = useRef(null);
  const fileInputRef = useRef(null);
  const reconnectRef = useRef(null);
  const mountedRef   = useRef(true);
  const sendingRef   = useRef(false); // ← controls frame sending

  const [mode, setMode]             = useState("idle");
  const [annotatedSrc, setAnnot]    = useState(null);
  const [lastAlert, setLastAlert]   = useState(null);
  const [frameStats, setFrameStats] = useState({ persons:0, motorcycles:0 });
  const [wsStatus, setWsStatus]     = useState("connecting");
  const [debugMsg, setDebugMsg]     = useState("Connecting to VIATRA...");
  const [retryCount, setRetryCount] = useState(0);

  // ── Auto-connect WebSocket on mount ──────────
  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setWsStatus("connecting");
    setDebugMsg("Connecting to VIATRA backend...");

    try {
      const ws = new WebSocket(`${WS_URL}/api/video/ws/stream`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        setWsStatus("connected");
        setDebugMsg("✅ Backend connected — ready to detect");
        setRetryCount(0);
        onConnectionChange(true);
        if (reconnectRef.current) clearTimeout(reconnectRef.current);
      };

      ws.onmessage = (e) => {
        if (!mountedRef.current) return;
        try {
          const data = JSON.parse(e.data);
          if (data.frame) setAnnot(`data:image/jpeg;base64,${data.frame}`);
          if (data.stats) {
            setFrameStats(data.stats);
            setDebugMsg(`✅ Detecting... 👤${data.stats.persons} · 🏍️${data.stats.motorcycles}`);
          }
          if (data.violation) {
            setLastAlert(data.violation);
            onViolation(data.violation);
            setTimeout(() => setLastAlert(null), 4000);
          }
        } catch {}
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setWsStatus("disconnected");
        onConnectionChange(false);
        setRetryCount(prev => {
          const next  = prev + 1;
          const delay = Math.min(2000 * next, 10000);
          setDebugMsg(`Reconnecting in ${delay/1000}s...`);
          reconnectRef.current = setTimeout(() => {
            if (mountedRef.current) connect();
          }, delay);
          return next;
        });
      };

      ws.onerror = () => {
        setWsStatus("error");
        setDebugMsg("⚠️ Cannot reach backend...");
      };
    } catch (err) {
      reconnectRef.current = setTimeout(() => {
        if (mountedRef.current) connect();
      }, 3000);
    }
  }, [onConnectionChange, onViolation]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      sendingRef.current = false;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (intervalRef.current)  clearInterval(intervalRef.current);
      if (wsRef.current)        wsRef.current.close();
      if (videoRef.current?.srcObject)
        videoRef.current.srcObject.getTracks().forEach(t => t.stop());
    };
  }, []);

  // ── Frame sender ──────────────────────────────
  const startSendingFrames = useCallback((videoEl) => {
    clearInterval(intervalRef.current);
    sendingRef.current = true;
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext("2d");

    intervalRef.current = setInterval(() => {
      // ← STOP if sendingRef is false (video stopped)
      if (!sendingRef.current) return;
      if (!videoEl || videoEl.paused || videoEl.ended) return;
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

      canvas.width  = Math.min(videoEl.videoWidth  || 640, 1280);
      canvas.height = Math.min(videoEl.videoHeight || 480, 720);
      try {
        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (!blob || !sendingRef.current) return;
          const reader = new FileReader();
          reader.onloadend = () => {
            if (sendingRef.current && wsRef.current?.readyState === WebSocket.OPEN)
              wsRef.current.send(JSON.stringify({ frame: reader.result.split(",")[1] }));
          };
          reader.readAsDataURL(blob);
        }, "image/jpeg", 0.65);
      } catch {}
    }, 1000 / FPS);
  }, []);

  // ── Webcam ────────────────────────────────────
  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setMode("webcam");
      setDebugMsg("📷 Webcam active — detecting...");
      startSendingFrames(videoRef.current);
    } catch (err) {
      setDebugMsg(`❌ Camera: ${err.message}`);
    }
  };

  // ── Video upload ──────────────────────────────
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url   = URL.createObjectURL(file);
    const video = videoRef.current;
    video.src   = url;
    video.load();
    setDebugMsg("📂 Loading video...");

    video.oncanplay = () => {
      video.play();
      setMode("playing");
      setDebugMsg("📂 Sending frames to VIATRA AI...");
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        startSendingFrames(video);
      } else {
        const check = setInterval(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            clearInterval(check);
            startSendingFrames(video);
          }
        }, 300);
        setTimeout(() => clearInterval(check), 10000);
      }
    };
    video.onerror = () => setDebugMsg("❌ Video error — try MP4");
  };

  // ── STOP — properly stops everything ─────────
  const stopAll = useCallback(() => {
    // 1. Kill frame sending immediately
    sendingRef.current = false;
    clearInterval(intervalRef.current);
    intervalRef.current = null;

    // 2. Stop webcam
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }

    // 3. Stop video file playback
    if (videoRef.current) {
      videoRef.current.pause();
      try {
        videoRef.current.src = "";
        videoRef.current.removeAttribute("src");
        videoRef.current.load();
      } catch(e) {}
    }

    // 4. Reset UI
    setAnnot(null);
    setMode("idle");
    setFrameStats({ persons:0, motorcycles:0 });
    setDebugMsg("✅ Stopped — backend still connected");
  }, []);

  const alertColors = {
    no_helmet:      { bg:"#fef2f2", border:"#dc2626", color:"#991b1b", label:"⛑️ NO HELMET"      },
    triple_riding:  { bg:"#fff7ed", border:"#f97316", color:"#c2410c", label:"🏍️ TRIPLE RIDING"  },
    signal_jumping: { bg:"#f5f3ff", border:"#7c3aed", color:"#5b21b6", label:"🚦 SIGNAL JUMPING" },
    lane_violation: { bg:"#e0f2fe", border:"#0369a1", color:"#075985", label:"🛣️ LANE VIOLATION"  },
    wrong_way:      { bg:"#fdf2f8", border:"#be185d", color:"#9d174d", label:"⛔ WRONG WAY"       },
    overspeeding:   { bg:"#fffbeb", border:"#b45309", color:"#92400e", label:"⚡ OVERSPEEDING"    },
    both:           { bg:"#fdf4ff", border:"#9333ea", color:"#7e22ce", label:"⚠️ MULTIPLE VIOLATIONS" },
  };

  const sc = {
    connected:    { bg:"#f0fdf4", color:"#16a34a", border:"#bbf7d0", dot:"#16a34a" },
    connecting:   { bg:"#fffbeb", color:"#d97706", border:"#fde68a", dot:"#d97706" },
    disconnected: { bg:"#f8fafc", color:"#94a3b8", border:"#e2e8f0", dot:"#94a3b8" },
    error:        { bg:"#fef2f2", color:"#dc2626", border:"#fecaca", dot:"#dc2626" },
  }[wsStatus] || { bg:"#f8fafc", color:"#94a3b8", border:"#e2e8f0", dot:"#94a3b8" };

  return (
    <div className="live-feed">
      <div className="feed-header">
        <div className="feed-title-row">
          <span className="feed-title">📹 Live CCTV Feed</span>
          <span className="feed-ws-badge" style={{
            background:sc.bg, color:sc.color, border:`1px solid ${sc.border}`
          }}>
            <span style={{
              display:"inline-block", width:7, height:7, borderRadius:"50%",
              background:sc.dot, marginRight:5,
              animation: wsStatus==="connected" ? "dotPulse 1.2s ease-in-out infinite" : "none"
            }}/>
            {wsStatus==="connected"?"CONNECTED":wsStatus==="connecting"?"CONNECTING...":wsStatus==="error"?"ERROR":"OFFLINE"}
          </span>
        </div>
        <div className="feed-meta">
          <span className="feed-meta-item">👤 <span className="feed-meta-val">{frameStats.persons}</span></span>
          <span className="feed-meta-item">🏍️ <span className="feed-meta-val">{frameStats.motorcycles}</span></span>
        </div>
      </div>

      <div className="feed-display">
        {annotatedSrc ? (
          <img src={annotatedSrc} alt="live feed" className="feed-img"/>
        ) : (
          <div className="feed-placeholder">
            <div className="viatra-logo-anim">🛡️</div>
            <p style={{fontWeight:600, marginBottom:6, color:"#fff"}}>VIATRA Detection Engine</p>
            <p className="placeholder-hint">Upload video or connect camera to begin</p>
            {wsStatus==="connected" && (
              <p style={{color:"#4ade80",fontSize:12,marginTop:8}}>
                ✅ Backend ready
              </p>
            )}
          </div>
        )}

        {lastAlert && (() => {
          const m = alertColors[lastAlert.type] || alertColors.no_helmet;
          return (
            <div className="violation-alert"
              style={{background:m.bg, border:`2px solid ${m.border}`, color:m.color}}>
              {m.label}
              {lastAlert.plate_number && ` · 🪪 ${lastAlert.plate_number}`}
              {lastAlert.rider_count>1 && ` · ${lastAlert.rider_count} riders`}
              {lastAlert.speed_kmh && ` · ${lastAlert.speed_kmh}km/h`}
            </div>
          );
        })()}

        <div className="feed-corner feed-corner-tl"/>
        <div className="feed-corner feed-corner-br"/>
      </div>

      <div className="feed-debug" style={{
        background: wsStatus==="connected" ? "#f0fdf4" : "#fffbeb",
        borderColor: wsStatus==="connected" ? "#bbf7d0" : "#fde68a",
        color: wsStatus==="connected" ? "#166534" : "#92400e",
      }}>
        <span>{debugMsg}</span>
        {wsStatus!=="connected" && (
          <button onClick={connect} style={{
            marginLeft:"auto", fontSize:11, padding:"2px 10px",
            background:"#1a56db", color:"#fff", border:"none",
            borderRadius:6, cursor:"pointer"
          }}>Reconnect</button>
        )}
      </div>

      <div className="feed-controls">
        {mode==="idle" ? (
          <>
            <button className="btn btn-primary" onClick={startWebcam}
              disabled={wsStatus!=="connected"}>📷 Webcam</button>
            <button className="btn btn-secondary"
              onClick={() => fileInputRef.current.click()}>📂 Upload Video</button>
            <input ref={fileInputRef} type="file"
              accept="video/mp4,video/*" style={{display:"none"}}
              onChange={handleFileUpload}/>
          </>
        ) : (
          <>
            <button className="btn btn-danger" onClick={stopAll}>⏹ Stop</button>
            <span className="feed-mode-label">
              {mode==="webcam" ? "📷 Webcam active" : "📂 Video playing"}
            </span>
          </>
        )}
      </div>

      <video ref={videoRef} style={{display:"none"}} muted playsInline crossOrigin="anonymous"/>
      <canvas ref={canvasRef} style={{display:"none"}}/>
    </div>
  );
}
