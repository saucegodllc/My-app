import React, { useMemo, useState } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useTransform,
} from "framer-motion";
import {
  Accessibility,
  BadgeCheck,
  CalendarPlus,
  Camera,
  Check,
  ChevronRight,
  Coffee,
  Dumbbell,
  ImagePlus,
  MessageCircle,
  Moon,
  MoreHorizontal,
  PartyPopper,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Flame,
  Heart,
  Info,
  MapPin,
  MessageSquare,
  Users,
  SlidersHorizontal,
  Star,
  X,
  Zap,
} from "lucide-react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getGetDiscoveryFeedQueryKey,
  getGetMyProfileQueryKey,
  useGetDiscoveryFeed,
  useGetMyProfile,
  usePerformDiscoveryAction,
} from "@workspace/api-client-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const INTENTS: Record<string, string[]> = {
  Dating: ["All", "Serious", "Casual", "Double Dates", "Active Tonight", "New in Town"],
  Friends: ["All", "Going Out", "Study", "Travel", "Foodies", "Nightlife"],
  Opportunities: ["All", "Entrepreneurs", "Creators", "Students", "Investors", "Jobs", "Mentors"],
};

const INTENT_API: Record<string, "dating" | "friendship" | "networking"> = {
  Dating: "dating",
  Friends: "friendship",
  Opportunities: "networking",
};

const NAV_ITEMS = [
  { label: "Discover", href: "/discover" },
  { label: "Connect", href: "/matches" },
  { label: "Events", href: "/dashboard" },
  { label: "Map", href: "/map" },
  { label: "Profile", href: "/profile/me" },
] as const;

type User = {
  id: string;
  name: string;
  age: number;
  bio: string;
  vibe: string;
  location: string;
  intent: string;
  subIntent: string;
  interests: string[];
  photo: string | null;
  verified: boolean;
  online: boolean;
  compatibility: number;
};

type ApiProfile = {
  userId: string;
  displayName: string;
  bio?: string | null;
  age?: number | null;
  location?: string | null;
  country?: string | null;
  intent?: string | null;
  interests?: string[] | null;
  photos?: string[] | null;
  connectionSubtype?: string | null;
  isVerified?: boolean | null;
};

type DiscoverFilters = {
  minAge?: number;
  maxAge?: number;
  onlyVerified: boolean;
};

const DEFAULT_FILTERS: DiscoverFilters = {
  minAge: undefined,
  maxAge: undefined,
  onlyVerified: false,
};

function getInitials(name = "User") {
  return name
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function deterministicPct(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (((hash << 5) - hash) + id.charCodeAt(index)) | 0;
  }
  return 70 + (Math.abs(hash) % 30);
}

