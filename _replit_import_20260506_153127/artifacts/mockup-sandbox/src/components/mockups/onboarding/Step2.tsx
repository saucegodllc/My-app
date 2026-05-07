import { useState } from "react";
const P = "#FF299B";
const BG = "#0d0d0d";
const LANGUAGES = ["English","Spanish","Haitian Creole","Portuguese","French","Bilingual (Spanish & English)","Arabic","Hindi","Chinese","Other"];
const MEET = ["Anyone (any language)","English speakers","Spanish speakers","Haitian Creole speakers","Portuguese speakers","Bilingual (Spanish & English)","Any language — I'm open!"];
function Dropdown({ label, value, placeholder, options, onSelect, icon }: { label:string; value:string; placeholder:string; options:string[]; onSelect:(v:string)=>void; icon:string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8, position:"relative" }}>
      <div style={{ fontSize:13, fontWeight:500, color:"rgba(255,255,255,0.5)" }}>{label}</div>
      <button onClick={()=>setOpen(!open)} style={{ display:"flex",alignItems:"center",gap:10,padding:"0 16px",height:52,borderRadius:12,border:`1px solid ${value?P:"rgba(255,255,255,0.1)"}`,background:"rgba(255,255,255,0.05)",cursor:"pointer",textAlign:"left" }}>
        <span style={{ fontSize:18, opacity:0.6 }}>{icon}</span>
        <span style={{ flex:1, fontSize:16, color:value?"#fff":"rgba(255,255,255,0.4)" }}>{value||placeholder}</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform:open?"rotate(180deg)":"none",transition:"transform 0.2s" }}><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open&&<div style={{ position:"absolute",left:0,right:0,top:"100%",zIndex:99,background:"#111",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,overflow:"hidden",maxHeight:200,overflowY:"auto",boxShadow:"0 16px 40px rgba(0,0,0,0.7)" }}>
        {options.map((o,i)=><button key={o} onClick={()=>{onSelect(o);setOpen(false);}} style={{ width:"100%",padding:"13px 16px",textAlign:"left",background:o===value?"rgba(255,41,155,0.08)":"transparent",border:"none",borderBottom:i<options.length-1?"1px solid rgba(255,255,255,0.06)":"none",color:o===value?P:"rgba(255,255,255,0.75)",fontSize:14,fontWeight:o===value?600:400,cursor:"pointer" }}>{o}</button>)}
      </div>}
    </div>
  );
}
export function Step2() {
  const [myLang, setMyLang] = useState("");
  const [meetLang, setMeetLang] = useState("");
  const canContinue = !!myLang && !!meetLang;
  return (
    <div style={{ width:"100%",height:"100vh",background:BG,display:"flex",flexDirection:"column",fontFamily:"'Inter',system-ui,sans-serif",overflow:"hidden" }}>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"54px 20px 16px" }}>
        <button style={{ width:36,height:36,borderRadius:18,border:"none",background:"rgba(255,255,255,0.06)",color:"#fff",fontSize:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>‹</button>
        <div style={{ display:"flex",flexDirection:"row",gap:5 }}>
          {[1,2,3,4,5].map(i=><div key={i} style={{ width:32,height:2.5,borderRadius:2,background:i<=2?P:"rgba(255,255,255,0.1)" }} />)}
        </div>
        <span style={{ fontSize:13,color:"rgba(255,255,255,0.4)",fontWeight:500 }}>2 of 5</span>
      </div>
      <div style={{ padding:"8px 24px 0",flex:1,display:"flex",flexDirection:"column",gap:28 }}>
        <div>
          <div style={{ fontSize:28,fontWeight:700,color:"#fff",letterSpacing:-0.5,marginBottom:6 }}>Language</div>
          <div style={{ fontSize:15,color:"rgba(255,255,255,0.5)",lineHeight:1.5 }}>Tell us how you communicate</div>
        </div>
        <Dropdown label="What language do you speak?" value={myLang} placeholder="Select your language" options={LANGUAGES} onSelect={setMyLang} icon="💬" />
        <Dropdown label="Who are you trying to meet?" value={meetLang} placeholder="Select language preference" options={MEET} onSelect={setMeetLang} icon="👥" />
      </div>
      <div style={{ padding:"12px 24px 36px" }}>
        <button style={{ width:"100%",padding:"18px",borderRadius:12,background:canContinue?`linear-gradient(135deg,${P},#c0207a)`:"rgba(255,255,255,0.06)",border:"none",color:canContinue?"#fff":"rgba(255,255,255,0.2)",fontSize:16,fontWeight:800,cursor:canContinue?"pointer":"default",boxShadow:canContinue?"0 8px 32px rgba(255,41,155,0.3)":"none" }}>
          Continue →
        </button>
      </div>
    </div>
  );
}
