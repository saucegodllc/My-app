import React, { useState } from "react";
import { ChevronLeft, Eye, EyeOff, Mail, Phone } from "lucide-react";

export function CinematicDark() {
  const [tab, setTab] = useState<"email" | "phone">("email");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <div className="flex justify-center items-start min-h-screen bg-[#050505] p-4 font-sans sm:items-center">
      <div className="w-[390px] min-h-[844px] bg-[#0a0a0a] rounded-[40px] shadow-2xl overflow-hidden relative border border-white/5 flex flex-col text-white">
        
        {/* Cinematic Pink Glow Background */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[300px] bg-[#FF299B] rounded-full blur-[120px] opacity-20 pointer-events-none"></div>

        {/* Header */}
        <header className="pt-14 pb-4 px-6 relative z-10 flex items-center">
          <button className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-colors">
            <ChevronLeft size={20} />
          </button>
        </header>

        {/* Title Section */}
        <div className="px-8 pt-2 pb-6 relative z-10">
          <h1 className="text-[32px] font-bold leading-tight tracking-tight mb-2">
            Create account
          </h1>
          <p className="text-[#FF299B] font-medium opacity-90 text-[15px]">
            Join ConnectSphere — it's free
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-8 pb-8 no-scrollbar relative z-10">
          
          {/* Social Logins */}
          <div className="space-y-3 mb-8">
            <button className="w-full h-[52px] bg-[#141414] rounded-full flex items-center px-5 border border-white/5 relative overflow-hidden group hover:border-[#EA4335]/30 transition-colors">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#EA4335] opacity-50"></div>
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#4285F4" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <span className="text-[15px] font-medium text-white/90 group-hover:text-white">Continue with Google</span>
            </button>

            <button className="w-full h-[52px] bg-[#141414] rounded-full flex items-center px-5 border border-white/5 relative overflow-hidden group hover:border-white/30 transition-colors">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-white opacity-50"></div>
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="white">
                <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.56-1.702z" />
              </svg>
              <span className="text-[15px] font-medium text-white/90 group-hover:text-white">Continue with Apple</span>
            </button>

            <button className="w-full h-[52px] bg-[#141414] rounded-full flex items-center px-5 border border-white/5 relative overflow-hidden group hover:border-[#1877F2]/30 transition-colors">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#1877F2] opacity-50"></div>
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="#1877F2">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              <span className="text-[15px] font-medium text-white/90 group-hover:text-white">Continue with Facebook</span>
            </button>

            <button className="w-full h-[52px] bg-[#141414] rounded-full flex items-center px-5 border border-white/5 relative overflow-hidden group hover:border-[#0A66C2]/30 transition-colors">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#0A66C2] opacity-50"></div>
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="#0A66C2">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              <span className="text-[15px] font-medium text-white/90 group-hover:text-white">Continue with LinkedIn</span>
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center justify-center mb-8">
            <div className="h-px bg-white/10 flex-1"></div>
            <span className="px-4 text-[13px] text-white/40 uppercase tracking-wider font-semibold">or</span>
            <div className="h-px bg-white/10 flex-1"></div>
          </div>

          {/* Tab Switcher */}
          <div className="bg-[#141414] p-1 rounded-full flex mb-6 border border-white/5">
            <button 
              onClick={() => setTab("email")}
              className={`flex-1 flex items-center justify-center py-2.5 rounded-full text-[14px] font-medium transition-all ${tab === "email" ? "bg-[#202020] text-white shadow-lg border border-white/10" : "text-white/50 hover:text-white/80"}`}
            >
              <Mail className="w-4 h-4 mr-2" />
              Email
            </button>
            <button 
              onClick={() => setTab("phone")}
              className={`flex-1 flex items-center justify-center py-2.5 rounded-full text-[14px] font-medium transition-all ${tab === "phone" ? "bg-[#202020] text-white shadow-lg border border-white/10" : "text-white/50 hover:text-white/80"}`}
            >
              <Phone className="w-4 h-4 mr-2" />
              Phone
            </button>
          </div>

          {/* Form Fields */}
          <div className="space-y-4 mb-8">
            {tab === "email" ? (
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-white/70 pl-2">Email Address</label>
                <input 
                  type="email" 
                  placeholder="your@email.com" 
                  defaultValue="alex.morgan@example.com"
                  className="w-full bg-[#141414] border border-white/10 rounded-2xl px-5 py-4 text-[15px] text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF299B]/50 focus:ring-1 focus:ring-[#FF299B]/50 transition-all"
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-white/70 pl-2">Phone Number</label>
                <div className="flex gap-2">
                  <div className="w-[80px] bg-[#141414] border border-white/10 rounded-2xl flex items-center justify-center text-[15px] text-white">
                    +1
                  </div>
                  <input 
                    type="tel" 
                    placeholder="(555) 000-0000" 
                    className="flex-1 bg-[#141414] border border-white/10 rounded-2xl px-5 py-4 text-[15px] text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF299B]/50 focus:ring-1 focus:ring-[#FF299B]/50 transition-all"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-white/70 pl-2">Password</label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  placeholder="Choose a password" 
                  defaultValue="••••••••"
                  className="w-full bg-[#141414] border border-white/10 rounded-2xl px-5 py-4 text-[15px] text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF299B]/50 focus:ring-1 focus:ring-[#FF299B]/50 transition-all"
                />
                <button 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-white/70 pl-2">Confirm Password</label>
              <div className="relative">
                <input 
                  type={showConfirmPassword ? "text" : "password"} 
                  placeholder="Confirm password" 
                  defaultValue="••••••••"
                  className="w-full bg-[#141414] border border-white/10 rounded-2xl px-5 py-4 text-[15px] text-white placeholder:text-white/30 focus:outline-none focus:border-[#FF299B]/50 focus:ring-1 focus:ring-[#FF299B]/50 transition-all"
                />
                <button 
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
          </div>

          {/* Legal Text */}
          <p className="text-[12px] text-center text-white/40 leading-relaxed mb-6 px-4">
            By signing up you agree to our <a href="#" className="text-[#FF299B] hover:underline">Terms of Service</a> and <a href="#" className="text-[#FF299B] hover:underline">Privacy Policy</a>. Must be 18 or older to join.
          </p>

          {/* CTA */}
          <button className="w-full h-[56px] rounded-2xl bg-gradient-to-r from-[#FF299B] to-[#FF4E6B] text-white font-bold text-[16px] shadow-[0_0_30px_rgba(255,41,155,0.4)] hover:shadow-[0_0_40px_rgba(255,41,155,0.6)] transition-shadow flex items-center justify-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out rounded-2xl"></div>
            <span className="relative z-10">Create Account</span>
          </button>

          {/* Footer */}
          <div className="mt-8 text-center pb-6">
            <p className="text-[14px] text-white/60">
              Already have an account? <a href="#" className="text-[#FF299B] font-semibold hover:underline">Sign In</a>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
