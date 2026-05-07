import { useState } from "react";

const HOT_PINK = "#FF299B";
const MIAMI_DADE_CITIES = [
  "Miami","Miami Beach","Brickell","Wynwood","Coral Gables",
  "Coconut Grove","Aventura","Doral","Homestead","Kendall",
];
const BROWARD_CITIES = [
  "Fort Lauderdale","Hollywood","Miramar","Pompano Beach",
  "Coral Springs","Sunrise","Plantation","Davie","Weston",
];

const COUNTIES = [
  { id:"Miami-Dade", label:"Miami-Dade", sub:"Miami · Brickell · Coral Gables · Wynwood", cityCount: MIAMI_DADE_CITIES.length, cities: MIAMI_DADE_CITIES },
  { id:"Broward", label:"Broward", sub:"Fort Lauderdale · Hollywood · Miramar", cityCount: BROWARD_CITIES.length, cities: BROWARD_CITIES },
];

export function VariantB() {
  const [county, setCounty] = useState("");
  const [city, setCity] = useState("");
  const [open, setOpen] = useState(false);

  const cities = county === "Miami-Dade" ? MIAMI_DADE_CITIES : county === "Broward" ? BROWARD_CITIES : [];

  return (
    <div
      className="w-full h-screen relative overflow-hidden flex flex-col"
      style={{ fontFamily:"'Inter', system-ui, sans-serif", background:"#000" }}
    >
      {/* Header strip */}
      <div style={{
        position:"absolute", top:0, left:0, right:0, height:2,
        background:`linear-gradient(90deg, ${HOT_PINK}, #8B5CF6)`,
      }} />

      {/* Progress + step */}
      <div className="relative z-10 flex items-center gap-3 px-6 pt-14 pb-0">
        {[1,2,3,4,5].map(i => (
          <div key={i} style={{
            flex:1, height:2.5, borderRadius:2,
            background: i === 1 ? HOT_PINK : "rgba(255,255,255,0.1)",
          }} />
        ))}
      </div>

      {/* Big editorial header */}
      <div className="relative z-10 px-6 pt-10 pb-2">
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
          <div style={{
            width:28, height:28, borderRadius:8,
            background:"rgba(255,41,155,0.15)",
            border:`1px solid rgba(255,41,155,0.3)`,
            display:"flex", alignItems:"center", justifyContent:"center",
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={HOT_PINK} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          <span style={{ fontSize:12, fontWeight:700, letterSpacing:2, color:"rgba(255,255,255,0.4)", textTransform:"uppercase" }}>
            Location
          </span>
        </div>
        <h1 style={{ fontSize:40, fontWeight:900, letterSpacing:-1.5, lineHeight:1.05, marginBottom:10, color:"#fff" }}>
          Where are<br/>
          <span style={{ color: HOT_PINK }}>you?</span>
        </h1>
        <p style={{ fontSize:14, color:"rgba(255,255,255,0.4)", lineHeight:1.6 }}>
          Help people nearby find you in South Florida
        </p>
      </div>

      {/* Divider */}
      <div style={{ height:1, background:"rgba(255,255,255,0.06)", margin:"20px 0 0" }} />

      {/* County selection */}
      <div className="relative z-10 px-6 pt-6 flex flex-col gap-3">
        <p style={{ fontSize:11, fontWeight:700, letterSpacing:2, color:"rgba(255,255,255,0.3)", textTransform:"uppercase", marginBottom:4 }}>
          Select your county
        </p>
        {COUNTIES.map((c) => {
          const selected = county === c.id;
          return (
            <button
              key={c.id}
              onClick={() => { setCounty(c.id); setCity(""); setOpen(false); }}
              style={{
                display:"flex", alignItems:"center", justifyContent:"space-between",
                padding:"20px 20px",
                borderRadius:12,
                border: `1.5px solid ${selected ? HOT_PINK : "rgba(255,255,255,0.09)"}`,
                background: selected ? "rgba(255,41,155,0.07)" : "rgba(255,255,255,0.03)",
                cursor:"pointer", textAlign:"left",
                transition:"all 0.15s ease",
                position:"relative", overflow:"hidden",
              }}
            >
              {selected && (
                <div style={{
                  position:"absolute", inset:0,
                  background:"linear-gradient(135deg, rgba(255,41,155,0.08) 0%, transparent 60%)",
                  pointerEvents:"none",
                }} />
              )}
              <div style={{ position:"relative" }}>
                <div style={{ fontSize:18, fontWeight:800, color: selected ? "#fff" : "rgba(255,255,255,0.7)", letterSpacing:-0.5, marginBottom:4 }}>
                  {c.label}
                </div>
                <div style={{ fontSize:12, color:"rgba(255,255,255,0.35)", lineHeight:1.5 }}>
                  {c.sub}
                </div>
                <div style={{ marginTop:8, display:"inline-flex", alignItems:"center", gap:4,
                  background:"rgba(255,255,255,0.06)", borderRadius:6, padding:"3px 8px" }}>
                  <span style={{ fontSize:11, color:"rgba(255,255,255,0.4)", fontWeight:500 }}>
                    {c.cityCount} cities
                  </span>
                </div>
              </div>
              <div style={{
                width:30, height:30, borderRadius:15, flexShrink:0,
                border: `2px solid ${selected ? HOT_PINK : "rgba(255,255,255,0.15)"}`,
                background: selected ? HOT_PINK : "transparent",
                display:"flex", alignItems:"center", justifyContent:"center",
                transition:"all 0.15s",
              }}>
                {selected ? (
                  <svg width="14" height="11" viewBox="0 0 14 11" fill="none">
                    <path d="M1.5 5.5L5.5 9.5L12.5 1.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <div style={{ width:8, height:8, borderRadius:4, background:"rgba(255,255,255,0.15)" }} />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* City picker */}
      {county && (
        <div className="relative z-10 px-6 pt-5">
          <p style={{ fontSize:11, fontWeight:700, letterSpacing:2, color:"rgba(255,255,255,0.3)", textTransform:"uppercase", marginBottom:10 }}>
            Your city
          </p>
          <button
            onClick={() => setOpen(!open)}
            style={{
              width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between",
              padding:"16px 18px",
              borderRadius:12,
              border:`1.5px solid ${city ? HOT_PINK : "rgba(255,255,255,0.1)"}`,
              background: city ? "rgba(255,41,155,0.07)" : "rgba(255,255,255,0.03)",
              cursor:"pointer",
              transition:"all 0.15s",
            }}
          >
            <span style={{ fontSize:15, color: city ? "#fff" : "rgba(255,255,255,0.3)", fontWeight: city ? 600 : 400 }}>
              {city || "Choose a city…"}
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: open ? "rotate(180deg)" : "none", transition:"transform 0.2s" }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          {open && (
            <div style={{
              position:"absolute", left:24, right:24, zIndex:50,
              background:"#0c0c0c",
              borderRadius:12,
              border:"1px solid rgba(255,255,255,0.08)",
              overflow:"hidden",
              boxShadow:"0 16px 48px rgba(0,0,0,0.7)",
              maxHeight:220, overflowY:"auto",
            }}>
              {cities.map((c, i) => (
                <button key={c} onClick={() => { setCity(c); setOpen(false); }}
                  style={{
                    width:"100%", padding:"14px 18px", textAlign:"left",
                    background: c === city ? "rgba(255,41,155,0.08)" : "transparent",
                    border:"none",
                    borderBottom: i < cities.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                    color: c === city ? HOT_PINK : "rgba(255,255,255,0.7)",
                    fontSize:14, fontWeight: c === city ? 700 : 400, cursor:"pointer",
                  }}>
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Continue CTA */}
      <div className="relative z-10 mt-auto px-6 pb-10 pt-4">
        <button
          style={{
            width:"100%", padding:"18px",
            borderRadius:12,
            background: county && city
              ? `linear-gradient(135deg, ${HOT_PINK} 0%, #c0207a 100%)`
              : "rgba(255,255,255,0.05)",
            border: county && city ? "none" : "1px solid rgba(255,255,255,0.07)",
            color: county && city ? "#fff" : "rgba(255,255,255,0.2)",
            fontSize:16, fontWeight:800,
            cursor: county && city ? "pointer" : "default",
            letterSpacing:0.5,
            transition:"all 0.2s",
            boxShadow: county && city ? `0 8px 32px rgba(255,41,155,0.35)` : "none",
          }}
        >
          {county && city ? "Continue →" : "Select county & city"}
        </button>
      </div>
    </div>
  );
}
