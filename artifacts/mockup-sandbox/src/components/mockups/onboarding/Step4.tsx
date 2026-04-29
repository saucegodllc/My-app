import { useState } from "react";
const P = "#FF299B";
const BG = "#0d0d0d";
const INTENTS = [
  { value:"dating", label:"Dating", icon:"❤️", desc:"Find romantic connections" },
  { value:"friendship", label:"Friendship", icon:"🤝", desc:"Make new friends" },
  { value:"networking", label:"Networking", icon:"💼", desc:"Professional connections" },
  { value:"all", label:"All of the above", icon:"🌎", desc:"Open to everything" },
];
export function Step4() {
  const [intent, setIntent] = useState("all");
  return (
    <div style={{ width:"100%",height:"100vh",background:BG,display:"flex",flexDirection:"column",fontFamily:"'Inter',system-ui,sans-serif",overflow:"hidden" }}>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"54px 20px 16px" }}>
        <button style={{ width:36,height:36,borderRadius:18,border:"none",background:"rgba(255,255,255,0.06)",color:"#fff",fontSize:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>‹</button>
        <div style={{ display:"flex",flexDirection:"row",gap:5 }}>
          {[1,2,3,4,5].map(i=><div key={i} style={{ width:32,height:2.5,borderRadius:2,background:i<=4?P:"rgba(255,255,255,0.1)" }} />)}
        </div>
        <span style={{ fontSize:13,color:"rgba(255,255,255,0.4)",fontWeight:500 }}>4 of 5</span>
      </div>
      <div style={{ padding:"8px 24px 0",flex:1,display:"flex",flexDirection:"column",gap:24 }}>
        <div>
          <div style={{ fontSize:28,fontWeight:700,color:"#fff",letterSpacing:-0.5,marginBottom:6 }}>What are you looking for?</div>
          <div style={{ fontSize:15,color:"rgba(255,255,255,0.5)",lineHeight:1.5 }}>This helps us find the right connections for you</div>
        </div>
        <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
          {INTENTS.map(item=>{
            const sel=intent===item.value;
            return (
              <button key={item.value} onClick={()=>setIntent(item.value)} style={{ padding:"18px 20px",borderRadius:14,border:`1.5px solid ${sel?P:"rgba(255,255,255,0.09)"}`,background:sel?"rgba(255,41,155,0.1)":"rgba(255,255,255,0.03)",cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:16,position:"relative",overflow:"hidden" }}>
                {sel&&<div style={{ position:"absolute",inset:0,background:"linear-gradient(135deg,rgba(255,41,155,0.1) 0%,transparent 60%)",pointerEvents:"none" }} />}
                <span style={{ fontSize:26 }}>{item.icon}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:16,fontWeight:700,color:sel?"#fff":"rgba(255,255,255,0.75)",marginBottom:2 }}>{item.label}</div>
                  <div style={{ fontSize:13,color:"rgba(255,255,255,0.4)" }}>{item.desc}</div>
                </div>
                <div style={{ width:22,height:22,borderRadius:11,border:`2px solid ${sel?P:"rgba(255,255,255,0.2)"}`,background:sel?P:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center" }}>
                  {sel&&<svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ padding:"12px 24px 36px" }}>
        <button style={{ width:"100%",padding:"18px",borderRadius:12,background:`linear-gradient(135deg,${P},#c0207a)`,border:"none",color:"#fff",fontSize:16,fontWeight:800,cursor:"pointer",boxShadow:"0 8px 32px rgba(255,41,155,0.3)" }}>
          Continue →
        </button>
      </div>
    </div>
  );
}
