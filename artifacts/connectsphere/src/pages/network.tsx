import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase,
  Hammer,
  BookOpen,
  Coffee,
  MapPin,
  Zap,
  X,
  Send,
  Bookmark,
  MessageCircle,
  Star,
  Globe,
  Linkedin,
  Twitter,
  ExternalLink,
  Bell,
  Search,
  Flame,
  Calendar,
  Plus,
  Mic,
  Users,
  ChevronRight,
  Radio,
  Share2,
  Tag,
  ToggleLeft,
  LocateFixed,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { Nav } from "@/components/layout/nav";
import { ProfilePreviewModal, type ModalProfile } from "@/components/ProfilePreviewModal";
import { cn } from "@/lib/utils";

const PINK = "#FF299B";

const INTENT_TABS = [
  { id: "network", label: "Network", icon: Globe },
  { id: "build",   label: "Build",   icon: Hammer },
  { id: "hire",    label: "Hire",    icon: Briefcase },
  { id: "learn",   label: "Learn",   icon: BookOpen },
  { id: "chill",   label: "Chill",   icon: Coffee },
];

const INTENT_COLORS: Record<string, string> = {
  network: "#FF299B",
  build:   "#60A5FA",
  hire:    "#34D399",
  learn:   "#FBBF24",
  chill:   "#A78BFA",
};

type Opp = {
  id: string; name: string; initials: string; role: string;
  location: string; distance: string; activeNow: boolean;
  intent: string; intentLabel: string; headline: string;
  description: string; skills: string[]; interested: number;
  image?: string;
  building?: string; needs?: string; offers?: string;
  greenFlags?: string[];
  dateIdeas?: string[];
  socials?: { linkedin?: boolean; twitter?: boolean; instagram?: boolean; website?: boolean };
};

const OPPS: Opp[] = [
  {
    id: "1", name: "Alex Carter", initials: "AC", role: "Founder & CEO",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&q=80",
    location: "Miami, FL", distance: "0.2 mi", activeNow: true,
    intent: "build", intentLabel: "Co-founder for AI Startup",
    headline: "Co-founder for AI Startup 🚀",
    description: "Building an AI tool that helps creators 10× their business. Need a technical co-founder who's obsessed with shipping fast and thinking long-term.",
    skills: ["AI/ML", "Product", "Growth", "Startups"], interested: 12,
    building: "AI platform that helps content creators automate & scale.",
    needs: "Technical co-founder with AI/ML experience.",
    offers: "Product strategy, growth, funding connections.",
    greenFlags: ["Communicates clearly", "Ships fast", "Long-term thinker"],
    dateIdeas: ["Coffee at Wynwood Café", "Cowork at WeWork Brickell", "Pitch deck session"],
    socials: { linkedin: true, twitter: true, instagram: true, website: true },
  },
  {
    id: "2", name: "Jasmine Lee", initials: "JL", role: "Creative Director",
    image: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800&q=80",
    location: "Wynwood, FL", distance: "3.3 mi", activeNow: true,
    intent: "hire", intentLabel: "Photographer for Event Tonight",
    headline: "Photographer for Event Tonight 📸",
    description: "Private event in Wynwood. High-end brand photography needed. Paid gig, tonight 8pm. Portfolio must include editorial or lifestyle work.",
    skills: ["Events", "Photography", "Branding"], interested: 7,
    building: "Creative agency for lifestyle brands.",
    needs: "Skilled photographer available short-notice.",
    offers: "Paid gig + portfolio + referrals.",
    greenFlags: ["Pays on time", "Clear creative brief", "Repeat work available"],
    dateIdeas: ["Shoot walk in Wynwood Walls", "Portfolio review session", "Creative dinner at Swan"],
    socials: { instagram: true, twitter: true },
  },
  {
    id: "3", name: "Marcus Webb", initials: "MW", role: "Pre-seed Investor",
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=800&q=80",
    location: "Brickell, FL", distance: "1.1 mi", activeNow: false,
    intent: "network", intentLabel: "Investor Looking for Founders",
    headline: "Backing bold ideas in Web3 & AI 💡",
    description: "Looking for early-stage founders with unfair advantages. Let's grab coffee in Brickell. No decks required — just come with conviction.",
    skills: ["VC", "Web3", "AI", "Fintech"], interested: 31,
    building: "Deal flow in South Florida.",
    needs: "Ambitious founders, early stage.",
    offers: "$50k–$500k checks + network.",
    greenFlags: ["Founder-friendly terms", "Hands-on support", "Fast decisions"],
    dateIdeas: ["Coffee at DIRT", "Walk along Brickell Bayfront", "Drinks at Sugar"],
    socials: { linkedin: true, website: true },
  },
  {
    id: "4", name: "Sofia Mendez", initials: "SM", role: "Senior Engineer",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&q=80",
    location: "Coral Gables, FL", distance: "3.8 mi", activeNow: true,
    intent: "learn", intentLabel: "Seeking Mentorship",
    headline: "Leveling up from IC to founder 🎯",
    description: "6 years at FAANG, ready to build something of my own. Looking for founders who've made the jump and are willing to share the real story.",
    skills: ["React", "Node", "AWS", "System Design"], interested: 7,
    building: "Exploring B2B SaaS ideas in HR tech.",
    needs: "Mentors who've gone from IC to founder.",
    offers: "Engineering skills + sweat equity.",
    greenFlags: ["Highly motivated", "Strong execution", "Coachable"],
    dateIdeas: ["Lunch at Books & Books", "Cowork session", "Hack night in Coral Gables"],
    socials: { linkedin: true, twitter: true, instagram: true },
  },
];

