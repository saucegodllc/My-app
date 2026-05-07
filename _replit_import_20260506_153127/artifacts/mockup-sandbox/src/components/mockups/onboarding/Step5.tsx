import { useState } from "react";
const P = "#FF299B";
const BG = "#0d0d0d";
const INTERESTS = ["Travel","Music","Art","Food","Fitness","Photography","Reading","Gaming","Movies","Tech","Sports","Cooking","Hiking","Fashion","Yoga","Coffee","Dancing","Beach"];
export function Step5() {
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (i:string) => setSelected(p=>p.includes(i)?p.filter(x=>x!==i):p.length<10?[...p,i]:p);
  return (
    <div style={{ width:"100%",height:"100vh",background:BG,display:"flex",flexDirection:"column",fontFamily:"'Inter',system-ui,sans-serif",overflow:"hidden" }}>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"54px 20px 16px" }}>
        <button style={{ width:36,height:36,borderRadius:18,border:"none",background:"rgba(255,255,255,0.06)",color:"#fff",fontSize:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>‹</button>
        <div style={{ display:"flex",flexDirection:"row",gap:5 }}>
          {[1,2,3,4,5].map(i=><div key={i} style={{ width:32,height:2.5,borderRadius:2,background:i<=5?P:"rgba(255,255,255,0.1)" }} />)}
        </div>
        <span style={{ fontSize:13,color:"rgba(255,255,255,0.4)",fontWeight:500 }}>5 of 5</span>
      </div>
      <div style={{ padding:"8px 24px 0",flex:1,display:"flex",flexDirection:"column",gap:20,overflowY:"auto" }}>
        <div>
          <div style={{ fontSize:28,fontWeight:700,color:"#fff",letterSpacing:-0.5,marginBottom:6 }}>Your interests</div>
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
            <div style={{ fontSize:15,color:"rgba(255,255,255,0.5)",lineHeight:1.5 }}>Pick up to 10 things you love</div>
            <div style={{ fontSize:13,color:selected.length>=10?P:"rgba(255,255,255,0.35)",fontWeight:600 }}>{selected.length}/10</div>
          </div>
        </div>
        <div style={{ display:"flex",flexWrap:"wrap",gap:10 }}>
          {INTERESTS.map(interest=>{
            const sel=selected.includes(interest);
            return (
              <button key={interest} onClick={()=>toggle(interest)} style={{ padding:"9px 18px",borderRadius:24,border:`1px solid ${sel?P:"rgba(255,255,255,0.1)"}`,background:sel?P:"rgba(255,255,255,0.04)",color:sel?"#fff":"rgba(255,255,255,0.75)",fontSize:14,fontWeight:sel?600:400,cursor:"pointer",transition:"all 0.15s" }}>
                {interest}
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ padding:"12px 24px 36px" }}>
        <button style={{ width:"100%",padding:"18px",borderRadius:12,background:`linear-gradient(135deg,${P},#c0207a)`,border:"none",color:"#fff",fontSize:16,fontWeight:800,cursor:"pointer",boxShadow:"0 8px 32px rgba(255,41,155,0.3)" }}>
          Start Exploring 🔥
        </button>
      </div>
    </div>
  );
}
