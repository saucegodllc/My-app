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
  {
    id: "Miami-Dade",
    label: "Miami-Dade",
    sub: "Miami · Brickell · Coral Gables · Wynwood",
    cities: MIAMI_DADE_CITIES,
    icon: "🌴",
  },
  {
    id: "Broward",
    label: "Broward",
    sub: "Fort Lauderdale · Hollywood · Miramar",
    cities: BROWARD_CITIES,
    icon: "🌊",
  },
];

export function VariantA() {
  const [county, setCounty] = useState("");
  const [city, setCity] = useState("");
  const [open, setOpen] = useState(false);

  const cities = county === "Miami-Dade" ? MIAMI_DADE_CITIES : county === "Broward" ? BROWARD_CITIES : [];

  return (
    <div
      className="w-full h-screen relative overflow-hidden flex flex-col"
      style={{ fontFamily: "'Inter', system-ui, sans-serif", background: "#000" }}
    >
      {/* Night city background */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 30% 60%, #1a0830 0%, #0a0a14 40%, #000 100%)",
        }}
      />
      {/* City light bokeh orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div style={{ position:"absolute", width:300, height:300, borderRadius:"50%", background:"rgba(255,41,155,0.08)", left:-60, top:-40, filter:"blur(60px)" }} />
        <div style={{ position:"absolute", width:240, height:240, borderRadius:"50%", background:"rgba(100,60,200,0.12)", right:-40, top:"20%", filter:"blur(50px)" }} />
        <div style={{ position:"absolute", width:180, height:180, borderRadius:"50%", background:"rgba(255,180,50,0.06)", left:"20%", bottom:"25%", filter:"blur(40px)" }} />
        <div style={{ position:"absolute", width:200, height:200, borderRadius:"50%", background:"rgba(255,41,155,0.06)", right:0, bottom:"10%", filter:"blur(50px)" }} />
        {/* Tiny city light dots */}
        {Array.from({length:40}).map((_,i) => (
          <div key={i} style={{
            position:"absolute",
            width: Math.random()*2+1,
            height: Math.random()*2+1,
            borderRadius:"50%",
            background:`rgba(255,${Math.floor(Math.random()*80+180)},${Math.floor(Math.random()*80)},${Math.random()*0.4+0.2})`,
            left: `${(i*7.3+13)%100}%`,
            top: `${(i*11.7+20)%70+15}%`,
          }} />
        ))}
      </div>
      {/* Gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.5) 50%, rgba(0,0,0,0.85) 100%)",
        }}
      />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-5 pt-14 pb-3">
        <span style={{ fontSize:13, color:"rgba(255,255,255,0.45)", letterSpacing:1, fontWeight:500 }}>
          1 OF 5
        </span>
        <div style={{ width:120, height:3, borderRadius:2, background:"rgba(255,255,255,0.12)", overflow:"hidden" }}>
          <div style={{ width:"20%", height:"100%", borderRadius:2, background: HOT_PINK }} />
        </div>
      </div>

      {/* Title */}
      <div className="relative z-10 px-5 pt-4 pb-2">
        <p style={{ fontSize:12, fontWeight:600, letterSpacing:2, color: HOT_PINK, textTransform:"uppercase", marginBottom:8 }}>
          SOUTH FLORIDA
        </p>
        <h1 style={{ fontSize:34, fontWeight:800, color:"#fff", lineHeight:1.1, letterSpacing:-0.8, marginBottom:8 }}>
          Where are you?
        </h1>
        <p style={{ fontSize:15, color:"rgba(255,255,255,0.55)", lineHeight:1.5 }}>
          Help people nearby find you
        </p>
      </div>

      {/* County Cards */}
      <div className="relative z-10 px-5 pt-5 flex flex-col gap-3">
        {COUNTIES.map((c) => {
          const selected = county === c.id;
          return (
            <button
              key={c.id}
              onClick={() => { setCounty(c.id); setCity(""); setOpen(false); }}
              style={{
                display:"flex",
                alignItems:"center",
                gap:16,
                padding:"18px 18px",
                borderRadius:16,
                border: `1.5px solid ${selected ? HOT_PINK : "rgba(255,255,255,0.14)"}`,
                background: selected
                  ? "rgba(255,41,155,0.12)"
                  : "rgba(255,255,255,0.05)",
                backdropFilter:"blur(12px)",
                WebkitBackdropFilter:"blur(12px)",
                cursor:"pointer",
                position:"relative",
                overflow:"hidden",
                transition:"all 0.2s ease",
                textAlign:"left",
              }}
            >
              {/* Left accent bar */}
              <div style={{
                position:"absolute", left:0, top:0, bottom:0, width:3,
                background: selected ? HOT_PINK : "transparent",
                borderRadius:"16px 0 0 16px",
                transition:"background 0.2s",
              }} />
              {/* Icon circle */}
              <div style={{
                width:52, height:52, borderRadius:26, flexShrink:0,
                background: selected ? "rgba(255,41,155,0.2)" : "rgba(255,255,255,0.08)",
                border: `1px solid ${selected ? "rgba(255,41,155,0.4)" : "rgba(255,255,255,0.1)"}`,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:24, transition:"all 0.2s",
              }}>
                {c.icon}
              </div>
              {/* Text */}
              <div style={{ flex:1 }}>
                <div style={{ fontSize:19, fontWeight:700, color: selected ? "#fff" : "rgba(255,255,255,0.9)", letterSpacing:-0.3, marginBottom:4 }}>
                  {c.label} County
                </div>
                <div style={{ fontSize:12, color:"rgba(255,255,255,0.45)", lineHeight:1.4 }}>
                  {c.sub}
                </div>
              </div>
              {/* Check */}
              <div style={{
                width:26, height:26, borderRadius:13, flexShrink:0,
                border: `2px solid ${selected ? HOT_PINK : "rgba(255,255,255,0.2)"}`,
                background: selected ? HOT_PINK : "transparent",
                display:"flex", alignItems:"center", justifyContent:"center",
                transition:"all 0.2s",
              }}>
                {selected && (
                  <svg width="13" height="10" viewBox="0 0 13 10" fill="none">
                    <path d="M1.5 5L5 8.5L11.5 1.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* City Picker */}
      {county && (
        <div className="relative z-10 px-5 pt-4">
          <p style={{ fontSize:12, fontWeight:600, color:"rgba(255,255,255,0.4)", letterSpacing:1, textTransform:"uppercase", marginBottom:8 }}>
            YOUR CITY
          </p>
          <button
            onClick={() => setOpen(!open)}
            style={{
              width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between",
              padding:"16px 16px",
              borderRadius:14,
              border:`1.5px solid ${city ? HOT_PINK : "rgba(255,255,255,0.15)"}`,
              background: city ? "rgba(255,41,155,0.08)" : "rgba(255,255,255,0.05)",
              backdropFilter:"blur(12px)",
              cursor:"pointer",
            }}
          >
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={city ? HOT_PINK : "rgba(255,255,255,0.4)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              <span style={{ fontSize:15, color: city ? "#fff" : "rgba(255,255,255,0.4)", fontWeight: city ? 600 : 400 }}>
                {city || "Select your city"}
              </span>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: open ? "rotate(180deg)" : "none", transition:"transform 0.2s" }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          {open && (
            <div style={{
              position:"absolute", left:20, right:20, top:"100%", zIndex:50,
              background:"rgba(15,10,25,0.98)",
              backdropFilter:"blur(20px)",
              borderRadius:14,
              border:"1px solid rgba(255,255,255,0.1)",
              overflow:"hidden",
              boxShadow:"0 20px 60px rgba(0,0,0,0.6)",
              maxHeight:220, overflowY:"auto",
            }}>
              {cities.map((c) => (
                <button key={c} onClick={() => { setCity(c); setOpen(false); }}
                  style={{
                    width:"100%", padding:"13px 16px", textAlign:"left",
                    background: c === city ? "rgba(255,41,155,0.1)" : "transparent",
                    border:"none", borderBottom:"1px solid rgba(255,255,255,0.06)",
                    color: c === city ? HOT_PINK : "rgba(255,255,255,0.8)",
                    fontSize:14, fontWeight: c === city ? 600 : 400, cursor:"pointer",
                  }}>
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CTA */}
      <div className="relative z-10 mt-auto px-5 pb-10">
        <button
          style={{
            width:"100%", padding:"17px",
            borderRadius:14,
            background: county && city ? HOT_PINK : "rgba(255,255,255,0.08)",
            border:"none",
            color: county && city ? "#fff" : "rgba(255,255,255,0.25)",
            fontSize:16, fontWeight:700,
            cursor: county && city ? "pointer" : "default",
            letterSpacing:0.3,
            transition:"all 0.2s",
          }}
        >
          Continue →
        </button>
      </div>
    </div>
  );
}