const NEAR_YOU = [
  { id: "n1", initials: "SK", name: "Sarah K.", distance: "0.2 mi", headline: "Looking for UI/UX Designer", active: true },
  { id: "n2", initials: "MD", name: "Mike D.", distance: "0.3 mi", headline: "Let's build something cool", active: true },
  { id: "n3", initials: "LM", name: "Leila M.", distance: "0.4 mi", headline: "Investor looking for founders", active: false },
  { id: "n4", initials: "JW", name: "James Wilson", distance: "0.8 mi", headline: "Gym partner in Brickell", active: true },
];

const HOT_CONNECTIONS = [
  { id: "h1", initials: "SK", name: "Sarah K.", distance: "0.2 mi" },
  { id: "h2", initials: "MD", name: "Mike D.", distance: "0.3 mi" },
  { id: "h3", initials: "LM", name: "Leila M.", distance: "0.4 mi" },
  { id: "h4", initials: "CT", name: "Chris T.", distance: "0.5 mi" },
  { id: "h5", initials: "AR", name: "Ava R.", distance: "0.6 mi" },
  { id: "h6", initials: "DB", name: "Daniel B.", distance: "0.7 mi" },
];

const LIVE_ROOMS = [
  { id: "r1", name: "Startup Founders Room", count: 14, color: "#FF299B" },
  { id: "r2", name: "Designers Connect", count: 8, color: "#60A5FA" },
  { id: "r3", name: "Investors Hangout", count: 21, color: "#34D399" },
  { id: "r4", name: "AI Builders", count: 11, color: "#FBBF24" },
];

const QUICK_ACTIONS = [
  { icon: Calendar, label: "Events", sub: "Happening now" },
  { icon: Plus, label: "Create Opportunity", sub: "Post what you need" },
  { icon: Mic, label: "Live Rooms", sub: "Talk & connect" },
  { icon: Bookmark, label: "Saved", sub: "Your saved people" },
  { icon: Users, label: "Requests", sub: "Connections in" },
  { icon: Bell, label: "Notifications", sub: "Stay updated" },
];

