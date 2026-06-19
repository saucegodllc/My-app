import { motion } from "framer-motion";
import {
  ArrowLeft, Bookmark, MoreHorizontal,
  MapPin, Zap, MessageCircle, Calendar,
  Linkedin, Twitter, Instagram, Globe,
  CheckCircle2, Hammer, Star, Shield,
} from "lucide-react";

const PINK = "#FF299B";

const INTENT_COLORS: Record<string, string> = {
  network: "#FF299B",
  build:   "#60A5FA",
  hire:    "#34D399",
  learn:   "#FBBF24",
  chill:   "#A78BFA",
};

export type ModalProfile = {
  id: string;
  name: string;
  initials: string;
  role: string;
  location: string;
  distance: string;
  activeNow: boolean;
  intent: string;
  intentLabel: string;
  headline: string;
  description: string;
  skills: string[];
  interested: number;
  image?: string;
  building?: string;
  needs?: string;
  offers?: string;
  greenFlags?: string[];
  dateIdeas?: string[];
  socials?: { linkedin?: boolean; twitter?: boolean; instagram?: boolean; website?: boolean };
};

/**
 * Full-screen Tinder/Bumble-style profile preview.
 * The motion.div IS the animated wrapper — fixed inset-0 z-[999999].
 * Parent wraps usage in <AnimatePresence>.
 */
