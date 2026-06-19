import { Link } from "wouter";
import {
  CalendarDays,
  Check,
  ChevronRight,
  Coffee,
  MessageCircle,
  MoreHorizontal,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Nav } from "@/components/layout/nav";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetMatches, getGetMatchesQueryKey } from "@workspace/api-client-react";

const requests = [
  { name: "Maya Johnson", note: "Coffee Person · Brickell", initials: "MJ" },
  { name: "Jules Rivera", note: "New to Miami · Study Mode", initials: "JR" },
];

const connections = [
  { name: "Omar Ellis", note: "Gym Energy · Wynwood", initials: "OE", status: "Active tonight" },
  { name: "Nina Patel", note: "Family-Friendly · Coral Gables", initials: "NP", status: "Chill mode" },
  { name: "Sam Taylor", note: "Creative · Downtown", initials: "ST", status: "Looking for plans" },
];

const plans = [
  { title: "Coffee after work", meta: "Today · Brickell · 2 people", icon: Coffee },
  { title: "Weekend park walk", meta: "Saturday · accessible route", icon: CalendarDays },
];

function Initials({ value }: { value: string }) {
  return (
    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#FF299B] to-purple-700 text-sm font-black text-white shadow-[0_0_22px_rgba(255,41,155,.25)]">
      {value}
    </div>
  );
}

type Match = {
  id: string;
  otherProfile?: { displayName?: string | null };
  lastMessage?: { content?: string | null; senderId?: string | null };
  unreadCount?: number;
};

function initialsFromName(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "CS";
}

export default function MatchesPage() {
  const matchParams = { page: 1, limit: 20 };
  const { data: matchesData, isLoading: matchesLoading } = useGetMatches(matchParams, {
    query: { queryKey: getGetMatchesQueryKey(matchParams) },
  });
  const matchChats = ((matchesData as { matches?: Match[] } | undefined)?.matches ?? []).map((match) => {
    const name = match.otherProfile?.displayName || "ConnectSphere match";
    return {
      id: match.id,
      name,
      initials: initialsFromName(name),
      note: match.lastMessage?.content || "New match. Say hey and get the conversation moving.",
      count: match.unreadCount ?? 0,
    };
  });

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Nav />
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-24 md:pb-10">
        <section className="rounded-[32px] border border-white/10 bg-white/[.04] p-5 shadow-[0_24px_90px_rgba(255,41,155,.12)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black">Connect</h1>
              <p className="mt-1 text-sm text-zinc-400">Requests, connections, chats, and active plans.</p>
            </div>
            <div className="grid h-12 w-12 place-items-center rounded-full border border-pink-300/30 bg-pink-400/10 text-[#FF299B]">
              <Users size={22} />
            </div>
          </div>
        </section>

        <section className="mt-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-wide text-zinc-300">Requests</h2>
            <span className="rounded-full bg-[#FF299B] px-2.5 py-1 text-xs font-black">{requests.length}</span>
          </div>
          <div className="grid gap-3">
            {requests.map((request) => (
              <div key={request.name} className="flex items-center gap-3 rounded-[24px] border border-white/10 bg-white/[.05] p-3">
                <Initials value={request.initials} />
                <div className="min-w-0 flex-1">
                  <div className="font-black">{request.name}</div>
                  <div className="text-xs text-zinc-400">{request.note}</div>
                </div>
                <button type="button" className="grid h-9 w-9 place-items-center rounded-full bg-white text-black">
                  <Check size={16} />
                </button>
                <button type="button" className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-zinc-400">
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6">
          <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-zinc-300">Connections</h2>
          <div className="grid gap-3">
            {connections.map((connection) => (
              <div key={connection.name} className="flex items-center gap-3 rounded-[24px] border border-white/10 bg-zinc-950 p-3">
                <Initials value={connection.initials} />
                <div className="min-w-0 flex-1">
                  <div className="font-black">{connection.name}</div>
                  <div className="text-xs text-zinc-400">{connection.note}</div>
                  <div className="mt-1 text-[11px] font-bold text-pink-200">{connection.status}</div>
                </div>
                <button type="button" className="rounded-full bg-pink-400/10 px-3 py-2 text-xs font-black text-pink-100">
                  Plan
                </button>
                <MessageCircle size={18} className="text-zinc-400" />
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-[28px] border border-white/10 bg-white/[.04] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-wide text-zinc-300">Chats</h2>
              <MoreHorizontal size={18} className="text-zinc-500" />
            </div>
            <div className="grid gap-3">
              {matchesLoading ? (
                <>
                  <Skeleton className="h-16 rounded-[20px] bg-white/10" />
                  <Skeleton className="h-16 rounded-[20px] bg-white/10" />
                </>
              ) : matchChats.length ? matchChats.map((chat) => (
                <Link key={chat.id} href={`/messages/${chat.id}`}>
                  <div className="flex items-center gap-3 rounded-[20px] bg-black/30 p-3">
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-white/10">
                      <span className="text-xs font-black text-pink-100">{chat.initials}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-black">{chat.name}</div>
                      <div className="truncate text-xs text-zinc-400">{chat.note}</div>
                    </div>
                    {chat.count ? <span className="grid h-6 w-6 place-items-center rounded-full bg-[#FF299B] text-xs font-black">{chat.count}</span> : null}
                  </div>
                </Link>
              )) : (
                <Link href="/discover">
                  <div className="rounded-[20px] border border-dashed border-pink-300/30 bg-pink-400/10 p-4 text-sm font-bold text-pink-100">
                    No chats yet. Discover people and start your first match.
                  </div>
                </Link>
              )}
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/[.04] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-wide text-zinc-300">Active Plans</h2>
              <UserPlus size={18} className="text-[#FF299B]" />
            </div>
            <div className="grid gap-3">
              {plans.map(({ title, meta, icon: Icon }) => (
                <div key={title} className="flex items-center gap-3 rounded-[20px] bg-black/30 p-3">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-[#FF299B] to-purple-700">
                    <Icon size={17} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-black">{title}</div>
                    <div className="truncate text-xs text-zinc-400">{meta}</div>
                  </div>
                  <ChevronRight size={17} className="text-zinc-500" />
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