function Avatar({ initials, color, size = "md" }: { initials: string; color?: string; size?: "xs" | "sm" | "md" | "lg" | "xl" }) {
  const sizes = { xs: "w-6 h-6 text-[9px]", sm: "w-9 h-9 text-xs", md: "w-11 h-11 text-sm", lg: "w-14 h-14 text-base", xl: "w-20 h-20 text-xl" };
  const c = color || PINK;
  return (
    <div className={cn("rounded-full flex items-center justify-center font-bold text-white shrink-0", sizes[size])}
      style={{ background: `linear-gradient(135deg, ${c}cc, ${c}55)`, border: `2px solid ${c}44` }}>
      {initials}
    </div>
  );
}

function ActiveDot() {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
    </span>
  );
}

function OpenDoorModal({ person, onClose }: { person: Opp; onClose: () => void }) {
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const msg = `Hey ${person.name.split(" ")[0]}! I love what you're building with the AI tool. I've worked on similar things and would love to connect and see how we can build something great together.`;

  return (
    <motion.div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div className="relative w-full max-w-sm bg-zinc-900 border border-zinc-700/60 rounded-2xl overflow-hidden"
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
        transition={{ type: "spring", damping: 26, stiffness: 300 }}>
        <div className="px-5 pt-5 pb-2 flex items-center justify-between">
          <div>
            <p className="text-white font-bold text-lg">Open Door</p>
            <p className="text-zinc-400 text-xs">Send a smart introduction that gets replies.</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white p-1 rounded-full hover:bg-zinc-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4">
          <div className="flex items-center gap-3 mb-4 p-3 bg-zinc-800/50 rounded-xl border border-zinc-700/30">
            <Avatar initials={person.initials} color={INTENT_COLORS[person.intent]} size="sm" />
            <div>
              <p className="text-white font-semibold text-sm">{person.name}</p>
              <p className="text-zinc-400 text-xs">{person.role}</p>
            </div>
          </div>

          <div className="relative bg-zinc-800/60 rounded-xl p-3.5 mb-3 border border-zinc-700/30">
            <div className="absolute top-2 right-2">
              <Sparkles className="w-3 h-3 text-pink-400" />
            </div>
            <p className="text-zinc-200 text-sm leading-relaxed">{msg}</p>
          </div>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a personal note (optional)"
            maxLength={100}
            rows={2}
            className="w-full bg-zinc-800/50 border border-zinc-700/40 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-pink-500/50 transition-colors resize-none"
          />
          <p className="text-right text-zinc-600 text-xs mt-0.5">{note.length}/100</p>
        </div>

        <div className="px-5 pb-5 space-y-3">
          {sent ? (
            <motion.div className="w-full py-3 rounded-xl flex items-center justify-center gap-2 bg-emerald-500/20 border border-emerald-500/30"
              initial={{ scale: 0.95 }} animate={{ scale: 1 }}>
              <Star className="w-4 h-4 text-emerald-400" fill="currentColor" />
              <span className="text-emerald-400 font-semibold text-sm">Message sent!</span>
            </motion.div>
          ) : (
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => setSent(true)}
              className="w-full py-3 rounded-xl flex items-center justify-center gap-2 font-bold text-white text-sm"
              style={{ background: `linear-gradient(135deg, ${PINK}, #a855f7)` }}>
              <Zap className="w-4 h-4" />
              Open Door & Connect
            </motion.button>
          )}
          <p className="text-center text-zinc-600 text-xs">This message will be sent instantly.</p>

          {/* Recent open doors */}
          <div className="pt-2 border-t border-zinc-800">
            <p className="text-zinc-500 text-xs font-semibold mb-2">Recent Open Doors</p>
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {["AC","JL","MW","SM","PR"].map((i) => (
                  <Avatar key={i} initials={i} size="xs" color={PINK} />
                ))}
              </div>
              <span className="text-zinc-500 text-xs">+8 this week</span>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function CreateOpportunityPanel() {
  const [activeMode, setActiveMode] = useState("build");
  const [anon, setAnon] = useState(false);
  const modes = ["News","Build","Hire","Learn","Chill"];

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-bold text-base">Create Opportunity</h3>
        <motion.button whileTap={{ scale: 0.96 }}
          className="px-4 py-1.5 rounded-full text-xs font-bold text-white"
          style={{ background: `linear-gradient(135deg, ${PINK}, #a855f7)` }}>
          Post
        </motion.button>
      </div>

      <div className="mb-3">
        <input placeholder="What are you looking for? (Co-founders, Designers, Mentors…)"
          className="w-full bg-zinc-800/60 border border-zinc-700/40 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-pink-500/40 transition-colors" />
      </div>

      <div className="flex gap-1.5 mb-3">
        {modes.map(m => (
          <button key={m} onClick={() => setActiveMode(m.toLowerCase())}
            className={cn("flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition-all",
              activeMode === m.toLowerCase() ? "text-white" : "text-zinc-500 bg-zinc-800 hover:text-zinc-300")}
            style={activeMode === m.toLowerCase() ? { background: `linear-gradient(135deg, ${PINK}cc, #a855f788)` } : {}}>
            {m}
          </button>
        ))}
      </div>

      <textarea placeholder="Describe what you're looking for or what you need…" rows={3}
        className="w-full bg-zinc-800/60 border border-zinc-700/40 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-pink-500/40 transition-colors resize-none mb-3" />

      <div className="relative mb-3">
        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
        <input placeholder="Add tags (e.g. AI, Marketing, Fintech…)"
          className="w-full bg-zinc-800/60 border border-zinc-700/40 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-pink-500/40 transition-colors" />
      </div>

      <div className="flex items-center gap-2 mb-3">
        <LocateFixed className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
        <input placeholder="Add Location" defaultValue="Miami, FL"
          className="flex-1 bg-zinc-800/60 border border-zinc-700/40 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-pink-500/40 transition-colors" />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-zinc-400 text-sm">Post Anonymously</span>
        <button onClick={() => setAnon(v => !v)}
          className={cn("w-10 h-5 rounded-full transition-all relative", anon ? "" : "bg-zinc-700")}
          style={anon ? { background: `linear-gradient(135deg, ${PINK}, #a855f7)` } : {}}>
          <span className={cn("absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all", anon ? "right-0.5" : "left-0.5")} />
        </button>
      </div>
    </div>
  );
}