export function ProfilePreviewModal({
  profile,
  onClose,
  onOpenDoor,
  onMessage,
}: {
  profile: ModalProfile;
  onClose: () => void;
  onOpenDoor?: () => void;
  onMessage?: () => void;
}) {
  const intentColor = INTENT_COLORS[profile.intent] ?? PINK;
  const initials = profile.initials ||
    profile.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <motion.div
      className="fixed inset-0 bg-black"
      style={{ zIndex: 999999 }}
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 250 }}
    >
      {/* Scrollable full-screen container — all content lives here */}
      <div className="h-screen w-full overflow-y-auto bg-black">

        {/* ── Hero image 60vh ── */}
        <div className="relative w-full" style={{ height: "60vh" }}>
          {profile.image ? (
            <img
              src={profile.image}
              alt={profile.name}
              className="w-full h-full object-cover block"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ background: `linear-gradient(160deg, ${intentColor}99 0%, #0d0d1a 60%, #000 100%)` }}
            >
              <div
                className="flex items-center justify-center font-black text-white"
                style={{
                  width: 128, height: 128, borderRadius: 64,
                  background: `linear-gradient(135deg, ${intentColor}dd, ${intentColor}55)`,
                  border: `3px solid ${intentColor}66`,
                  boxShadow: `0 0 48px ${intentColor}55`,
                  fontSize: 44,
                }}
              >
                {initials}
              </div>
            </div>
          )}

          {/* Gradient darkening at bottom of hero */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: "linear-gradient(to top, rgba(0,0,0,0.88) 0%, transparent 55%)" }}
          />

          {/* Top controls — float over the image */}
          <div
            className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-4 pb-6"
            style={{
              zIndex: 2,
              background: "linear-gradient(to bottom, rgba(0,0,0,0.68) 0%, transparent 100%)",
            }}
          >
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full flex items-center justify-center text-white"
              style={{
                background: "rgba(0,0,0,0.45)",
                border: "1px solid rgba(255,255,255,0.15)",
                backdropFilter: "blur(8px)",
              }}
            >
              <ArrowLeft size={18} />
            </button>
            <div className="flex gap-2">
              {[Bookmark, MoreHorizontal].map((Icon, i) => (
                <button
                  key={i}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white"
                  style={{
                    background: "rgba(0,0,0,0.45)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <Icon size={16} />
                </button>
              ))}
            </div>
          </div>

          {/* Name / role / location — pinned to hero bottom */}
          <div className="absolute bottom-0 left-0 right-0 px-5 pb-5" style={{ zIndex: 2 }}>
            <div className="flex items-end justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-white font-black leading-none" style={{ fontSize: 30 }}>
                    {profile.name}
                  </h1>
                  <CheckCircle2 size={18} style={{ color: PINK, flexShrink: 0 }} />
                </div>
                <p className="text-zinc-300 text-sm font-medium mb-1">{profile.role}</p>
                <div className="flex items-center gap-1.5">
                  <MapPin size={13} className="text-zinc-400 shrink-0" />
                  <span className="text-zinc-400 text-sm">{profile.location}</span>
                  <span className="text-zinc-600 mx-1">·</span>
                  <span className="text-zinc-400 text-sm">{profile.distance}</span>
                </div>
              </div>
              {profile.activeNow && (
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full mb-0.5"
                  style={{
                    background: "rgba(0,0,0,0.55)",
                    border: "1px solid rgba(74,222,128,0.4)",
                    backdropFilter: "blur(6px)",
                  }}
                >
                  <span
                    className="inline-block rounded-full"
                    style={{ width: 8, height: 8, background: "#22c55e", boxShadow: "0 0 6px #22c55e" }}
                  />
                  <span className="text-emerald-400 font-bold" style={{ fontSize: 11 }}>Active now</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Scrollable content below the hero ── */}
        <div className="px-5 pt-5" style={{ paddingBottom: 140 }}>

          {/* Intent badge */}
          <div className="mb-4">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
              style={{
                background: `${intentColor}22`,
                color: intentColor,
                border: `1px solid ${intentColor}44`,
              }}
            >
              {profile.intentLabel}
            </span>
          </div>

          {/* Open Door CTA */}
          <button
            onClick={onOpenDoor}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-white font-bold text-sm mb-6"
            style={{
              background: `linear-gradient(135deg, ${PINK}, #a855f7)`,
              boxShadow: `0 6px 32px ${PINK}44`,
              border: "none",
            }}
          >
            <Zap size={16} />
            Open Door — Start a Conversation
          </button>

          {/* About */}
          {profile.description && (
            <div className="mb-6 pb-6 border-b border-zinc-800/50">
              <h3 className="text-white font-bold text-xs uppercase tracking-wider mb-2.5">About</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">{profile.description}</p>
            </div>
          )}

          {/* Looking for */}
          {(profile.needs || profile.intentLabel) && (
            <div
              className="mb-6 p-4 rounded-2xl"
              style={{
                background: `${intentColor}0d`,
                border: `1px solid ${intentColor}30`,
              }}
            >
              <p
                className="text-xs font-bold uppercase tracking-wider mb-1.5"
                style={{ color: intentColor }}
              >
                Looking for
              </p>
              <p className="text-zinc-200 text-sm font-medium">{profile.needs ?? profile.intentLabel}</p>
            </div>
          )}

          {/* Build / Need / Offer cards */}
          {(profile.building || profile.needs || profile.offers) && (
            <div
              className="rounded-2xl overflow-hidden mb-6"
              style={{ background: "#0f0f0f", border: "1px solid rgba(39,39,42,0.5)" }}
            >
              {[
                { Icon: Hammer, color: "#60A5FA", label: "What I'm Building", value: profile.building },
                { Icon: Star,   color: PINK,      label: "What I Need",       value: profile.needs },
                { Icon: Shield, color: "#4ADE80", label: "What I Offer",      value: profile.offers },
              ].filter(r => r.value).map(({ Icon, color, label, value }, idx, arr) => (
                <div
                  key={label}
                  className="flex gap-3 p-4"
                  style={{ borderBottom: idx < arr.length - 1 ? "1px solid rgba(39,39,42,0.5)" : "none" }}
                >
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: `${color}18` }}
                  >
                    <Icon size={15} style={{ color }} />
                  </div>
                  <div>
                    <p className="text-xs font-bold mb-1" style={{ color }}>{label}</p>
                    <p className="text-zinc-300 text-sm leading-relaxed">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Interests */}
          {profile.skills.length > 0 && (
            <div className="mb-6">
              <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-3">Interests</h3>
              <div className="flex flex-wrap gap-2">
                {profile.skills.map(s => (
                  <span
                    key={s}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold text-white"
                    style={{ background: `${PINK}18`, border: `1px solid ${PINK}35` }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Green Flags */}
          {profile.greenFlags && profile.greenFlags.length > 0 && (
            <div className="mb-6">
              <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-3">Green Flags</h3>
              <div className="flex flex-wrap gap-2">
                {profile.greenFlags.map(f => (
                  <span
                    key={f}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-emerald-300"
                    style={{ background: "#4ade8015", border: "1px solid rgba(74,222,128,0.4)" }}
                  >
                    <CheckCircle2 size={12} /> {f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Date Ideas */}
          {profile.dateIdeas && profile.dateIdeas.length > 0 && (
            <div className="mb-6">
              <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-3">Date Ideas</h3>
              <div className="flex flex-wrap gap-2">
                {profile.dateIdeas.map(d => (
                  <span
                    key={d}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold"
                    style={{ background: `${PINK}14`, border: `1px solid ${PINK}30`, color: "#fda4c8" }}
                  >
                    📍 {d}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Socials */}
          {profile.socials && Object.values(profile.socials).some(Boolean) && (
            <div className="mb-4">
              <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-3">Socials</h3>
              <div className="flex gap-3">
                {profile.socials.linkedin && (
                  <a href="#" onClick={e => e.preventDefault()}
                    className="w-11 h-11 rounded-2xl flex items-center justify-center text-blue-400"
                    style={{ background: "#1d4ed810", border: "1px solid #27272a" }}>
                    <Linkedin size={18} />
                  </a>
                )}
                {profile.socials.twitter && (
                  <a href="#" onClick={e => e.preventDefault()}
                    className="w-11 h-11 rounded-2xl flex items-center justify-center text-sky-400"
                    style={{ background: "#0ea5e910", border: "1px solid #27272a" }}>
                    <Twitter size={18} />
                  </a>
                )}
                {profile.socials.instagram && (
                  <a href="#" onClick={e => e.preventDefault()}
                    className="w-11 h-11 rounded-2xl flex items-center justify-center"
                    style={{ background: `${PINK}10`, border: "1px solid #27272a", color: PINK }}>
                    <Instagram size={18} />
                  </a>
                )}
                {profile.socials.website && (
                  <a href="#" onClick={e => e.preventDefault()}
                    className="w-11 h-11 rounded-2xl flex items-center justify-center text-zinc-400"
                    style={{ background: "#71717a10", border: "1px solid #27272a" }}>
                    <Globe size={18} />
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom action bar — sits at the bottom of the fixed modal ── */}
      <div
        className="absolute bottom-0 left-0 right-0 grid grid-cols-3 gap-3 px-4 py-4"
        style={{
          zIndex: 3,
          background: "rgba(0,0,0,0.96)",
          borderTop: "1px solid rgba(39,39,42,0.5)",
          backdropFilter: "blur(20px)",
        }}
      >
        <button
          onClick={onMessage}
          className="flex flex-col items-center gap-1.5 py-3.5 rounded-2xl text-zinc-300 font-bold text-[11px]"
          style={{ background: "#111", border: "1px solid rgba(63,63,70,0.5)" }}
        >
          <MessageCircle size={18} />
          Message
        </button>
        <button
          onClick={onOpenDoor}
          className="flex flex-col items-center gap-1.5 py-3.5 rounded-2xl text-white font-bold text-[11px]"
          style={{
            background: `linear-gradient(135deg, ${PINK}, #a855f7)`,
            boxShadow: `0 4px 24px ${PINK}55`,
            border: "none",
          }}
        >
          <Zap size={18} />
          Open Door
        </button>
        <button
          className="flex flex-col items-center gap-1.5 py-3.5 rounded-2xl text-zinc-300 font-bold text-[11px]"
          style={{ background: "#111", border: "1px solid rgba(63,63,70,0.5)" }}
        >
          <Calendar size={18} />
          Plan Date
        </button>
      </div>
    </motion.div>
  );
}
