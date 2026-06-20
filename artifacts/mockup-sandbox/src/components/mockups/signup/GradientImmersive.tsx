import { useState } from "react";
import { Eye, EyeOff, Facebook, Linkedin, Mail, Smartphone } from "lucide-react";

export function GradientImmersive() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [authMethod, setAuthMethod] = useState<"email" | "phone">("email");

  return (
    <div
      className="relative w-[390px] h-[844px] overflow-hidden font-sans text-white select-none"
      style={{ background: "#060010" }}
    >
      {/* ── Background atmosphere ── */}
      {/* Large hot-pink orb top-right */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 480,
          height: 480,
          top: -160,
          right: -140,
          background: "radial-gradient(circle, rgba(255,41,155,0.55) 0%, rgba(255,41,155,0.12) 50%, transparent 70%)",
          filter: "blur(2px)",
        }}
      />
      {/* Smaller violet orb bottom-left */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 320,
          height: 320,
          bottom: 60,
          left: -100,
          background: "radial-gradient(circle, rgba(160,40,255,0.35) 0%, rgba(160,40,255,0.08) 55%, transparent 72%)",
          filter: "blur(4px)",
        }}
      />
      {/* Tiny accent orb mid-left */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 150,
          height: 150,
          top: 320,
          left: -30,
          background: "radial-gradient(circle, rgba(255,41,155,0.25) 0%, transparent 70%)",
          filter: "blur(2px)",
        }}
      />

      {/* ── Scrollable content ── */}
      <div className="relative z-10 h-full overflow-y-auto px-6" style={{ paddingTop: 56, paddingBottom: 32 }}>

        {/* Back button */}
        <button
          className="flex items-center justify-center rounded-full border border-white/10 backdrop-blur-md mb-8"
          style={{ width: 40, height: 40, background: "rgba(255,255,255,0.06)" }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        {/* Brand + headline */}
        <div className="mb-7">
          {/* Pink wordmark */}
          <p
            className="text-xs font-bold tracking-[0.22em] uppercase mb-3"
            style={{ color: "#FF299B" }}
          >
            ConnectSphere
          </p>
          <h1
            className="font-black leading-none tracking-tight mb-2"
            style={{
              fontSize: 34,
              background: "linear-gradient(135deg, #ffffff 30%, rgba(255,41,155,0.85) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Create your<br />account
          </h1>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
            Join South Florida's hottest network — it's free
          </p>
        </div>

        {/* ── Glass card ── */}
        <div
          className="rounded-3xl flex flex-col gap-5 mb-5"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,41,155,0.22)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            boxShadow: "0 0 40px rgba(255,41,155,0.08), inset 0 1px 0 rgba(255,255,255,0.07)",
            padding: "24px 20px",
          }}
        >
          {/* Social row */}
          <div className="flex justify-center gap-3">
            {/* Google */}
            <SocialCircle label="Google" color="rgba(234,67,53,0.7)">
              <GoogleIcon />
            </SocialCircle>
            {/* Apple */}
            <SocialCircle label="Apple" color="rgba(255,255,255,0.55)">
              <AppleIcon />
            </SocialCircle>
            {/* Facebook */}
            <SocialCircle label="Facebook" color="rgba(24,119,242,0.7)">
              <Facebook size={18} />
            </SocialCircle>
            {/* LinkedIn */}
            <SocialCircle label="LinkedIn" color="rgba(10,102,194,0.7)">
              <Linkedin size={18} />
            </SocialCircle>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
            <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.3)" }}>or</span>
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
          </div>

          {/* Tab switcher */}
          <div
            className="flex p-1 rounded-2xl"
            style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <TabBtn active={authMethod === "email"} onClick={() => setAuthMethod("email")} icon={<Mail size={14} />} label="Email" />
            <TabBtn active={authMethod === "phone"} onClick={() => setAuthMethod("phone")} icon={<Smartphone size={14} />} label="Phone" />
          </div>

          {/* Form fields */}
          <div className="flex flex-col gap-3">
            <GlassInput
              type={authMethod === "email" ? "email" : "tel"}
              placeholder={authMethod === "email" ? "your@email.com" : "(305) 000-0000"}
            />
            <GlassInput
              type={showPassword ? "text" : "password"}
              placeholder="Choose a password"
              toggle
              shown={showPassword}
              onToggle={() => setShowPassword(!showPassword)}
            />
            <GlassInput
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirm password"
              toggle
              shown={showConfirmPassword}
              onToggle={() => setShowConfirmPassword(!showConfirmPassword)}
            />
          </div>

          {/* CTA */}
          <button
            className="w-full rounded-2xl text-white font-bold text-base tracking-wide"
            style={{
              height: 54,
              background: "linear-gradient(135deg, #FF299B 0%, #c4006e 50%, #8B00C9 100%)",
              boxShadow: "0 0 32px rgba(255,41,155,0.55), 0 4px 20px rgba(255,41,155,0.3)",
              border: "none",
              letterSpacing: "0.03em",
            }}
          >
            Create Account →
          </button>

          {/* Legal */}
          <p className="text-center leading-relaxed" style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
            By signing up you agree to our{" "}
            <span style={{ color: "rgba(255,41,155,0.7)" }}>Terms</span> and{" "}
            <span style={{ color: "rgba(255,41,155,0.7)" }}>Privacy Policy</span>.
            Must be 18+ to join.
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
          Already have an account?{" "}
          <span className="font-semibold" style={{ color: "#FF299B" }}>Sign In</span>
        </p>

      </div>
    </div>
  );
}

function SocialCircle({ children, color, label }: { children: React.ReactNode; color: string; label: string }) {
  return (
    <button
      title={label}
      className="flex items-center justify-center rounded-full transition-all"
      style={{
        width: 52,
        height: 52,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: `0 0 16px ${color.replace("0.", "0.18")}`,
        color: "white",
      }}
    >
      {children}
    </button>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all"
      style={
        active
          ? {
              background: "linear-gradient(135deg, #FF299B, #c4006e)",
              color: "#fff",
              boxShadow: "0 0 16px rgba(255,41,155,0.4)",
            }
          : { color: "rgba(255,255,255,0.35)" }
      }
    >
      {icon}
      {label}
    </button>
  );
}

function GlassInput({
  type, placeholder, toggle, shown, onToggle,
}: {
  type: string;
  placeholder: string;
  toggle?: boolean;
  shown?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div
      className="relative flex items-center rounded-2xl overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.1)",
        backdropFilter: "blur(8px)",
        height: 52,
        paddingLeft: 16,
        paddingRight: toggle ? 48 : 16,
      }}
    >
      <input
        type={type}
        placeholder={placeholder}
        className="w-full bg-transparent text-white text-sm outline-none"
        style={{ color: "rgba(255,255,255,0.9)" }}
      />
      {toggle && (
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-4 top-1/2 -translate-y-1/2"
          style={{ color: "rgba(255,255,255,0.3)" }}
        >
          {shown ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      )}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="white">
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.56-1.702z" />
    </svg>
  );
}