function OppCard({ opp, onOpenDoor, onProfile }: { opp: Opp; onOpenDoor: (o: Opp) => void; onProfile: (o: Opp) => void }) {
  const [saved, setSaved] = useState(false);
  const c = INTENT_COLORS[opp.intent];

  return (
    <motion.div layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }} transition={{ type: "spring", damping: 22, stiffness: 220 }}
      className="bg-zinc-900 border border-zinc-800/80 rounded-2xl overflow-hidden hover:border-zinc-700/60 transition-colors cursor-pointer"
      onClick={() => onProfile(opp)}>
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar initials={opp.initials} color={c} />
              {opp.activeNow && <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-zinc-900" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-white font-semibold text-sm">{opp.name}</p>
                {opp.activeNow && <span className="text-emerald-400 text-[10px] font-medium">● Active now</span>}
              </div>
              <div className="flex items-center gap-1">
                <MapPin className="w-3 h-3 text-zinc-500" />
                <span className="text-zinc-500 text-xs">{opp.distance}</span>
              </div>
            </div>
          </div>
          <motion.button whileTap={{ scale: 0.85 }} onClick={e => { e.stopPropagation(); setSaved(s => !s); }}
            className={cn("p-1.5 rounded-lg transition-colors", saved ? "text-pink-400" : "text-zinc-600 hover:text-zinc-400")}>
            <Bookmark className="w-4 h-4" fill={saved ? "currentColor" : "none"} />
          </motion.button>
        </div>

        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold mb-2"
          style={{ background: `${c}18`, color: c, border: `1px solid ${c}30` }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />
          LOOKING FOR
        </div>

        <p className="text-white font-bold text-[15px] leading-tight mb-1.5">{opp.headline}</p>
        <p className="text-zinc-400 text-sm leading-relaxed mb-3 line-clamp-2">{opp.description}</p>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {opp.skills.map(s => (
            <span key={s} className="px-2.5 py-0.5 rounded-full text-xs bg-zinc-800 text-zinc-400 border border-zinc-700/50">{s}</span>
          ))}
        </div>

        <div className="flex items-center gap-2 mb-3">
          <div className="flex -space-x-1.5">
            {Array.from({ length: Math.min(3, Math.ceil(opp.interested / 5)) }).map((_, i) => (
              <div key={i} className="w-5 h-5 rounded-full bg-zinc-700 border border-zinc-900 flex items-center justify-center text-[8px] text-zinc-400 font-bold">
                {String.fromCharCode(65 + i)}
              </div>
            ))}
          </div>
          <span className="text-zinc-500 text-xs">{opp.interested} interested</span>
        </div>

        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          <motion.button whileTap={{ scale: 0.96 }} onClick={() => onOpenDoor(opp)}
            className="flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold text-white"
            style={{ background: `linear-gradient(135deg, ${PINK}, #a855f7)` }}>
            <Zap className="w-3.5 h-3.5" /> Open Door
          </motion.button>
          <motion.button whileTap={{ scale: 0.96 }}
            className="py-2 px-3 rounded-xl text-xs font-semibold text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/50 transition-all">
            Save
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

export default function NetworkPage() {
  const [activeIntent, setActiveIntent] = useState("network");
  const [openDoorPerson, setOpenDoorPerson] = useState<Opp | null>(null);
  const [profilePerson, setProfilePerson] = useState<Opp | null>(null);
  const [search, setSearch] = useState("");

  const filtered = OPPS.filter(o => {
    const matchIntent = activeIntent === "network" || o.intent === activeIntent;
    const matchSearch = !search || o.name.toLowerCase().includes(search.toLowerCase())
      || o.headline.toLowerCase().includes(search.toLowerCase())
      || o.skills.some(s => s.toLowerCase().includes(search.toLowerCase()));
    return matchIntent && matchSearch;
  });

  return (
    <div className="min-h-screen bg-zinc-950 pb-32">
      <Nav />

      {/* Page header tagline */}
      <div className="max-w-2xl mx-auto pt-20 px-4">
        <div className="py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              <span style={{ color: PINK }}>Opportunities</span> Find You.
            </h1>
            <p className="text-zinc-500 text-sm mt-0.5">Browse, connect, and grow without swiping</p>
          </div>
          <div className="flex items-center gap-2">
            <motion.button whileTap={{ scale: 0.92 }}
              className="p-2 rounded-xl bg-zinc-800/80 border border-zinc-700/50 text-zinc-400 hover:text-white transition-colors">
              <Search className="w-5 h-5" />
            </motion.button>
            <motion.button whileTap={{ scale: 0.92 }}
              className="relative p-2 rounded-xl bg-zinc-800/80 border border-zinc-700/50 text-zinc-400 hover:text-white transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full" style={{ background: PINK }} />
            </motion.button>
          </div>
        </div>

        {/* Intent tabs */}
        <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1 scrollbar-none">
          {INTENT_TABS.map(({ id, label, icon: Icon }) => {
            const active = activeIntent === id;
            const c = INTENT_COLORS[id];
            return (
              <motion.button key={id} onClick={() => setActiveIntent(id)} whileTap={{ scale: 0.95 }}
                className={cn("flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap border shrink-0 transition-all",
                  active ? "text-white border-transparent" : "text-zinc-400 bg-zinc-800/60 border-zinc-700/50 hover:border-zinc-600")}
                style={active ? { background: `linear-gradient(135deg, ${c}dd, ${c}88)`, borderColor: `${c}33` } : {}}>
                <Icon className="w-3.5 h-3.5" />
                {label}
              </motion.button>
            );
          })}
        </div>

        {/* Feed sub-tabs */}
        <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1 scrollbar-none">
          {["For You", "Near You", "Trending", "New"].map((t, i) => (
            <button key={t}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors",
                i === 0 ? "bg-zinc-800 text-white border border-zinc-600/60" : "text-zinc-500 hover:text-zinc-300")}>{t}</button>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search skills, names, opportunities…"
            className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-pink-500/40 transition-colors" />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* === SECTION 1: Opportunity Feed === */}
        <div className="mb-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4" style={{ color: PINK }} />
              <h2 className="text-white font-bold text-sm">Discover Opportunities</h2>
            </div>
            <div className="flex items-center gap-1 text-zinc-500 text-xs">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: PINK }} />
              {filtered.length} live
            </div>
          </div>

          <div className="space-y-3 mb-6">
            <AnimatePresence mode="popLayout">
              {filtered.map(opp => (
                <OppCard key={opp.id} opp={opp} onOpenDoor={setOpenDoorPerson} onProfile={setProfilePerson} />
              ))}
            </AnimatePresence>
            {filtered.length === 0 && (
              <div className="text-center py-12">
                <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center mx-auto mb-3">
                  <Users className="w-7 h-7 text-zinc-600" />
                </div>
                <p className="text-zinc-400 font-semibold">No opportunities found</p>
                <p className="text-zinc-600 text-sm mt-1">Try switching intent or clearing search</p>
              </div>
            )}
          </div>
        </div>

        {/* === SECTION 2: People Near You === */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4" style={{ color: PINK }} />
              <h2 className="text-white font-bold text-sm">People Near You</h2>
              <span className="text-zinc-600 text-xs">Miami, FL</span>
            </div>
            <button className="flex items-center gap-1 text-xs font-semibold" style={{ color: PINK }}>
              Map <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-2.5">
            {NEAR_YOU.map(p => (
              <motion.div key={p.id} whileTap={{ scale: 0.98 }}
                className="flex items-center justify-between p-3 bg-zinc-900 border border-zinc-800/80 rounded-xl cursor-pointer hover:border-zinc-700/60 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar initials={p.initials} color={PINK} size="sm" />
                    {p.active && <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-zinc-900" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-white font-semibold text-sm">{p.name}</p>
                      {p.active && <ActiveDot />}
                    </div>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-2.5 h-2.5 text-zinc-600" />
                      <span className="text-zinc-500 text-xs">{p.distance} · {p.headline}</span>
                    </div>
                  </div>
                </div>
                <motion.button whileTap={{ scale: 0.95 }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-white shrink-0"
                  style={{ background: `linear-gradient(135deg, ${PINK}, #a855f7)` }}>
                  Connect
                </motion.button>
              </motion.div>
            ))}

            <motion.button whileTap={{ scale: 0.97 }}
              className="w-full py-3 rounded-xl text-sm font-semibold text-zinc-400 bg-zinc-800/60 border border-zinc-700/50 hover:bg-zinc-800 transition-all flex items-center justify-center gap-2">
              See more people nearby <ChevronRight className="w-4 h-4" />
            </motion.button>
          </div>
        </div>

        {/* === SECTION 3: Quick Action Bar === */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4" style={{ color: PINK }} />
            <h2 className="text-white font-bold text-sm">Quick Actions</h2>
            <span className="text-zinc-600 text-[10px] font-semibold uppercase tracking-wider">Always Accessible</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {QUICK_ACTIONS.map(({ icon: Icon, label, sub }) => (
              <motion.button key={label} whileTap={{ scale: 0.95 }}
                className="flex flex-col items-center gap-1.5 p-3 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-700/60 transition-colors cursor-pointer">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: `${PINK}18`, border: `1px solid ${PINK}22` }}>
                  <Icon className="w-4 h-4" style={{ color: PINK }} />
                </div>
                <p className="text-white text-xs font-semibold text-center leading-tight">{label}</p>
                <p className="text-zinc-600 text-[10px] text-center leading-tight">{sub}</p>
              </motion.button>
            ))}
          </div>
        </div>

        {/* === SECTION 4: Live Rooms === */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4" style={{ color: PINK }} />
              <h2 className="text-white font-bold text-sm">Live Rooms</h2>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white" style={{ background: PINK }}>LIVE</span>
            </div>
            <button className="text-xs font-semibold" style={{ color: PINK }}>
              Join Instantly
            </button>
          </div>

          <div className="space-y-2">
            {LIVE_ROOMS.map(room => (
              <motion.div key={room.id} whileTap={{ scale: 0.98 }}
                className="flex items-center justify-between p-3.5 bg-zinc-900 border border-zinc-800/80 rounded-xl hover:border-zinc-700/60 transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: `${room.color}18`, border: `1.5px solid ${room.color}33` }}>
                    <Mic className="w-4 h-4" style={{ color: room.color }} />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{room.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="flex -space-x-1">
                        {[0,1,2].map(i => (
                          <div key={i} className="w-4 h-4 rounded-full bg-zinc-700 border border-zinc-900" />
                        ))}
                      </div>
                      <span className="text-zinc-500 text-xs">{room.count} in room</span>
                    </div>
                  </div>
                </div>
                <motion.button whileTap={{ scale: 0.95 }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                  style={{ background: `linear-gradient(135deg, ${room.color}cc, ${room.color}88)` }}>
                  Join
                </motion.button>
              </motion.div>
            ))}
          </div>
        </div>

        {/* === SECTION 5: Create Opportunity === */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Plus className="w-4 h-4" style={{ color: PINK }} />
            <h2 className="text-white font-bold text-sm">Create Opportunity</h2>
            <span className="text-zinc-600 text-xs">Post in Seconds</span>
          </div>
          <CreateOpportunityPanel />
        </div>

        {/* === SECTION 6: Hot Connections === */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-400" />
              <h2 className="text-white font-bold text-sm">Hot Connections Near You</h2>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-600" />
          </div>
          <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-none">
            {HOT_CONNECTIONS.map(p => (
              <motion.div key={p.id} whileTap={{ scale: 0.95 }}
                className="flex flex-col items-center gap-1.5 cursor-pointer shrink-0">
                <div className="relative">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-sm"
                    style={{ background: `linear-gradient(135deg, ${PINK}44, ${PINK}22)`, border: `2px solid ${PINK}33` }}>
                    {p.initials}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 text-[10px] bg-zinc-800 border border-zinc-700 rounded-full px-1 font-semibold text-zinc-300">
                    {p.distance}
                  </span>
                </div>
                <p className="text-zinc-300 text-xs font-medium text-center w-14 truncate">{p.name}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border border-zinc-800 rounded-2xl p-6 mb-4 text-center bg-zinc-900/50">
          <div className="grid grid-cols-3 gap-4 mb-5">
            {[
              { icon: Zap, label: "OPPORTUNITIES", sub: "Find you." },
              { icon: Users, label: "CONNECTIONS", sub: "Change you." },
              { icon: Globe, label: "COMMUNITY", sub: "Builds you." },
            ].map(({ icon: Icon, label, sub }) => (
              <div key={label} className="flex flex-col items-center gap-1">
                <Icon className="w-5 h-5 mb-1" style={{ color: PINK }} />
                <p className="text-white font-black text-[10px] tracking-wider">{label}</p>
                <p className="text-zinc-500 text-[10px]">{sub}</p>
              </div>
            ))}
          </div>
          <p className="text-zinc-400 font-black text-xs tracking-[0.2em] uppercase">
            The Future of Networking Is Here.
          </p>
          <div className="mt-3">
            <motion.button whileTap={{ scale: 0.97 }}
              className="w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2"
              style={{ background: `linear-gradient(135deg, ${PINK}, #a855f7)` }}>
              <Zap className="w-4 h-4" />
              Create Opportunity
            </motion.button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {openDoorPerson && <OpenDoorModal person={openDoorPerson} onClose={() => setOpenDoorPerson(null)} />}
      </AnimatePresence>

      {/* Full-screen profile preview modal */}
      <AnimatePresence>
        {profilePerson && (
          <ProfilePreviewModal
            key={profilePerson.id}
            profile={profilePerson as ModalProfile}
            onClose={() => setProfilePerson(null)}
            onOpenDoor={() => { setProfilePerson(null); setTimeout(() => setOpenDoorPerson(profilePerson), 80); }}
            onMessage={() => setProfilePerson(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
