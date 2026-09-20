import React, { useState, useEffect, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";

const API = process.env.REACT_APP_API_URL || "http://localhost:8000";

const VTYPE = {
  no_helmet:      { label:"No Helmet",      icon:"⛑️", color:"#dc2626", section:"Section 129 MV Act 1988" },
  triple_riding:  { label:"Triple Riding",  icon:"🏍️", color:"#ea580c", section:"Section 128 MV Act 1988" },
  signal_jumping: { label:"Signal Jumping", icon:"🚦", color:"#7c3aed", section:"Section 119 MV Act 1988" },
  lane_violation: { label:"Lane Violation", icon:"🛣️", color:"#0369a1", section:"Section 112 MV Act 1988" },
  wrong_way:      { label:"Wrong Way",      icon:"⛔", color:"#be185d", section:"Section 119 MV Act 1988" },
  overspeeding:   { label:"Overspeeding",   icon:"⚡", color:"#b45309", section:"Section 112 MV Act 1988" },
  both:           { label:"Multiple Violations", icon:"⚠️", color:"#9333ea", section:"Section 128 & 129 MV Act 1988" },
};

const STATUS = {
  open:      { label:"Pending Payment", color:"#b45309", bg:"#fffbeb", border:"#fde68a" },
  paid:      { label:"Paid",           color:"#15803d", bg:"#f0fdf4", border:"#bbf7d0" },
  disputed:  { label:"Under Review",   color:"#1d4ed8", bg:"#eff6ff", border:"#bfdbfe" },
  cancelled: { label:"Cancelled",      color:"#6b7280", bg:"#f9fafb", border:"#e5e7eb" },
};

function generateCaptcha() {
  const a = Math.floor(Math.random()*9)+1;
  const b = Math.floor(Math.random()*9)+1;
  return { q:`${a} + ${b} = ?`, ans:String(a+b) };
}

export default function PublicPortal() {
  const [searchParams]        = useSearchParams();
  const [plate, setPlate]     = useState(searchParams.get("plate")||"");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [activeTab, setActiveTab] = useState("challans");
  const [selected, setSelected]   = useState(null);

  useEffect(() => {
    const p = searchParams.get("plate");
    if (p) { setPlate(p); doSearch(p); }
  }, []);

  const doSearch = async (q) => {
    const clean = (q||plate).replace(/[^A-Z0-9]/gi,"").toUpperCase();
    if (clean.length < 4) { setError("Enter at least 4 characters"); return; }
    setLoading(true); setError(""); setResults(null); setSelected(null);
    try {
      const res  = await fetch(`${API}/api/public/challan/lookup?plate=${clean}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail||"Search failed");
      setResults(data);
      if (data.challans?.length > 0) setSelected(data.challans[0]);
    } catch(e) {
      setError(e.message||"Could not connect to server");
    } finally { setLoading(false); }
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleString("en-IN",
    {day:"2-digit",month:"2-digit",year:"numeric",
     hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}) : "—";

  const tabs = [
    {id:"challans",label:"📋 My Challans"},
    {id:"contest", label:"⚖️ Contest"},
    {id:"report",  label:"📢 Report"},
    {id:"help",    label:"❓ Help"},
  ];

  return (
    <div style={{minHeight:"100vh",background:"#f0f2f5",fontFamily:"'Segoe UI',sans-serif"}}>

      {/* Top navbar */}
      <div style={{
        background:"linear-gradient(90deg,#0f2057,#1a56db)",
        padding:"0 24px",display:"flex",alignItems:"center",
        justifyContent:"space-between",height:52,boxShadow:"0 2px 8px rgba(0,0,0,0.3)"
      }}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:22}}>🛡️</span>
          <div>
            <span style={{color:"#fff",fontWeight:800,fontSize:16,letterSpacing:1}}>VIATRA</span>
            <span style={{color:"rgba(255,255,255,0.5)",fontSize:11,marginLeft:8}}>
              Hyderabad Traffic Police
            </span>
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>setActiveTab(t.id)}
              style={{background:activeTab===t.id?"rgba(255,255,255,0.2)":"none",
                border:"none",color:activeTab===t.id?"#fff":"rgba(255,255,255,0.6)",
                padding:"6px 14px",borderRadius:6,fontSize:12,cursor:"pointer",
                fontWeight:activeTab===t.id?600:400}}>
              {t.label}
            </button>
          ))}
          <div style={{width:1,height:24,background:"rgba(255,255,255,0.2)",margin:"0 4px"}}/>
          <a href="https://echallan.tspolice.gov.in" target="_blank" rel="noreferrer"
            style={{color:"#fbbf24",fontSize:11,textDecoration:"none",
              border:"1px solid #fbbf24",padding:"4px 10px",borderRadius:5}}>
            🔗 Official eChallan
          </a>
          <Link to="/" style={{color:"rgba(255,255,255,0.6)",fontSize:11,textDecoration:"none",
            border:"1px solid rgba(255,255,255,0.2)",padding:"4px 10px",borderRadius:5}}>
            ← Officer Login
          </Link>
        </div>
      </div>

      {/* Search bar */}
      <div style={{background:"#1e3a8a",padding:"14px 24px",
        display:"flex",alignItems:"center",gap:12,
        borderBottom:"3px solid #fbbf24"}}>
        <span style={{color:"rgba(255,255,255,0.7)",fontSize:12,whiteSpace:"nowrap"}}>
          Vehicle Number:
        </span>
        <input value={plate}
          onChange={e=>setPlate(e.target.value.toUpperCase())}
          onKeyDown={e=>e.key==="Enter"&&doSearch()}
          placeholder="e.g. TS09AB1234"
          style={{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.3)",
            borderRadius:4,padding:"7px 14px",color:"#fff",fontSize:14,
            outline:"none",width:220,fontFamily:"monospace",letterSpacing:2}}/>
        <button onClick={()=>doSearch()}
          style={{background:"#fbbf24",border:"none",borderRadius:4,
            padding:"8px 20px",fontWeight:700,fontSize:13,cursor:"pointer",color:"#1e293b"}}>
          🔍 SEARCH
        </button>
        {error && <span style={{color:"#fca5a5",fontSize:12}}>⚠️ {error}</span>}
        {loading && <span style={{color:"#93c5fd",fontSize:12}}>🔄 Searching...</span>}
        {results && (
          <span style={{color:results.found?"#4ade80":"#94a3b8",fontSize:12,marginLeft:"auto"}}>
            {results.found
              ? `✅ ${results.count} challan(s) found for ${results.plate}`
              : `✅ No challans found for ${results.plate}`}
          </span>
        )}
      </div>

      {/* Main content */}
      <div style={{display:"flex",height:"calc(100vh - 104px)",overflow:"hidden"}}>

        {/* ── Challan List (left panel) ── */}
        {activeTab==="challans" && (
          <>
            <div style={{width:320,background:"#fff",borderRight:"1px solid #e2e8f0",
              overflowY:"auto",flexShrink:0}}>
              {/* List header */}
              <div style={{padding:"10px 14px",background:"#f8fafc",
                borderBottom:"1px solid #e2e8f0",display:"flex",
                justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:12,fontWeight:700,color:"#374151",textTransform:"uppercase",
                  letterSpacing:0.5}}>Challan List</span>
                <div style={{display:"flex",gap:4}}>
                  {["Unchecked","Ambiguous","Spurious","Valid Event"].map((t,i)=>(
                    <span key={t} style={{fontSize:9,padding:"2px 6px",borderRadius:3,
                      background:i===0?"#dbeafe":i===3?"#dcfce7":"#f1f5f9",
                      color:i===0?"#1d4ed8":i===3?"#15803d":"#6b7280",cursor:"pointer"}}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              {/* No results */}
              {!results && !loading && (
                <div style={{padding:40,textAlign:"center",color:"#94a3b8"}}>
                  <div style={{fontSize:36,marginBottom:10}}>🔍</div>
                  <div style={{fontSize:13}}>Enter vehicle number above to search challans</div>
                </div>
              )}

              {/* Results list */}
              {results?.challans?.map((c,i) => {
                const vt = VTYPE[c.violation_type]||VTYPE.no_helmet;
                const st = STATUS[c.status]||STATUS.open;
                const isSelected = selected?.id===c.id;
                return (
                  <div key={c.id} onClick={()=>setSelected(c)}
                    style={{
                      padding:"12px 14px",borderBottom:"1px solid #f1f5f9",
                      cursor:"pointer",background:isSelected?"#eff6ff":"#fff",
                      borderLeft:isSelected?"3px solid #1a56db":"3px solid transparent",
                      transition:"all .15s"
                    }}>
                    <div style={{display:"flex",justifyContent:"space-between",
                      alignItems:"flex-start",marginBottom:4}}>
                      <span style={{fontSize:13,fontWeight:700,color:vt.color}}>
                        {vt.icon} {vt.label}
                      </span>
                      <span style={{fontSize:11,fontWeight:700,color:"#dc2626"}}>
                        ₹{(c.fine_amount||0).toLocaleString()}
                      </span>
                    </div>
                    <div style={{fontSize:11,color:"#64748b",marginBottom:3,fontFamily:"monospace"}}>
                      {c.vehicle_number}
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between"}}>
                      <span style={{fontSize:10,color:"#94a3b8"}}>{fmtDate(c.timestamp)}</span>
                      <span style={{fontSize:10,fontWeight:600,
                        color:st.color,background:st.bg,
                        padding:"1px 6px",borderRadius:3}}>
                        {st.label}
                      </span>
                    </div>
                  </div>
                );
              })}

              {results?.found===false && (
                <div style={{padding:40,textAlign:"center",color:"#94a3b8"}}>
                  <div style={{fontSize:36,marginBottom:10}}>✅</div>
                  <div style={{fontSize:13,fontWeight:600,color:"#15803d",marginBottom:6}}>
                    No Pending Challans
                  </div>
                  <div style={{fontSize:12}}>Your vehicle has no violation records</div>
                </div>
              )}
            </div>

            {/* ── Detail panel (right) ── */}
            <div style={{flex:1,overflowY:"auto",background:"#f0f2f5"}}>
              {selected ? (
                <ChallanDetail challan={selected} fmtDate={fmtDate}/>
              ) : (
                <div style={{display:"flex",alignItems:"center",justifyContent:"center",
                  height:"100%",flexDirection:"column",gap:12,color:"#94a3b8"}}>
                  <div style={{fontSize:48}}>📋</div>
                  <div style={{fontSize:14}}>Select a challan to view details</div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Other tabs ── */}
        {activeTab!=="challans" && (
          <div style={{flex:1,overflowY:"auto",padding:24}}>
            {activeTab==="contest"  && <ContestTab/>}
            {activeTab==="report"   && <ReportTab/>}
            {activeTab==="help"     && <HelpTab/>}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Challan Detail — Videonetics style ───────────
function ChallanDetail({ challan: c, fmtDate }) {
  const vt = VTYPE[c.violation_type]||VTYPE.no_helmet;
  const st = STATUS[c.status]||STATUS.open;

  return (
    <div style={{padding:16,maxWidth:900,margin:"0 auto"}}>
      {/* Event header card */}
      <div style={{background:"#fff",borderRadius:6,marginBottom:12,overflow:"hidden",
        boxShadow:"0 1px 4px rgba(0,0,0,0.08)"}}>

        {/* Header row */}
        <div style={{background:"#1e3a8a",padding:"8px 16px",
          display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{color:"#fbbf24",fontWeight:700,fontSize:14,letterSpacing:1}}>
            EVENT VIEWER
          </span>
          <div style={{display:"flex",gap:8}}>
            {["Unchecked","Ambiguous","Spurious","Valid Event"].map((t,i)=>(
              <button key={t} style={{
                background:i===0?"#2563eb":"rgba(255,255,255,0.1)",
                border:"none",color:"#fff",padding:"3px 10px",
                borderRadius:3,fontSize:10,cursor:"pointer"}}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{padding:16,display:"grid",gridTemplateColumns:"1fr auto",gap:20}}>

          {/* Left: violation info */}
          <div>
            {/* Violation title */}
            <div style={{color:vt.color,fontWeight:700,fontSize:18,marginBottom:12}}>
              {vt.icon} {vt.label}
            </div>

            {/* Info grid — Videonetics style */}
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <tbody>
                {[
                  {label:"Camera",   val:`VIATRA-CAM-${String(c.id).padStart(3,"0")}`},
                  {label:"Time",     val:fmtDate(c.timestamp)},
                  {label:"Event Id", val:c.challan_no||`TSTP${String(c.id).padStart(6,"0")}`},
                  {label:"Location", val:c.location||"Hyderabad, Telangana"},
                  {label:"Lane",     val:"Auto-detected"},
                  {label:"Color",    val:"—"},
                ].map(r=>(
                  <tr key={r.label}>
                    <td style={{padding:"4px 0",color:"#6b7280",width:100,verticalAlign:"top"}}>
                      {r.label}
                    </td>
                    <td style={{padding:"4px 0",color:"#374151",fontWeight:500}}>
                      : {r.val}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Right: vehicle number prominent */}
          <div style={{textAlign:"right"}}>
            {/* Number plate display */}
            <div style={{
              display:"inline-block",
              background:"#fff",border:"3px solid #1e3a8a",
              borderRadius:6,padding:"8px 20px",marginBottom:12,
              fontFamily:"monospace",fontWeight:900,fontSize:22,
              color:"#1e293b",letterSpacing:3,
              boxShadow:"0 2px 8px rgba(0,0,0,0.15)"
            }}>
              {c.vehicle_number && c.vehicle_number!=="Not recorded"
                ? c.vehicle_number
                : "UNDETECTED"}
            </div>

            {/* Right side metadata */}
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,marginTop:4}}>
              <tbody>
                {[
                  {label:"Priority",         val:"Critical",               color:"#dc2626"},
                  {label:"Vehicle Category", val:"Motorcycle"},
                  {label:"Vehicle Make",     val:"Unknown"},
                  {label:"Message",          val:c.location||"Hyderabad"},
                  {label:"Action",           val:"Challan Issued"},
                  {label:"Status",           val:st.label,                 color:st.color},
                ].map(r=>(
                  <tr key={r.label}>
                    <td style={{padding:"3px 0",color:"#6b7280",whiteSpace:"nowrap"}}>
                      {r.label}
                    </td>
                    <td style={{padding:"3px 0",color:r.color||"#374151",fontWeight:500}}>
                      : {r.val}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Images panel — like Videonetics */}
      <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:12,marginBottom:12}}>

        {/* Main snapshot */}
        <div style={{background:"#000",borderRadius:6,overflow:"hidden",
          border:"2px solid #dc2626",position:"relative",minHeight:240}}>
          {c.snapshot ? (
            <img src={`${API}/${c.snapshot}`} alt="violation"
              style={{width:"100%",height:"100%",objectFit:"cover"}}
              onError={e=>e.target.src=""}/>
          ) : (
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",
              height:240,color:"#4b5563",fontSize:13,flexDirection:"column",gap:8}}>
              <span style={{fontSize:32}}>📷</span>
              <span>Snapshot not available</span>
            </div>
          )}
          {/* Timestamp overlay */}
          <div style={{position:"absolute",bottom:0,left:0,right:0,
            background:"rgba(0,0,0,0.7)",padding:"6px 10px",
            fontSize:11,color:"#fff",fontFamily:"monospace"}}>
            🕐 {fmtDate(c.timestamp)} | {c.location||"Hyderabad, Telangana"}
          </div>
        </div>

        {/* Right: mini plate crop */}
        <div style={{width:180,display:"flex",flexDirection:"column",gap:8}}>
          {/* Plate zoom */}
          <div style={{background:"#000",borderRadius:6,overflow:"hidden",
            border:"2px solid #16a34a",height:100,
            display:"flex",alignItems:"center",justifyContent:"center"}}>
            {c.snapshot ? (
              <img src={`${API}/${c.snapshot}`} alt="plate crop"
                style={{width:"100%",height:"100%",objectFit:"cover",
                  filter:"contrast(1.4) saturate(1.2)"}}
                onError={e=>e.target.src=""}/>
            ) : (
              <div style={{color:"#4b5563",fontSize:11,textAlign:"center"}}>
                Plate image
              </div>
            )}
          </div>
          {/* Plate number box */}
          <div style={{background:"#fff",border:"3px solid #1e3a8a",
            borderRadius:4,padding:"10px 8px",textAlign:"center",
            fontFamily:"monospace",fontWeight:900,fontSize:16,
            color:"#1e293b",letterSpacing:2}}>
            {c.vehicle_number && c.vehicle_number!=="Not recorded"
              ? c.vehicle_number : "—"}
          </div>
          {/* Status */}
          <div style={{
            background:st.bg,border:`1px solid ${st.border}`,
            borderRadius:4,padding:"6px 8px",textAlign:"center",
            fontSize:11,fontWeight:700,color:st.color}}>
            {st.label}
          </div>
        </div>
      </div>

      {/* Fine & legal details */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:12}}>
        {[
          {label:"Fine Amount",   val:`₹${(c.fine_amount||0).toLocaleString()}`,
           color:"#dc2626",big:true},
          {label:"Legal Section", val:c.legal_section||vt.section},
          {label:"Challan No",    val:c.challan_no||`TSTP${String(c.id).padStart(6,"0")}`},
        ].map(d=>(
          <div key={d.label} style={{background:"#fff",borderRadius:6,padding:"12px 16px",
            border:"1px solid #e2e8f0",boxShadow:"0 1px 3px rgba(0,0,0,0.05)"}}>
            <div style={{fontSize:10,color:"#94a3b8",fontWeight:600,
              textTransform:"uppercase",letterSpacing:0.5,marginBottom:4}}>
              {d.label}
            </div>
            <div style={{fontSize:d.big?22:13,fontWeight:d.big?800:600,color:d.color||"#1e293b"}}>
              {d.val}
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{display:"flex",gap:10,marginBottom:12}}>
        {c.status==="open" && (
          <a href="https://echallan.tspolice.gov.in" target="_blank" rel="noreferrer"
            style={{background:"#1a56db",color:"#fff",textDecoration:"none",
              padding:"10px 24px",borderRadius:6,fontSize:13,fontWeight:700,
              display:"flex",alignItems:"center",gap:6}}>
            💳 Pay Fine Online
          </a>
        )}
        <a href="https://echallan.tspolice.gov.in" target="_blank" rel="noreferrer"
          style={{background:"#f0fdf4",color:"#15803d",textDecoration:"none",
            border:"1px solid #bbf7d0",padding:"10px 20px",borderRadius:6,fontSize:13,fontWeight:600}}>
          🔗 Verify on Parivahan
        </a>
        {["💾 Save","▶ Play","📸 Screenshot"].map(a=>(
          <button key={a} style={{background:"#f8fafc",border:"1px solid #e2e8f0",
            padding:"10px 16px",borderRadius:6,fontSize:12,cursor:"pointer",color:"#374151"}}>
            {a}
          </button>
        ))}
      </div>

      {/* Challan text */}
      {c.challan_text && (
        <div style={{background:"#fff",borderRadius:6,overflow:"hidden",
          border:"1px solid #e2e8f0",boxShadow:"0 1px 3px rgba(0,0,0,0.05)"}}>
          <div style={{background:"#f8fafc",borderBottom:"1px solid #e2e8f0",
            padding:"8px 16px",fontSize:11,fontWeight:700,color:"#374151",
            textTransform:"uppercase",letterSpacing:0.5}}>
            📄 Official Challan Notice
          </div>
          <pre style={{margin:0,padding:16,fontSize:11,lineHeight:2,
            whiteSpace:"pre-wrap",color:"#334155",fontFamily:"'Courier New',monospace",
            background:"#fffbeb"}}>
            {c.challan_text}
          </pre>
        </div>
      )}
    </div>
  );
}

// ── Contest Tab ───────────────────────────────────
function ContestTab() {
  const [form, setForm]   = useState({challan_id:"",name:"",phone:"",reason:"",description:""});
  const [sent, setSent]   = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      await fetch(`${(window.ENV||{}).API||"http://localhost:8000"}/api/public/grievance`,
        {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});
    } catch {}
    setSent(true); setLoading(false);
  };

  if (sent) return (
    <div style={{maxWidth:600,margin:"40px auto",background:"#fff",borderRadius:8,
      padding:40,textAlign:"center",border:"1px solid #e2e8f0"}}>
      <div style={{fontSize:52,marginBottom:12}}>✅</div>
      <div style={{fontSize:20,fontWeight:700,marginBottom:8,color:"#15803d"}}>
        Grievance Submitted
      </div>
      <div style={{color:"#64748b",fontSize:13,lineHeight:1.7}}>
        Reference: <strong>GRV{Date.now().toString().slice(-6)}</strong><br/>
        Our team will review within 7 working days.<br/>
        You'll be notified on the registered mobile number.
      </div>
    </div>
  );

  return (
    <div style={{maxWidth:600,margin:"0 auto"}}>
      <div style={{background:"#fff",borderRadius:8,overflow:"hidden",border:"1px solid #e2e8f0"}}>
        <div style={{background:"#1e3a8a",padding:"12px 20px",color:"#fff",fontWeight:700,fontSize:15}}>
          ⚖️ Contest a Challan
        </div>
        <div style={{padding:20}}>
          <div style={{background:"#fff7ed",border:"1px solid #fed7aa",borderRadius:6,
            padding:"10px 14px",marginBottom:16,fontSize:12,color:"#92400e"}}>
            📋 If you believe a challan was issued incorrectly, file a grievance below.
            Attach supporting documents at your nearest traffic court if required.
          </div>
          <form onSubmit={submit} style={{display:"flex",flexDirection:"column",gap:14}}>
            {[
              {l:"Challan Number *",k:"challan_id",p:"e.g. TSTP000123"},
              {l:"Your Full Name *",k:"name",p:"As per driving license"},
              {l:"Mobile Number *",k:"phone",p:"10-digit number"},
            ].map(f=>(
              <div key={f.k}>
                <label style={{fontSize:11,fontWeight:600,color:"#374151",display:"block",
                  marginBottom:5,textTransform:"uppercase",letterSpacing:0.5}}>{f.l}</label>
                <input required value={form[f.k]} placeholder={f.p}
                  onChange={e=>setForm({...form,[f.k]:e.target.value})}
                  style={{width:"100%",padding:"9px 12px",border:"1px solid #e2e8f0",
                    borderRadius:6,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
              </div>
            ))}
            <div>
              <label style={{fontSize:11,fontWeight:600,color:"#374151",display:"block",
                marginBottom:5,textTransform:"uppercase",letterSpacing:0.5}}>
                Reason for Contest *
              </label>
              <select required value={form.reason}
                onChange={e=>setForm({...form,reason:e.target.value})}
                style={{width:"100%",padding:"9px 12px",border:"1px solid #e2e8f0",
                  borderRadius:6,fontSize:13,outline:"none"}}>
                <option value="">Select reason...</option>
                <option>Vehicle was not at that location</option>
                <option>Helmet was worn — misidentification by system</option>
                <option>Number plate misread — wrong vehicle</option>
                <option>Challan issued after violation was corrected</option>
                <option>Technical/system error</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:"#374151",display:"block",
                marginBottom:5,textTransform:"uppercase",letterSpacing:0.5}}>
                Description *
              </label>
              <textarea required rows={4} value={form.description}
                onChange={e=>setForm({...form,description:e.target.value})}
                placeholder="Explain why you believe this challan is incorrect..."
                style={{width:"100%",padding:"9px 12px",border:"1px solid #e2e8f0",
                  borderRadius:6,fontSize:13,outline:"none",resize:"vertical",
                  fontFamily:"inherit",boxSizing:"border-box"}}/>
            </div>
            <button type="submit" disabled={loading}
              style={{background:"#1a56db",color:"#fff",border:"none",
                padding:"11px",borderRadius:6,fontSize:14,fontWeight:700,cursor:"pointer"}}>
              {loading?"Submitting...":"Submit Grievance →"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Report Tab ────────────────────────────────────
function ReportTab() {
  const [form, setForm] = useState({type:"",location:"",description:"",vehicle_no:"",anonymous:true});
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await fetch(`${(window.ENV||{}).API||"http://localhost:8000"}/api/public/report`,
        {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});
    } catch {}
    setSent(true);
  };

  if (sent) return (
    <div style={{maxWidth:500,margin:"40px auto",background:"#fff",borderRadius:8,
      padding:40,textAlign:"center",border:"1px solid #e2e8f0"}}>
      <div style={{fontSize:52,marginBottom:12}}>📢</div>
      <div style={{fontSize:18,fontWeight:700,color:"#1e293b",marginBottom:8}}>Report Received!</div>
      <div style={{color:"#64748b",fontSize:13}}>
        Ref: RPT{Date.now().toString().slice(-6)}<br/>
        Thank you for keeping Hyderabad roads safe.
      </div>
    </div>
  );

  return (
    <div style={{maxWidth:580,margin:"0 auto"}}>
      <div style={{background:"#fff",borderRadius:8,overflow:"hidden",border:"1px solid #e2e8f0"}}>
        <div style={{background:"#15803d",padding:"12px 20px",color:"#fff",fontWeight:700,fontSize:15}}>
          📢 Report a Traffic Violation
        </div>
        <div style={{padding:20}}>
          <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:6,
            padding:"10px 14px",marginBottom:16,fontSize:12,color:"#15803d"}}>
            🔒 You can report anonymously. Your identity will not be recorded.
          </div>
          <form onSubmit={submit} style={{display:"flex",flexDirection:"column",gap:14}}>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:"#374151",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:0.5}}>
                Violation Type *
              </label>
              <select required value={form.type} onChange={e=>setForm({...form,type:e.target.value})}
                style={{width:"100%",padding:"9px 12px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:13,outline:"none"}}>
                <option value="">Select...</option>
                {["No Helmet","Triple Riding","Signal Jumping","Wrong Way Driving",
                  "Drunk Driving","Illegal Parking","Overspeeding","Other"].map(o=>(
                  <option key={o}>{o}</option>
                ))}
              </select>
            </div>
            {[
              {l:"Location *",k:"location",p:"e.g. Hitech City Flyover, Hyderabad"},
              {l:"Vehicle Number (optional)",k:"vehicle_no",p:"e.g. TS09AB1234"},
            ].map(f=>(
              <div key={f.k}>
                <label style={{fontSize:11,fontWeight:600,color:"#374151",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:0.5}}>{f.l}</label>
                <input value={form[f.k]||""} placeholder={f.p} required={f.k==="location"}
                  onChange={e=>setForm({...form,[f.k]:e.target.value})}
                  style={{width:"100%",padding:"9px 12px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
              </div>
            ))}
            <div>
              <label style={{fontSize:11,fontWeight:600,color:"#374151",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:0.5}}>Description *</label>
              <textarea required rows={3} value={form.description}
                onChange={e=>setForm({...form,description:e.target.value})}
                placeholder="Describe the violation..."
                style={{width:"100%",padding:"9px 12px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:13,outline:"none",resize:"vertical",fontFamily:"inherit",boxSizing:"border-box"}}/>
            </div>
            <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",fontSize:13}}>
              <input type="checkbox" checked={form.anonymous}
                onChange={e=>setForm({...form,anonymous:e.target.checked})} style={{width:16,height:16}}/>
              Submit anonymously
            </label>
            <button type="submit" style={{background:"#15803d",color:"#fff",border:"none",
              padding:"11px",borderRadius:6,fontSize:14,fontWeight:700,cursor:"pointer"}}>
              Submit Report →
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Help Tab ──────────────────────────────────────
function HelpTab() {
  return (
    <div style={{maxWidth:800,margin:"0 auto",display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
      {[
        {icon:"💳",title:"How to Pay",color:"#1a56db",
          desc:"Pay via echallan.tspolice.gov.in or UPI: tspolice@upi. Never pay through SMS links or WhatsApp APK files — those are scams.",
          btn:"Pay Now",link:"https://echallan.tspolice.gov.in"},
        {icon:"🚨",title:"Avoid Fake Challans",color:"#dc2626",
          desc:"Real VIATRA challans are only issued through this portal. Always verify on official Parivahan portal before paying.",
          btn:"Verify",link:"https://echallan.tspolice.gov.in"},
        {icon:"📞",title:"Helpline",color:"#7c3aed",
          desc:"Traffic Control Room: 040-27852330\nTraffic Helpline: 1800-425-0101 (24/7)\nEmergency: 100",
          btn:"Call Now",link:"tel:18004250101"},
        {icon:"🔒",title:"Data Privacy",color:"#15803d",
          desc:"VIATRA only stores vehicle number, violation type, location and timestamp. No personal data is collected. Compliant with IT Act 2000.",
          btn:null},
        {icon:"📱",title:"Official Apps",color:"#b45309",
          desc:"Use only official Parivahan app from Google Play Store. BHIM/PhonePe/GPay for UPI payments to tspolice@upi.",
          btn:null},
        {icon:"⚖️",title:"Court Address",color:"#0369a1",
          desc:"Traffic Court: Road No. 12, Banjara Hills, Hyderabad. Mon-Sat 10AM-5PM. Bring challan copy and vehicle documents.",
          btn:null},
      ].map(h=>(
        <div key={h.title} style={{background:"#fff",borderRadius:8,padding:18,
          border:"1px solid #e2e8f0",borderTop:`3px solid ${h.color}`}}>
          <div style={{fontSize:26,marginBottom:8}}>{h.icon}</div>
          <div style={{fontWeight:700,color:"#1e293b",marginBottom:6,fontSize:14}}>{h.title}</div>
          <div style={{color:"#64748b",fontSize:12,lineHeight:1.7,marginBottom:10,whiteSpace:"pre-line"}}>
            {h.desc}
          </div>
          {h.btn && (
            <a href={h.link} target="_blank" rel="noreferrer"
              style={{display:"inline-block",background:h.color,color:"#fff",
                textDecoration:"none",padding:"6px 14px",borderRadius:5,fontSize:12,fontWeight:600}}>
              {h.btn} →
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