function normalizeSubtype(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function formatLocation(location?: string, country?: string) {
  return [location, country].filter(Boolean).join(", ");
}

function toUser(profile: ApiProfile): User {
  const photoKey = (profile.photos?.[0] ?? "").replace(/^\/objects\//, "");
  const intent =
    profile.intent === "friendship"
      ? "Friends"
      : profile.intent === "networking"
        ? "Opportunities"
        : "Dating";

  return {
    id: profile.userId,
    name: profile.displayName,
    age: profile.age ?? 18,
    bio: profile.bio ?? "",
    vibe: (profile.bio ?? "").slice(0, 110),
    location: formatLocation(profile.location, profile.country),
    intent,
    subIntent: profile.connectionSubtype ?? "All",
    interests: profile.interests ?? [],
    photo: photoKey ? `/api/storage/objects/${photoKey}` : null,
    verified: Boolean(profile.isVerified),
    online: deterministicPct(profile.userId) % 2 === 0,
    compatibility: deterministicPct(profile.userId),
  };
}

function IntentTabs({
  active,
  setActive,
}: {
  active: string;
  setActive: (value: string) => void;
}) {
  return (
    <div className="mx-5 mt-4 flex rounded-full border border-white/10 bg-white/5 p-1">
      {Object.keys(INTENTS).map((intent) => (
        <button
          key={intent}
          type="button"
          onClick={() => setActive(intent)}
          className={`relative flex-1 rounded-full py-3 text-sm font-semibold transition ${
            active === intent ? "text-white" : "text-zinc-400"
          }`}
        >
          {active === intent ? (
            <motion.div
              layoutId="intent-bg"
              className="absolute inset-0 rounded-full bg-gradient-to-r from-[#FF299B] to-fuchsia-700 shadow-[0_0_24px_rgba(255,41,155,.45)]"
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
            />
          ) : null}
          <span className="relative z-10">{intent}</span>
        </button>
      ))}
    </div>
  );
}

function SubIntentChips({
  intent,
  active,
  setActive,
}: {
  intent: string;
  active: string;
  setActive: (value: string) => void;
}) {
  return (
    <div className="mt-4 flex gap-2 overflow-x-auto px-5 pb-1 scrollbar-none">
      {(INTENTS[intent] ?? ["All"]).map((chip) => (
        <button
          key={chip}
          type="button"
          onClick={() => setActive(chip)}
          className={`whitespace-nowrap rounded-full border px-4 py-2 text-xs font-bold transition ${
            active === chip
              ? "border-pink-400 bg-[#FF299B] text-white shadow-[0_0_18px_rgba(255,41,155,.45)]"
              : "border-white/10 bg-white/5 text-zinc-300"
          }`}
        >
          {chip}
        </button>
      ))}
    </div>
  );
}

function SwipeCard({
  user,
  isTop,
  onSwipe,
  onOpen,
}: {
  user: User;
  isTop: boolean;
  onSwipe: (direction: "like" | "pass" | "super", user: User) => void;
  onOpen: () => void;
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-240, 0, 240], [-14, 0, 14]);
  const likeOpacity = useTransform(x, [40, 150], [0, 1]);
  const passOpacity = useTransform(x, [-150, -40], [1, 0]);
  const superOpacity = useTransform(y, [-170, -60], [1, 0]);

  async function finishSwipe(direction: "like" | "pass" | "super") {
    if (direction === "like") {
      await animate(x, 760, { duration: 0.24, ease: "easeOut" });
    }
    if (direction === "pass") {
      await animate(x, -760, { duration: 0.24, ease: "easeOut" });
    }
    if (direction === "super") {
      await animate(y, -920, { duration: 0.24, ease: "easeOut" });
    }
    onSwipe(direction, user);
  }

  function handleDragEnd() {
    const currentX = x.get();
    const currentY = y.get();

    if (currentX > 130) {
      void finishSwipe("like");
      return;
    }
    if (currentX < -130) {
      void finishSwipe("pass");
      return;
    }
    if (currentY < -130) {
      void finishSwipe("super");
      return;
    }

    animate(x, 0, { type: "spring", stiffness: 430, damping: 30 });
    animate(y, 0, { type: "spring", stiffness: 430, damping: 30 });
  }

  return (
    <motion.div
      className="absolute inset-0 overflow-hidden rounded-[30px] border border-white/10 bg-zinc-900 shadow-2xl"
      style={{ x, y, rotate }}
      drag={isTop}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.18}
      whileTap={isTop ? { scale: 0.985 } : undefined}
      initial={{ scale: isTop ? 1 : 0.94, y: isTop ? 0 : 18, opacity: isTop ? 1 : 0.65 }}
      animate={{ scale: isTop ? 1 : 0.94, y: isTop ? 0 : 18, opacity: isTop ? 1 : 0.65 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      onDragEnd={isTop ? handleDragEnd : undefined}
      onDoubleClick={() => {
        if (isTop) {
          void finishSwipe("like");
        }
      }}
    >
      {user.photo ? (
        <img src={user.photo} alt={user.name} className="h-full w-full object-cover" draggable={false} />
      ) : (
        <div className="grid h-full w-full place-items-center bg-gradient-to-br from-zinc-950 via-fuchsia-950 to-black">
          <div className="grid h-32 w-32 place-items-center rounded-full border border-white/15 bg-white/10 text-5xl font-black text-white shadow-2xl backdrop-blur-xl">
            {getInitials(user.name)}
          </div>
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-black/5" />

      {isTop ? (
        <>
          <motion.div
            style={{ opacity: likeOpacity }}
            className="absolute left-6 top-8 rotate-[-12deg] rounded-2xl border-2 border-pink-400 px-5 py-2 text-3xl font-black text-pink-300"
          >
            LIKE
          </motion.div>
          <motion.div
            style={{ opacity: passOpacity }}
            className="absolute right-6 top-8 rotate-[12deg] rounded-2xl border-2 border-red-400 px-5 py-2 text-3xl font-black text-red-300"
          >
            PASS
          </motion.div>
          <motion.div
            style={{ opacity: superOpacity }}
            className="absolute left-1/2 top-20 -translate-x-1/2 rounded-2xl border-2 border-purple-400 px-5 py-2 text-3xl font-black text-purple-300"
          >
            SUPER
          </motion.div>
        </>
      ) : null}

      <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full border border-white/10 bg-black/45 px-3 py-2 text-xs font-bold text-white backdrop-blur-xl">
        <span className={`h-2 w-2 rounded-full ${user.online ? "bg-green-400" : "bg-zinc-500"}`} />
        {user.online ? "Online" : "Recently active"}
      </div>

      <div className="absolute right-4 top-4 rounded-full border border-white/10 bg-black/45 px-3 py-2 text-xs font-bold text-white backdrop-blur-xl">
        {user.compatibility}% Match
      </div>

      <button
        type="button"
        onClick={onOpen}
        className="absolute bottom-24 right-4 rounded-full border border-white/10 bg-black/40 p-2 text-white backdrop-blur-xl"
      >
        <Info size={18} />
      </button>

      <div className="absolute inset-x-0 bottom-0 p-5 pt-28">
        <div className="flex items-center gap-2">
          <h2 className="text-3xl font-black tracking-tight text-white">
            {user.name}, {user.age}
          </h2>
          {user.verified ? <BadgeCheck className="h-6 w-6 fill-[#FF299B] text-white" /> : null}
        </div>
        {user.location ? (
          <div className="mt-1 flex items-center gap-1 text-sm text-zinc-200">
            <MapPin size={14} /> {user.location}
          </div>
        ) : null}
        <div className="mt-3 flex gap-2 overflow-hidden">
          <span className="rounded-full bg-pink-500/25 px-3 py-1 text-xs font-bold text-pink-100">
            {user.intent}
          </span>
          {user.subIntent && user.subIntent !== "All" ? (
            <span className="rounded-full bg-purple-500/25 px-3 py-1 text-xs font-bold text-purple-100">
              {user.subIntent}
            </span>
          ) : null}
        </div>
        {user.vibe ? <p className="mt-3 line-clamp-2 text-sm font-medium text-white">{user.vibe}</p> : null}
        {user.bio ? <p className="mt-1 line-clamp-2 text-sm text-zinc-300">{user.bio}</p> : null}
        <div className="mt-4 flex gap-2 overflow-x-auto scrollbar-none">
          {user.interests.map((interest) => (
            <span
              key={interest}
              className="whitespace-nowrap rounded-full bg-white/12 px-3 py-2 text-xs font-bold text-white backdrop-blur"
            >
              {interest}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function ActionButtons({
  onPass,
  onSuper,
  onLike,
}: {
  onPass: () => void;
  onSuper: () => void;
  onLike: () => void;
}) {
  return (
    <div className="mx-auto mt-5 flex items-center justify-center gap-7">
      <button
        type="button"
        onClick={onPass}
        className="grid h-16 w-16 place-items-center rounded-full border border-white/10 bg-white/[0.08] text-zinc-300 shadow-xl backdrop-blur transition hover:scale-105"
      >
        <X size={32} />
      </button>
      <button
        type="button"
        onClick={onSuper}
        className="grid h-16 w-16 place-items-center rounded-full border border-purple-400/30 bg-purple-500/15 text-purple-300 shadow-[0_0_28px_rgba(168,85,247,.22)] backdrop-blur transition hover:scale-105"
      >
        <Star size={32} fill="currentColor" />
      </button>
      <button
        type="button"
        onClick={onLike}
        className="grid h-16 w-16 place-items-center rounded-full border border-pink-400/30 bg-pink-500/20 text-pink-300 shadow-[0_0_34px_rgba(255,41,155,.3)] backdrop-blur transition hover:scale-105"
      >
        <Heart size={32} fill="currentColor" />
      </button>
    </div>
  );
}

function MatchModal({ user, onClose }: { user: User | null; onClose: () => void }) {
  if (!user) {
    return null;
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-6 backdrop-blur-xl"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        initial={{ scale: 0.85, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-sm rounded-[32px] border border-white/10 bg-zinc-950 p-6 text-center shadow-2xl"
      >
        <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-full bg-gradient-to-r from-[#FF299B] to-purple-700 text-4xl">
          <Heart className="h-9 w-9 fill-white text-white" />
        </div>
        <h2 className="text-3xl font-black text-white">It's a Match!</h2>
        <p className="mt-2 text-zinc-400">You and {user.name} liked each other.</p>
        {user.photo ? (
          <img
            src={user.photo}
            alt={user.name}
            className="mx-auto mt-5 h-28 w-28 rounded-full object-cover ring-4 ring-pink-500"
          />
        ) : (
          <div className="mx-auto mt-5 grid h-28 w-28 place-items-center rounded-full bg-gradient-to-br from-pink-500 to-purple-800 text-3xl font-black text-white ring-4 ring-pink-500">
            {getInitials(user.name)}
          </div>
        )}
        <Link href="/matches">
          <button
            type="button"
            className="mt-6 w-full rounded-full bg-gradient-to-r from-[#FF299B] to-purple-700 py-4 font-bold text-white"
          >
            Send a Message
          </button>
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full rounded-full bg-white/[0.08] py-4 font-bold text-zinc-200"
        >
          Keep Discovering
        </button>
      </motion.div>
    </motion.div>
  );
}

function FilterSheet({
  open,
  onOpenChange,
  draftFilters,
  setDraftFilters,
  onReset,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draftFilters: DiscoverFilters;
  setDraftFilters: React.Dispatch<React.SetStateAction<DiscoverFilters>>;
  onReset: () => void;
  onApply: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-[28px] border-white/10 bg-[#0a0a0a] px-5 pb-6 pt-10 text-white"
      >
        <SheetHeader className="text-left">
          <SheetTitle className="text-white">Discover filters</SheetTitle>
          <SheetDescription className="text-zinc-400">
            Tighten the feed without losing the hot pink energy.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div>
            <p className="text-sm font-semibold text-white">Age range</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <span className="text-xs font-medium text-zinc-400">Min age</span>
                <input
                  type="number"
                  min={18}
                  value={draftFilters.minAge ?? ""}
                  onChange={(event) =>
                    setDraftFilters((current) => ({
                      ...current,
                      minAge: event.target.value ? Number(event.target.value) : undefined,
                    }))
                  }
                  className="mt-2 w-full bg-transparent text-lg font-bold text-white outline-none"
                  placeholder="18"
                />
              </label>
              <label className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <span className="text-xs font-medium text-zinc-400">Max age</span>
                <input
                  type="number"
                  min={18}
                  value={draftFilters.maxAge ?? ""}
                  onChange={(event) =>
                    setDraftFilters((current) => ({
                      ...current,
                      maxAge: event.target.value ? Number(event.target.value) : undefined,
                    }))
                  }
                  className="mt-2 w-full bg-transparent text-lg font-bold text-white outline-none"
                  placeholder="35"
                />
              </label>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              setDraftFilters((current) => ({
                ...current,
                onlyVerified: !current.onlyVerified,
              }))
            }
            className={`flex w-full items-center justify-between rounded-2xl border px-4 py-4 text-left transition ${
              draftFilters.onlyVerified
                ? "border-pink-400 bg-pink-500/15 text-white"
                : "border-white/10 bg-white/5 text-zinc-300"
            }`}
          >
            <div>
              <p className="font-semibold">Verified profiles only</p>
              <p className="mt-1 text-sm text-zinc-400">Show only people with verified badges.</p>
            </div>
            <div
              className={`h-6 w-11 rounded-full p-1 transition ${
                draftFilters.onlyVerified ? "bg-[#FF299B]" : "bg-zinc-700"
              }`}
            >
              <div
                className={`h-4 w-4 rounded-full bg-white transition ${
                  draftFilters.onlyVerified ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </div>
          </button>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onReset}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-3 font-semibold text-white"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onApply}
            className="rounded-full bg-gradient-to-r from-[#FF299B] to-purple-700 px-4 py-3 font-semibold text-white"
          >
            Apply
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function PreviewSheet({
  user,
  onClose,
  onLike,
}: {
  user: User | null;
  onClose: () => void;
  onLike: () => void;
}) {
  if (!user) {
    return null;
  }

  return (
    <motion.div
      className="fixed inset-0 z-40 bg-black"
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 240 }}
    >
      <div className="h-screen overflow-y-auto bg-black text-white">
        <div className="relative h-[62vh] min-h-[420px] w-full">
          {user.photo ? (
            <img src={user.photo} alt={user.name} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center bg-gradient-to-br from-zinc-950 via-fuchsia-950 to-black">
              <div className="grid h-36 w-36 place-items-center rounded-full border border-white/15 bg-white/10 text-6xl font-black text-white">
                {getInitials(user.name)}
              </div>
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-black/20" />

          <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/15 bg-black/45 p-3 text-white backdrop-blur"
            >
              <X size={18} />
            </button>
            <div className="rounded-full border border-white/15 bg-black/45 px-3 py-2 text-xs font-bold text-white backdrop-blur">
              {user.compatibility}% Match
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 p-5">
            <div className="flex items-center gap-2">
              <h2 className="text-4xl font-black">
                {user.name}, {user.age}
              </h2>
              {user.verified ? <BadgeCheck className="h-6 w-6 fill-[#FF299B] text-white" /> : null}
            </div>
            {user.location ? (
              <div className="mt-2 flex items-center gap-1 text-sm text-zinc-200">
                <MapPin size={14} /> {user.location}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mx-auto max-w-md px-5 pb-32 pt-5">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-pink-500/20 px-3 py-1 text-xs font-bold text-pink-100">
              {user.intent}
            </span>
            {user.subIntent && user.subIntent !== "All" ? (
              <span className="rounded-full bg-purple-500/20 px-3 py-1 text-xs font-bold text-purple-100">
                {user.subIntent}
              </span>
            ) : null}
            {user.online ? (
              <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-300">
                Active now
              </span>
            ) : null}
          </div>

          {user.vibe ? (
            <div className="mt-5 rounded-[24px] border border-pink-500/20 bg-pink-500/10 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-pink-300">Vibe</p>
              <p className="mt-2 text-sm leading-6 text-pink-50">{user.vibe}</p>
            </div>
          ) : null}

          {user.bio ? (
            <div className="mt-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">About</p>
              <p className="mt-2 text-sm leading-6 text-zinc-200">{user.bio}</p>
            </div>
          ) : null}

          {user.interests.length > 0 ? (
            <div className="mt-6">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Interests</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {user.interests.map((interest) => (
                  <span
                    key={interest}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white"
                  >
                    {interest}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-white/10 bg-black/90 p-4 backdrop-blur-xl">
          <div className="mx-auto flex max-w-md gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-4 font-semibold text-white"
            >
              Back
            </button>
            <button
              type="button"
              onClick={onLike}
              className="flex-1 rounded-full bg-gradient-to-r from-[#FF299B] to-purple-700 px-4 py-4 font-semibold text-white"
            >
              Like
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

type FriendPerson = {
  id: string;
  name: string;
  age: number;
  city: string;
  avatar: string;
  photo: string;
  interests: string[];
  badges: string[];
  energy: string;
  signal: string;
  neighborhood: string;
  connected?: boolean;
};

type FriendPost = {
  id: string;
  type: "post" | "profile" | "plan" | "signal";
  person: FriendPerson;
  text: string;
  timestamp: string;
  tag: string;
  image?: string;
  subtleSignals: string[];
  prompt: string;
};

const FRIEND_STORIES = [
  { label: "Coffee", icon: Coffee, ring: "from-amber-300 to-[#FF299B]" },
  { label: "Gym", icon: Dumbbell, ring: "from-lime-300 to-emerald-400" },
  { label: "Going Out", icon: PartyPopper, ring: "from-[#FF299B] to-purple-500" },
  { label: "Chill", icon: Moon, ring: "from-sky-300 to-indigo-400" },
  { label: "New to Miami", icon: MapPin, ring: "from-orange-300 to-pink-400" },
  { label: "Study", icon: MessageSquare, ring: "from-violet-300 to-fuchsia-400" },
  { label: "Accessible", icon: Accessibility, ring: "from-cyan-300 to-blue-400" },
  { label: "Active Tonight", icon: Zap, ring: "from-[#FF299B] to-red-400" },
];

const FRIEND_CHIPS = [
  "For You",
  "Nearby",
  "Active Now",
  "Coffee",
  "Gym",
  "Chill",
  "Nightlife",
  "Learning",
  "Accessible",
  "LGBTQ+",
  "Family-Friendly",
  "50+",
  "New to Miami",
];

const POST_TAGS = ["Coffee", "Gym", "Walk", "Brunch", "Chill", "Going Out", "Study", "Food", "Creative", "Movie"];

const PLAN_OPTIONS = [
  { label: "Coffee", reason: "Easy first plan and low pressure.", icon: Coffee },
  { label: "Gym", reason: "Both enjoy active mornings.", icon: Dumbbell },
  { label: "Walk", reason: "Good fit for a relaxed neighborhood meetup.", icon: MapPin },
  { label: "Brunch", reason: "Shared food interests and weekend energy.", icon: Sparkles },
  { label: "Night Out", reason: "Both show up for evening plans.", icon: PartyPopper },
  { label: "Study", reason: "Quiet setting with a clear purpose.", icon: MessageSquare },
  { label: "Movie", reason: "Simple plan for introvert-friendly connection.", icon: Camera },
  { label: "Creative", reason: "Shared creative interests make this natural.", icon: Star },
  { label: "Food", reason: "Both save food spots around Miami.", icon: Coffee },
  { label: "Custom", reason: "Build something that fits your schedules.", icon: Plus },
];

const FRIEND_PEOPLE: FriendPerson[] = [
  {
    id: "friend-maya",
    name: "Maya Johnson",
    age: 29,
    city: "Brickell",
    avatar: "MJ",
    photo: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=900&q=80",
    interests: ["coffee", "design", "beach walks", "brunch"],
    badges: ["Active Tonight", "Coffee Person", "Accessible Friendly", "Fast Responder"],
    energy: "Exploring Miami",
    signal: "Trying a new coffee spot after work.",
    neighborhood: "Brickell",
  },
  {
    id: "friend-omar",
    name: "Omar Ellis",
    age: 35,
    city: "Wynwood",
    avatar: "OE",
    photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=80",
    interests: ["gym", "food", "nightlife", "music"],
    badges: ["Gym Energy", "LGBTQ+ Friendly", "Social Weekend", "Fast Responder"],
    energy: "Looking for Plans",
    signal: "Open to a group dinner or a gallery night.",
    neighborhood: "Wynwood",
  },
  {
    id: "friend-nina",
    name: "Nina Patel",
    age: 42,
    city: "Coral Gables",
    avatar: "NP",
    photo: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=900&q=80",
    interests: ["family plans", "learning", "parks", "food"],
    badges: ["Family-Friendly", "Chill Personality", "50+", "Accessible Friendly"],
    energy: "Chill Mode",
    signal: "Weekend park walk with coffee nearby.",
    neighborhood: "Coral Gables",
  },
  {
    id: "friend-jules",
    name: "Jules Rivera",
    age: 24,
    city: "Downtown",
    avatar: "JR",
    photo: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=900&q=80",
    interests: ["study", "creative", "movies", "new to miami"],
    badges: ["New to Miami", "Study Mode", "LGBTQ+ Friendly", "Low-Noise Plans"],
    energy: "Study Mode",
    signal: "Looking for a quiet cafe to co-work.",
    neighborhood: "Downtown",
  },
];

const FRIEND_FEED: FriendPost[] = [
  {
    id: "post-1",
    type: "post",
    person: FRIEND_PEOPLE[0],
    text: "Down for an iced latte and a walk by the water around 6. Low-key, good conversation, no pressure.",
    timestamp: "12m",
    tag: "Coffee",
    image: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1200&q=80",
    subtleSignals: ["Similar interests", "Also active around Brickell", "Usually joins coffee plans"],
    prompt: "Favorite coffee spot in Miami?",
  },
  {
    id: "profile-1",
    type: "profile",
    person: FRIEND_PEOPLE[1],
    text: "Build a gym-to-food crew. Morning lifts, weekend markets, live music when the week allows it.",
    timestamp: "Active now",
    tag: "Gym",
    subtleSignals: ["Same energy", "Into the same things", "Mutual creative circles"],
    prompt: "Gym or beach walk?",
  },
  {
    id: "plan-1",
    type: "plan",
    person: FRIEND_PEOPLE[2],
    text: "Mini plan: family-friendly Saturday brunch, then a shaded park walk. Easy pace and accessible seating preferred.",
    timestamp: "Today",
    tag: "Brunch",
    subtleSignals: ["Your kind of people", "Shared safety preferences", "Low-noise friendly"],
    prompt: "Best calm brunch place in Coral Gables?",
  },
  {
    id: "signal-1",
    type: "signal",
    person: FRIEND_PEOPLE[3],
    text: "New to Miami and trying to find study friends, movie people, and quiet creative spaces.",
    timestamp: "28m",
    tag: "Study",
    image: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1200&q=80",
    subtleSignals: ["You'd probably get along", "Similar plan style", "Also likes quiet places"],
    prompt: "Favorite chill place in Brickell?",
  },
];

function getPlanSuggestions(person: FriendPerson) {
  return PLAN_OPTIONS.map((option) => ({
    ...option,
    reason:
      person.interests.includes(option.label.toLowerCase()) || person.signal.toLowerCase().includes(option.label.toLowerCase())
        ? `${option.label} fits ${person.name.split(" ")[0]}'s current signal.`
        : option.reason,
  })).slice(0, 6);
}

function FriendStoryRow({ selected, onSelect }: { selected: string; onSelect: (value: string) => void }) {
  return (
    <div className="mt-5 flex gap-3 overflow-x-auto px-5 pb-2 scrollbar-none">
      {FRIEND_STORIES.map(({ label, icon: Icon, ring }) => (
        <button key={label} type="button" onClick={() => onSelect(label)} className="w-[74px] shrink-0 text-center">
          <div className={`mx-auto grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br ${ring} p-[2px] shadow-[0_0_26px_rgba(255,41,155,.24)]`}>
            <div className={`grid h-full w-full place-items-center rounded-full bg-zinc-950 ${selected === label ? "text-white" : "text-zinc-300"}`}>
              <Icon size={21} />
            </div>
          </div>
          <div className="mt-2 truncate text-[11px] font-semibold text-zinc-300">{label}</div>
        </button>
      ))}
    </div>
  );
}

function CompatibilitySignals({ signals }: { signals: string[] }) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {signals.map((signal) => (
        <span key={signal} className="rounded-full border border-pink-300/20 bg-pink-400/10 px-3 py-1 text-[11px] font-semibold text-pink-100">
          {signal}
        </span>
      ))}
    </div>
  );
}

function PostCreator({ onPost }: { onPost: (text: string, tag: string) => void }) {
  const [text, setText] = useState("");
  const [tag, setTag] = useState("Coffee");

  return (
    <motion.section layout className="mx-5 mt-4 rounded-[28px] border border-white/10 bg-white/[.06] p-4 shadow-[0_24px_80px_rgba(255,41,155,.12)] backdrop-blur-xl">
      <div className="flex gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#FF299B] to-purple-700 text-sm font-black">
          ME
        </div>
        <div className="min-w-0 flex-1">
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="What are you down to do?"
            className="h-20 w-full resize-none bg-transparent text-sm text-white placeholder:text-zinc-500 focus:outline-none"
          />
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {POST_TAGS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setTag(option)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${
                  tag === option ? "border-[#FF299B] bg-[#FF299B] text-white" : "border-white/10 bg-black/30 text-zinc-300"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
        <button type="button" className="flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold text-zinc-300">
          <ImagePlus size={16} className="text-[#FF299B]" />
          Image
        </button>
        <button
          type="button"
          onClick={() => {
            if (!text.trim()) return;
            onPost(text.trim(), tag);
            setText("");
          }}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#FF299B] to-purple-700 px-5 py-2 text-xs font-black text-white shadow-[0_0_22px_rgba(255,41,155,.35)]"
        >
          <Send size={14} />
          Post
        </button>
      </div>
    </motion.section>
  );
}

function FriendPostCard({
  item,
  requested,
  onConnect,
  onPlan,
}: {
  item: FriendPost;
  requested: boolean;
  onConnect: (person: FriendPerson) => void;
  onPlan: (person: FriendPerson) => void;
}) {
  const isProfile = item.type === "profile";

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="mx-5 overflow-hidden rounded-[30px] border border-white/10 bg-zinc-950/90 shadow-[0_24px_90px_rgba(0,0,0,.45)]"
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-[#FF299B] to-purple-700 text-sm font-black">
            {item.person.avatar}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <h3 className="font-black text-white">{item.person.name}</h3>
                  <BadgeCheck size={15} className="text-[#FF299B]" />
                  {isProfile ? <span className="text-xs text-zinc-400">{item.person.age}</span> : null}
                </div>
                <div className="mt-0.5 flex items-center gap-1 text-xs text-zinc-500">
                  <MapPin size={12} />
                  {item.person.city} · {item.timestamp}
                </div>
              </div>
              <button type="button" className="rounded-full p-2 text-zinc-500 hover:bg-white/10 hover:text-white">
                <MoreHorizontal size={18} />
              </button>
            </div>
            <p className="mt-3 text-[15px] leading-relaxed text-zinc-100">{item.text}</p>
          </div>
        </div>

        {isProfile ? (
          <div className="mt-4 overflow-hidden rounded-[24px] border border-white/10 bg-white/[.04]">
            <div className="relative h-64">
              <img src={item.person.photo} alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/50 px-3 py-1.5 text-xs font-bold text-white backdrop-blur">
                  <Zap size={13} className="text-[#FF299B]" />
                  {item.person.energy}
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.person.badges.slice(0, 4).map((badge) => (
                    <span key={badge} className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold text-white backdrop-blur">
                      {badge}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : item.image ? (
          <div className="mt-4 overflow-hidden rounded-[24px] border border-white/10">
            <img src={item.image} alt="" className="h-64 w-full object-cover" />
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-black text-white">{item.tag}</span>
          {item.person.interests.slice(0, 3).map((interest) => (
            <span key={interest} className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-zinc-300">
              {interest}
            </span>
          ))}
        </div>

        <CompatibilitySignals signals={item.subtleSignals} />

        <div className="mt-4 rounded-[22px] border border-white/10 bg-white/[.04] p-3">
          <div className="flex items-center gap-2 text-xs font-bold text-pink-100">
            <Sparkles size={14} className="text-[#FF299B]" />
            Icebreaker
          </div>
          <p className="mt-1 text-sm text-zinc-300">{item.prompt}</p>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2">
          <button type="button" className="rounded-full border border-white/10 bg-white/[.05] px-3 py-3 text-xs font-bold text-zinc-200">
            Like
          </button>
          <button type="button" className="inline-flex items-center justify-center gap-1 rounded-full border border-white/10 bg-white/[.05] px-3 py-3 text-xs font-bold text-zinc-200">
            <MessageCircle size={13} />
            Comment
          </button>
          <button
            type="button"
            onClick={() => onConnect(item.person)}
            className={`inline-flex items-center justify-center gap-1 rounded-full px-3 py-3 text-xs font-black ${
              requested ? "bg-white text-black" : "bg-gradient-to-r from-[#FF299B] to-purple-700 text-white"
            }`}
          >
            {requested ? <Check size={13} /> : null}
            {requested ? "Requested" : item.person.connected ? "Message" : "Connect"}
          </button>
          <button
            type="button"
            onClick={() => onPlan(item.person)}
            className="inline-flex items-center justify-center gap-1 rounded-full border border-pink-300/30 bg-pink-400/10 px-3 py-3 text-xs font-black text-pink-100"
          >
            <CalendarPlus size={13} />
            Plan
          </button>
        </div>
      </div>
    </motion.article>
  );
}

function FriendPlanSheet({ person, onClose }: { person: FriendPerson; onClose: () => void }) {
  const suggestions = getPlanSuggestions(person);

  return (
    <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-3 pb-3 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        initial={{ y: 420 }}
        animate={{ y: 0 }}
        exit={{ y: 420 }}
        transition={{ type: "spring", stiffness: 260, damping: 28 }}
        className="w-full max-w-md rounded-[34px] border border-white/10 bg-zinc-950 p-5 shadow-[0_0_90px_rgba(255,41,155,.28)]"
      >
        <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-white/20" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black">Make a plan</h2>
            <p className="mt-1 text-sm text-zinc-400">Smart suggestions based on shared interests, pace, and plan style.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-white/10 bg-white/5 p-2">
            <X size={18} />
          </button>
        </div>
        <div className="mt-5 grid gap-3">
          {suggestions.map(({ label, reason, icon: Icon }) => (
            <button key={label} type="button" className="flex items-center gap-3 rounded-[22px] border border-white/10 bg-white/[.05] p-3 text-left transition hover:border-pink-300/40 hover:bg-pink-400/10">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-[#FF299B] to-purple-700">
                <Icon size={19} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-black text-white">{label}</div>
                <div className="text-xs text-zinc-400">{reason}</div>
              </div>
              <ChevronRight size={18} className="text-zinc-500" />
            </button>
          ))}
        </div>
        <button type="button" className="mt-5 w-full rounded-full bg-gradient-to-r from-[#FF299B] to-purple-700 py-4 text-sm font-black text-white">
          Create plan and chat
        </button>
      </motion.div>
    </motion.div>
  );
}

function FriendsExperience() {
  const [query, setQuery] = useState("");
  const [activeChip, setActiveChip] = useState("For You");
  const [requested, setRequested] = useState<string[]>([]);
  const [planPerson, setPlanPerson] = useState<FriendPerson | null>(null);
  const [localPosts, setLocalPosts] = useState<FriendPost[]>([]);

  const feed = useMemo(() => {
    const combined = [...localPosts, ...FRIEND_FEED];
    const needle = query.trim().toLowerCase();

    return combined.filter((item) => {
      const haystack = [
        item.person.name,
        item.person.city,
        item.person.neighborhood,
        item.person.energy,
        item.person.signal,
        item.text,
        item.tag,
        ...item.person.interests,
        ...item.person.badges,
        ...item.subtleSignals,
      ].join(" ").toLowerCase();

      const matchesQuery = !needle || haystack.includes(needle);
      const matchesChip =
        activeChip === "For You" ||
        activeChip === "Nearby" ||
        haystack.includes(activeChip.toLowerCase().replace("+", ""));

      return matchesQuery && matchesChip;
    });
  }, [activeChip, localPosts, query]);

  function createPost(text: string, tag: string) {
    setLocalPosts((current) => [
      {
        id: `local-${Date.now()}`,
        type: "post",
        person: {
          id: "me",
          name: "You",
          age: 28,
          city: "Miami",
          avatar: "ME",
          photo: "",
          interests: [tag.toLowerCase(), "plans", "community"],
          badges: ["Looking for Plans", "Fast Responder", "Safety Minded"],
          energy: "Looking for Plans",
          signal: text,
          neighborhood: "Miami",
        },
        text,
        timestamp: "Now",
        tag,
        subtleSignals: ["People nearby can join", "Plan-friendly post", "Your kind of people"],
        prompt: "Who is down to join?",
      },
      ...current,
    ]);
    toast.success("Posted to Friends.");
  }

  return (
    <div className="min-h-screen overflow-hidden bg-[#050505] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(255,41,155,.22),transparent_34%),linear-gradient(180deg,rgba(255,41,155,.06),transparent_28%)]" />
      <div className="relative mx-auto min-h-screen max-w-md pb-28">
        <header className="px-5 pt-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-4xl font-black tracking-tight">Friends</h1>
              <p className="mt-1 text-sm font-medium text-zinc-400">Find people. Make plans. Build your crew.</p>
            </div>
            <div className="grid h-12 w-12 place-items-center rounded-full border border-pink-300/30 bg-pink-400/10 text-[#FF299B] shadow-[0_0_28px_rgba(255,41,155,.28)]">
              <Users size={22} />
            </div>
          </div>
        </header>

        <FriendStoryRow selected={activeChip} onSelect={setActiveChip} />

        <div className="mx-5 mt-4 flex items-center gap-3 rounded-full border border-white/10 bg-white/[.06] px-4 py-3 backdrop-blur-xl">
          <Search size={18} className="text-[#FF299B]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search people, interests, plans..."
            className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-zinc-500 focus:outline-none"
          />
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto px-5 pb-1 scrollbar-none">
          {FRIEND_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => setActiveChip(chip)}
              className={`shrink-0 rounded-full border px-4 py-2 text-xs font-black transition ${
                activeChip === chip
                  ? "border-[#FF299B] bg-[#FF299B] text-white shadow-[0_0_22px_rgba(255,41,155,.35)]"
                  : "border-white/10 bg-white/[.04] text-zinc-300"
              }`}
            >
              {chip}
            </button>
          ))}
        </div>

        <PostCreator onPost={createPost} />

        <div className="mx-5 mt-4 rounded-[24px] border border-white/10 bg-white/[.04] p-4">
          <div className="flex items-center gap-2 text-sm font-black">
            <ShieldCheck size={18} className="text-[#FF299B]" />
            Smart social feed
          </div>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">
            Recommendations quietly prioritize shared interests, location, activity style, accessibility, safety preferences, and how you interact.
          </p>
        </div>

        <div className="mt-4 grid gap-4">
          <AnimatePresence>
            {feed.map((item) => (
              <FriendPostCard
                key={item.id}
                item={item}
                requested={requested.includes(item.person.id)}
                onConnect={(person) => {
                  setRequested((current) => current.includes(person.id) ? current : [...current, person.id]);
                  toast.success(`Request sent to ${person.name}.`);
                }}
                onPlan={setPlanPerson}
              />
            ))}
          </AnimatePresence>
        </div>

        <nav className="fixed bottom-0 left-1/2 grid w-full max-w-md -translate-x-1/2 grid-cols-5 border-t border-white/10 bg-zinc-950/95 px-3 pb-5 pt-3 text-[11px] backdrop-blur-xl">
          {NAV_ITEMS.map((item, index) => (
            <Link key={item.label} href={item.href}>
              <div className={`text-center transition-colors ${index === 0 ? "text-pink-400" : "text-zinc-500 hover:text-zinc-300"}`}>
                {item.label}
              </div>
            </Link>
          ))}
        </nav>
      </div>

      <AnimatePresence>
        {planPerson ? <FriendPlanSheet person={planPerson} onClose={() => setPlanPerson(null)} /> : null}
      </AnimatePresence>
    </div>
  );
}

function ViralDiscoverTab({ users: externalUsers }: { users?: User[] }) {
  const [intent, setIntent] = useState("Friends");
  const [subIntent, setSubIntent] = useState("All");
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [matchUser, setMatchUser] = useState<User | null>(null);
  const [preview, setPreview] = useState<User | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<DiscoverFilters>(DEFAULT_FILTERS);
  const [draftFilters, setDraftFilters] = useState<DiscoverFilters>(DEFAULT_FILTERS);

  const { mutateAsync: doAction } = usePerformDiscoveryAction();
  const queryClient = useQueryClient();

  const params = {
    page: 1,
    limit: 30,
    intent: INTENT_API[intent],
    ...(subIntent !== "All" ? { subtype: subIntent } : {}),
    ...(filters.minAge ? { minAge: filters.minAge } : {}),
    ...(filters.maxAge ? { maxAge: filters.maxAge } : {}),
  };

  const { data: feed, isFetching } = useGetDiscoveryFeed(params, {
    query: { queryKey: getGetDiscoveryFeedQueryKey(params) },
  });

  const fetchedUsers = useMemo(() => {
    const raw = (feed as { profiles?: ApiProfile[] } | undefined)?.profiles ?? [];
    return raw.map(toUser);
  }, [feed]);

  const allUsers = externalUsers ?? fetchedUsers;

  const filteredUsers = useMemo(
    () =>
      allUsers.filter((user) => {
        if (user.intent !== intent) {
          return false;
        }
        if (subIntent !== "All" && normalizeSubtype(user.subIntent) !== normalizeSubtype(subIntent)) {
          return false;
        }
        if (filters.onlyVerified && !user.verified) {
          return false;
        }
        if (dismissed.includes(user.id)) {
          return false;
        }
        return true;
      }),
    [allUsers, dismissed, filters.onlyVerified, intent, subIntent],
  );

  const topUser = filteredUsers[0] ?? null;

  async function handleSwipe(direction: "like" | "pass" | "super", user: User) {
    setDismissed((current) => [...current, user.id]);

    const action = direction === "super" ? "superlike" : direction;

    try {
      const result = await doAction({ data: { targetUserId: user.id, action } });

      if ((result as { matched?: boolean } | undefined)?.matched) {
        setMatchUser(user);
        return;
      }

      if (direction === "like") {
        toast.success(`You liked ${user.name}.`);
      } else if (direction === "super") {
        toast.success(`Super liked ${user.name}.`);
      }
    } catch {
      setDismissed((current) => current.filter((id) => id !== user.id));
      toast.error("That swipe did not stick. Try again.");
    }
  }

  function handleResetDiscover() {
    setDismissed([]);
    void queryClient.invalidateQueries({ queryKey: getGetDiscoveryFeedQueryKey(params) });
  }

  function handleApplyFilters() {
    setFilters(draftFilters);
    setDismissed([]);
    setFiltersOpen(false);
  }

  function handleResetFilters() {
    setDraftFilters(DEFAULT_FILTERS);
    setFilters(DEFAULT_FILTERS);
    setDismissed([]);
    setFiltersOpen(false);
  }

  const activeFilterCount = Number(Boolean(filters.minAge || filters.maxAge)) + Number(filters.onlyVerified);

  if (intent === "Friends") {
    return <FriendsExperience />;
  }

  return (
    <div className="min-h-screen overflow-hidden bg-[#050505] text-white">
      <div className="mx-auto min-h-screen max-w-md bg-[#050505] pb-24">
        <header className="flex items-center justify-between px-5 pt-8">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Discover</h1>
            <div className="mt-1 flex items-center gap-1 text-xs text-zinc-400">
              <Flame size={14} className="text-[#FF299B]" />
              {isFetching ? "Refreshing nearby profiles" : `${filteredUsers.length} people waiting`}
              <span className="h-2 w-2 rounded-full bg-green-400" />
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className="relative rounded-full border border-white/10 bg-white/5 p-3 text-zinc-200"
          >
            <SlidersHorizontal size={20} />
            {activeFilterCount > 0 ? (
              <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-[#FF299B] text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            ) : null}
          </button>
        </header>

        <IntentTabs
          active={intent}
          setActive={(next) => {
            setIntent(next);
            setSubIntent("All");
            setDismissed([]);
          }}
        />

        <SubIntentChips
          intent={intent}
          active={subIntent}
          setActive={(chip) => {
            setSubIntent(chip);
            setDismissed([]);
          }}
        />

        <div className="relative mx-5 mt-4 h-[58vh] min-h-[480px]">
          <AnimatePresence mode="popLayout">
            {filteredUsers.slice(0, 2).reverse().map((user, index, stack) => {
              const isTop = index === stack.length - 1;
              return (
                <SwipeCard
                  key={user.id}
                  user={user}
                  isTop={isTop}
                  onSwipe={handleSwipe}
                  onOpen={() => setPreview(user)}
                />
              );
            })}
          </AnimatePresence>

          {!isFetching && filteredUsers.length === 0 ? (
            <div className="grid h-full place-items-center rounded-[30px] border border-white/10 bg-white/[.03] p-8 text-center">
              <div>
                <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-gradient-to-r from-[#FF299B] to-purple-700 text-4xl">
                  <Zap />
                </div>
                <h2 className="mt-5 text-2xl font-black">You're all caught up!</h2>
                <p className="mt-2 text-sm text-zinc-400">Try another vibe, reset swipes, or loosen your filters.</p>
                <button
                  type="button"
                  onClick={handleResetDiscover}
                  className="mt-5 rounded-full bg-gradient-to-r from-[#FF299B] to-purple-700 px-6 py-3 font-bold"
                >
                  Reset Discover
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {topUser ? (
          <ActionButtons
            onPass={() => {
              void handleSwipe("pass", topUser);
            }}
            onSuper={() => {
              void handleSwipe("super", topUser);
            }}
            onLike={() => {
              void handleSwipe("like", topUser);
            }}
          />
        ) : null}

        <nav className="fixed bottom-0 left-1/2 grid w-full max-w-md -translate-x-1/2 grid-cols-5 border-t border-white/10 bg-zinc-950/95 px-3 pb-5 pt-3 text-[11px] backdrop-blur-xl">
          {NAV_ITEMS.map((item, index) => (
            <Link key={item.label} href={item.href}>
              <div className={`text-center transition-colors ${index === 0 ? "text-pink-400" : "text-zinc-500 hover:text-zinc-300"}`}>
                {item.label}
              </div>
            </Link>
          ))}
        </nav>
      </div>

      <AnimatePresence>
        {matchUser ? <MatchModal user={matchUser} onClose={() => setMatchUser(null)} /> : null}
      </AnimatePresence>

      <AnimatePresence>
        {preview ? (
          <PreviewSheet
            user={preview}
            onClose={() => setPreview(null)}
            onLike={() => {
              const selectedUser = preview;
              setPreview(null);
              void handleSwipe("like", selectedUser);
            }}
          />
        ) : null}
      </AnimatePresence>

      <FilterSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        draftFilters={draftFilters}
        setDraftFilters={setDraftFilters}
        onReset={handleResetFilters}
        onApply={handleApplyFilters}
      />
    </div>
  );
}

export default function DiscoverPage() {
  const { data: myProfile, isLoading } = useGetMyProfile({
    query: { queryKey: getGetMyProfileQueryKey() },
  });

  const hasProfile = Boolean(myProfile && (myProfile as { displayName?: string }).displayName);

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#050505]">
        <div className="text-sm text-zinc-500">Finding people near you...</div>
      </div>
    );
  }

  if (!hasProfile) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#050505]">
        <div className="text-center">
          <p className="mb-4 text-zinc-400">Complete your profile first to start discovering.</p>
          <Link href="/onboarding">
            <button
              type="button"
              className="rounded-full bg-gradient-to-r from-[#FF299B] to-purple-700 px-6 py-3 font-bold text-white"
            >
              Set Up Profile
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return <ViralDiscoverTab />;
}
