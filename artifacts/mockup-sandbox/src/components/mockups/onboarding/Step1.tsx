import { useState } from "react";
const P = "#FF299B";
const MIAMI = ["Miami","Miami Beach","Brickell","Wynwood","Coral Gables","Coconut Grove","Aventura","Doral","Homestead","Kendall"];
const BROWARD = ["Fort Lauderdale","Hollywood","Miramar","Pompano Beach","Coral Springs","Sunrise","Plantation","Davie","Weston"];
const COUNTIES = [
  { id:"Miami-Dade", label:"Miami-Dade", sub:"Miami · Brickell · Coral Gables · Wynwood", count:40, cities: MIAMI },
  { id:"Broward", label:"Broward", sub:"Fort Lauderdale · Hollywood · Miramar", count:30, cities: BROWARD },
];
export function Step1() {
  const [county, setCounty] = useState("");
  const [city, setCity] = useState("");
  const [open, setOpen] = useState(false);
  const cities = county === "Miami-Dade" ? MIAMI : BROWARD;
  return (
    <div style={{ width:"100%", height:"100vh", background:"#000", display:"flex", flexDirection:"column", fontFamily:"'Inter',system-ui,sans-serif", overflow:"hidden", position:"relative" }}>
      <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:`linear-gradient(90deg,${P},#8B5CF6)` }} />
      <div style={{ display:"flex", flexDirection:"row", gap:5, padding:"54px 24px 0", marginBottom:4 }}>
        {[1,2,3,4,5].map(i=><div key={i} style={{ flex:1, height:2.5, borderRadius:2, background: i===1?P:"rgba(255,255,255,0.1)" }} />)}
      </div>
      <div style={{ padding:"20px 24px 0", display:"flex", flexDirection:"column", gap:18, flex:1 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:32,height:32,borderRadius:9,background:"rgba(255,41,155,0.15)",border:"1px solid rgba(255,41,155,0.3)",display:"flex",alignItems:"center",justifyContent:"center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={P} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
          </div>
          <span style={{ fontSize:12, fontWeight:700, letterSpacing:2, color:"rgba(255,255,255,0.4)", textTransform:"uppercase" }}>Location</span>
        </div>
        <div>
          <div style={{ fontSize:40, fontWeight:900, letterSpacing:-1.5, lineHeight:1.1, color:"#fff" }}>Where are<br/><span style={{ color:P }}>you?</span></div>
          <div style={{ fontSize:14, color:"rgba(255,255,255,0.4)", lineHeight:1.6, marginTop:8 }}>Help people nearby find you in South Florida</div>
        </div>
        <div style={{ height:1, background:"rgba(255,255,255,0.07)" }} />
        <div>
          <div style={{ fontSize:11, fontWeight:700, letterSpacing:2, color:"rgba(255,255,255,0.3)", textTransform:"uppercase", marginBottom:12 }}>Select your county</div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {COUNTIES.map(c=>{
              const sel=county===c.id;
              return (
                <button key={c.id} onClick={()=>{setCounty(c.id);setCity("");setOpen(false);}} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"18px 20px",borderRadius:14,border:`1.5px solid ${sel?P:"rgba(255,255,255,0.09)"}`,background:sel?"rgba(255,41,155,0.1)":"rgba(255,255,255,0.03)",cursor:"pointer",textAlign:"left",position:"relative",overflow:"hidden" }}>
                  {sel&&<div style={{ position:"absolute",inset:0,background:"linear-gradient(135deg,rgba(255,41,155,0.12) 0%,transparent 60%)",pointerEvents:"none" }} />}
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:18, fontWeight:800, color:sel?"#fff":"rgba(255,255,255,0.7)", letterSpacing:-0.5, marginBottom:4 }}>{c.label}</div>
                    <div style={{ fontSize:12, color:"rgba(255,255,255,0.35)", lineHeight:1.5 }}>{c.sub}</div>
                    <div style={{ marginTop:8, display:"inline-block", background:"rgba(255,255,255,0.06)", borderRadius:6, padding:"3px 8px", fontSize:11, color:"rgba(255,255,255,0.4)", fontWeight:500 }}>{c.count} cities</div>
                  </div>
                  <div style={{ width:30,height:30,borderRadius:15,border:`2px solid ${sel?P:"rgba(255,255,255,0.15)"}`,background:sel?P:"transparent",display:"flex",alignItems:"center",justifyContent:"center",marginLeft:16,flexShrink:0 }}>
                    {sel?<svg width="13" height="10" viewBox="0 0 13 10" fill="none"><path d="M1.5 5L5 8.5L11.5 1.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>:<div style={{ width:8,height:8,borderRadius:4,background:"rgba(255,255,255,0.15)" }} />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        {county && (
          <div style={{ position:"relative" }}>
            <div style={{ fontSize:11, fontWeight:700, letterSpacing:2, color:"rgba(255,255,255,0.3)", textTransform:"uppercase", marginBottom:10 }}>Your city</div>
            <button onClick={()=>setOpen(!open)} style={{ width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"15px 16px",borderRadius:12,border:`1.5px solid ${city?P:"rgba(255,255,255,0.1)"}`,background:city?"rgba(255,41,155,0.07)":"rgba(255,255,255,0.03)",cursor:"pointer" }}>
              <span style={{ fontSize:15, color:city?"#fff":"rgba(255,255,255,0.35)", fontWeight:city?600:400 }}>{city||"Choose a city…"}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform:open?"rotate(180deg)":"none" }}><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {open&&<div style={{ position:"absolute",left:0,right:0,top:"100%",zIndex:50,background:"#0c0c0c",borderRadius:12,border:"1px solid rgba(255,255,255,0.08)",overflow:"hidden",maxHeight:180,overflowY:"auto",boxShadow:"0 16px 48px rgba(0,0,0,0.7)" }}>
              {cities.map((c,i)=><button key={c} onClick={()=>{setCity(c);setOpen(false);}} style={{ width:"100%",padding:"13px 16px",textAlign:"left",background:c===city?"rgba(255,41,155,0.08)":"transparent",border:"none",borderBottom:i<cities.length-1?"1px solid rgba(255,255,255,0.05)":"none",color:c===city?P:"rgba(255,255,255,0.7)",fontSize:14,fontWeight:c===city?700:400,cursor:"pointer" }}>{c}</button>)}
            </div>}
          </div>
        )}
      </div>
      <div style={{ padding:"12px 24px 36px" }}>
        <button style={{ width:"100%",padding:"18px",borderRadius:12,background:county&&city?`linear-gradient(135deg,${P},#c0207a)`:"rgba(255,255,255,0.05)",border:county&&city?"none":"1px solid rgba(255,255,255,0.07)",color:county&&city?"#fff":"rgba(255,255,255,0.2)",fontSize:16,fontWeight:800,cursor:county&&city?"pointer":"default",letterSpacing:0.5,boxShadow:county&&city?"0 8px 32px rgba(255,41,155,0.3)":"none" }}>
          {county&&city?"Continue →":"Select county & city"}
        </button>
      </div>
    </div>
  );
}
