import {
  useGetDashboardSummary,
  useGetWhoLikedMe,
  getGetDashboardSummaryQueryKey,
  getGetWhoLikedMeQueryKey,
} from "@workspace/api-client-react";
import { Nav } from "@/components/layout/nav";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Heart, MessageCircle, Eye, Sparkles, Star, TrendingUp, Lock } from "lucide-react";
import { motion } from "framer-motion";

type Profile = { userId: string; displayName: string; age?: number | null; location?: string | null; photos?: string[] | null };
type WhoLikedData = { profiles?: Profile[]; isPremiumRequired?: boolean; count?: number };
type Summary = {
  totalMatches: number;
  newMatchesToday: number;
  unreadMessages: number;
  profileViews: number;
  likesReceived: number;
  superLikesReceived: number;
  isPremium: boolean;
};

export default function DashboardPage() {
  const { data: summary, isLoading: sumLoading } = useGetDashboardSummary({
    query: { queryKey: getGetDashboardSummaryQueryKey() },
  });
  const { data: whoLikedData, isLoading: wlLoading } = useGetWhoLikedMe({
    query: { queryKey: getGetWhoLikedMeQueryKey() },
  });

  const sum = summary as Summary | undefined;
  const wld = whoLikedData as WhoLikedData | undefined;

  const stats = sum
    ? [
        { label: "Total Matches", value: sum.totalMatches, icon: Heart, color: "text-fuchsia-400" },
        { label: "New Today", value: sum.newMatchesToday, icon: TrendingUp, color: "text-emerald-500" },
        { label: "Unread Messages", value: sum.unreadMessages, icon: MessageCircle, color: "text-pink-400" },
        { label: "Profile Views", value: sum.profileViews, icon: Eye, color: "text-blue-500" },
        { label: "Likes Received", value: sum.likesReceived, icon: Heart, color: "text-rose-400" },
        { label: "Super Likes", value: sum.superLikesReceived, icon: Star, color: "text-amber-500" },
      ]
    : [];

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main className="pt-20 pb-24 md:pb-8 px-4 max-w-3xl mx-auto">
        <div className="py-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground text-sm">Your connection activity at a glance</p>
          </div>
          {sum && !sum.isPremium && (
            <Link href="/premium">
              <Button size="sm" className="bg-gradient-to-r from-pink-500 to-fuchsia-500 border-0 text-white">
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                Go Premium
              </Button>
            </Link>
          )}
        </div>

        {sumLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="p-4 rounded-xl bg-card border border-border"
              >
                <div className={`${stat.color} mb-2`}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        )}

        <div className="rounded-2xl bg-card border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg">Who Liked You</h2>
            {wld?.isPremiumRequired && (
              <Link href="/premium">
                <Button size="sm" variant="outline" className="text-xs">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Unlock Premium
                </Button>
              </Link>
            )}
          </div>

          {wlLoading ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {[...Array(8)].map((_, i) => <Skeleton key={i} className="aspect-square rounded-xl" />)}
            </div>
          ) : wld?.isPremiumRequired ? (
            <div className="relative">
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 filter blur-sm pointer-events-none select-none" aria-hidden>
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="aspect-square rounded-xl bg-muted" />
                ))}
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="bg-card border border-border rounded-2xl p-6 text-center shadow-lg max-w-xs">
                  <Lock className="w-8 h-8 text-primary mx-auto mb-3" />
                  <h3 className="font-semibold mb-1">
                    {wld.count !== undefined ? `${wld.count} people liked you!` : "People liked you!"}
                  </h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    Upgrade to Premium to see who liked you and match instantly.
                  </p>
                  <Link href="/premium">
                    <Button className="bg-gradient-to-r from-pink-500 to-fuchsia-500 border-0 text-white w-full">
                      <Sparkles className="w-4 h-4 mr-1.5" />
                      Upgrade Now
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          ) : !wld?.profiles || wld.profiles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No one has liked you yet. Keep swiping to get noticed!
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {wld.profiles.map((profile) => (
                <Link key={profile.userId} href={`/profile/${profile.userId}`}>
                  <div className="aspect-square rounded-xl overflow-hidden bg-primary/10 relative cursor-pointer hover:ring-2 hover:ring-primary transition-all">
                    {profile.photos?.[0] ? (
                      <img
                        src={`${import.meta.env.BASE_URL}api/storage/objects/${(profile.photos[0] ?? "").replace(/^\/objects\//, "")}`}
                        alt={profile.displayName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-2xl font-bold text-primary">{profile.displayName.charAt(0)}</span>
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 p-2">
                      <p className="text-white text-xs font-medium truncate">{profile.displayName}</p>
                      {profile.age && <p className="text-white/70 text-xs">{profile.age}</p>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
