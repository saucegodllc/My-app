import React, { useState } from "react";
import { ChevronLeft, Eye, EyeOff } from "lucide-react";

export function CleanModern() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<"email" | "phone">("email");

  return (
    <div className="w-[390px] h-[844px] bg-[#f9f9f9] text-[#111111] font-sans overflow-y-auto flex flex-col relative shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-12 pb-4 bg-[#f9f9f9] sticky top-0 z-10">
        <button className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-[#FF299B] rounded-md flex items-center justify-center">
            <div className="w-3 h-3 bg-white rounded-sm" />
          </div>
          <span className="font-semibold text-lg tracking-tight">ConnectSphere</span>
        </div>
        <div className="w-10" /> {/* Spacer */}
      </div>

      <div className="px-6 pb-8 flex flex-col flex-1">
        {/* Titles */}
        <div className="mt-4 mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2 text-gray-900">Create account</h1>
          <p className="text-gray-500 text-sm">Join ConnectSphere — it's free</p>
        </div>

        {/* Social Grid */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          <button className="flex flex-col items-center justify-center gap-2 py-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
            <svg className="w-6 h-6" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.16v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.16C1.43 8.55 1 10.22 1 12s.43 3.45 1.16 4.93l3.68-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.16 7.07l3.68,2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span className="text-sm font-medium text-gray-700">Google</span>
          </button>
          
          <button className="flex flex-col items-center justify-center gap-2 py-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.19 2.31-.88 3.5-.8 1.56.09 2.89.62 3.73 1.83-3.12 1.84-2.61 5.98.5 7.21-.73 1.76-1.57 3.32-2.81 3.93zm-4.32-14.2c.2-1.99-1.39-3.79-3.32-3.95-.3 2.1 1.51 3.94 3.32 3.95z"/>
            </svg>
            <span className="text-sm font-medium text-gray-700">Apple</span>
          </button>

          <button className="flex flex-col items-center justify-center gap-2 py-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="#1877F2">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            <span className="text-sm font-medium text-gray-700">Facebook</span>
          </button>

          <button className="flex flex-col items-center justify-center gap-2 py-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="#0A66C2">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
            <span className="text-sm font-medium text-gray-700">LinkedIn</span>
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4 mb-8">
          <div className="flex-1 h-px bg-gray-200"></div>
          <span className="text-sm text-gray-400 font-medium">or</span>
          <div className="flex-1 h-px bg-gray-200"></div>
        </div>

        {/* Tabs */}
        <div className="flex mb-6 border-b border-gray-200">
          <button 
            onClick={() => setActiveTab("email")}
            className={`flex-1 pb-3 text-sm font-medium transition-colors relative ${activeTab === "email" ? "text-gray-900" : "text-gray-400"}`}
          >
            Email
            {activeTab === "email" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF299B]" />
            )}
          </button>
          <button 
            onClick={() => setActiveTab("phone")}
            className={`flex-1 pb-3 text-sm font-medium transition-colors relative ${activeTab === "phone" ? "text-gray-900" : "text-gray-400"}`}
          >
            Phone Number
            {activeTab === "phone" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF299B]" />
            )}
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4 mb-8">
          <div>
            <input 
              type={activeTab === "email" ? "email" : "tel"} 
              placeholder={activeTab === "email" ? "Email address" : "Phone number"} 
              className="w-full px-4 py-3.5 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#FF299B] focus:border-[#FF299B] transition-all"
            />
          </div>
          <div className="relative">
            <input 
              type={showPassword ? "text" : "password"} 
              placeholder="Password" 
              className="w-full px-4 py-3.5 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#FF299B] focus:border-[#FF299B] transition-all"
            />
            <button 
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          <div className="relative">
            <input 
              type={showConfirmPassword ? "text" : "password"} 
              placeholder="Confirm password" 
              className="w-full px-4 py-3.5 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#FF299B] focus:border-[#FF299B] transition-all"
            />
            <button 
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Legal */}
        <p className="text-xs text-gray-500 mb-6 leading-relaxed text-center px-4">
          By signing up you agree to our <a href="#" className="text-gray-900 underline underline-offset-2">Terms of Service</a> and <a href="#" className="text-gray-900 underline underline-offset-2">Privacy Policy</a>. Must be 18 or older to join.
        </p>

        {/* CTA */}
        <button className="w-full bg-[#FF299B] text-white font-semibold py-4 rounded-xl hover:bg-[#E01E85] transition-colors active:scale-[0.98]">
          Create Account
        </button>

        {/* Footer */}
        <div className="mt-8 text-center pb-8">
          <p className="text-sm text-gray-500">
            Already have an account?{' '}
            <a href="#" className="font-semibold text-[#FF299B] hover:underline underline-offset-2">Sign In</a>
          </p>
        </div>
      </div>
    </div>
  );
}
