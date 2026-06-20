import { useState } from "react";
const P = "#FF299B";
const BG = "#0d0d0d";
export function Step3() {
  const [bio, setBio] = useState("");
  return (
    <div style={{ width:"100%",height:"100vh",background:BG,display:"flex",flexDirection:"column",fontFamily:"'Inter',system-ui,sans-serif",overflow:"hidden" }}>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"54px 20px 16px" }}>
        <button style={{ width:36,height:36,borderRadius:18,border:"none",background:"rgba(255,255,255,0.06)",color:"#fff",fontSize:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>‹</button>
        <div style={{ display:"flex",flexDirection:"row",gap:5 }}>
          {[1,2,3,4,5].map(i=><div key={i} style={{ width:32,height:2.5,borderRadius:2,background:i<=3?P:"rgba(255,255,255,0.1)" }} />)}
        </div>
        <span style={{ fontSize:13,color:"rgba(255,255,255,0.4)",fontWeight:500 }}>3 of 5</span>
      </div>
      <div style={{ padding:"8px 24px 0",flex:1,display:"flex",flexDirection:"column",gap:24 }}>
        <div>
          <div style={{ fontSize:28,fontWeight:700,color:"#fff",letterSpacing:-0.5,marginBottom:6 }}>About you</div>
          <div style={{ fontSize:15,color:"rgba(255,255,255,0.5)",lineHeight:1.5 }}>Write a short bio that shows your personality</div>
        </div>
        <div style={{ position:"relative",borderRadius:16,border:`1px solid ${bio?"rgba(255,41,155,0.4)":"rgba(255,255,255,0.1)"}`,background:"rgba(255,255,255,0.04)",padding:16,minHeight:160 }}>
          <textarea
            value={bio}
            onChange={e=>setBio(e.target.value.slice(0,300))}
            placeholder="I love the beach, good food, and meeting new people in South Florida..."
            maxLength={300}
            style={{ width:"100%",minHeight:120,background:"transparent",border:"none",outline:"none",resize:"none",color:"#fff",fontSize:15,lineHeight:1.6,fontFamily:"inherit",caretColor:P }}
          />
          <div style={{ textAlign:"right",fontSize:12,color:"rgba(255,255,255,0.35)",marginTop:4 }}>{bio.length}/300</div>
        </div>
        <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
          {["I'm always down for a late-night walk on South Beach 🌊","Dog dad living in Brickell, love hiking + rooftop bars","Chef, traveler, and salsa dancer 💃 — ask me anything"].map(s=>(
            <button key={s} onClick={()=>setBio(s)} style={{ padding:"10px 14px",borderRadius:10,border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.03)",color:"rgba(255,255,255,0.5)",fontSize:13,cursor:"pointer",textAlign:"left" }}>
              ✨ {s}
            </button>
          ))}
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
