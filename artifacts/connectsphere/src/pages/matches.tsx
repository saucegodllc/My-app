import { useGetMatches, getGetMatchesQueryKey } from "@workspace/api-client-react";
import { Nav } from "@/components/layout/nav";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { MessageCircle, Heart } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

type Profile = { displayName: string; photos?: string[] | null };
type Message = { content: string; createdAt: string };
type Match = { id: string; matchedAt: string; otherProfile?: Profile; lastMessage?: Message; unreadCount: number };

export default function MatchesPage() {
  const params = { page: 1, limit: 50 };
  const { data, isLoading } = useGetMatches(params, {
    query: { queryKey: getGetMatchesQueryKey(params) },
  });

  const matches = (data as { matches?: Match[] })?.matches ?? [];

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main className="pt-20 pb-24 md:pb-8 px-4 max-w-2xl mx-auto">
        <div className="py-6">
          <h1 className="text-2xl font-bold mb-1">Matches</h1>
          <p className="text-muted-foreground text-sm">People you connected with</p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : matches.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Heart className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-lg font-semibold mb-2">No matches yet</h2>
            <p className="text-muted-foreground text-sm mb-4">Start swiping to find your connections!</p>
            <Link href="/discover" className="text-primary hover:underline font-medium">Go to Discover</Link>
          </div>
        ) : (
          <div className="space-y-2">
            {matches.map((match) => (
              <Link key={match.id} href={`/messages/${match.id}`}>
                <div className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border hover:border-primary/30 transition-colors cursor-pointer">
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-primary/10 shrink-0 relative">
                    {match.otherProfile?.photos?.[0] ? (
                      <img
                        src={`${import.meta.env.BASE_URL}api/storage/objects/${(match.otherProfile.photos[0] ?? "").replace(/^\/objects\//, "")}`}
                        alt={match.otherProfile.displayName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-xl font-bold text-primary">
                          {match.otherProfile?.displayName?.charAt(0) ?? "?"}
                        </span>
                      </div>
                    )}
                    {(match.unreadCount ?? 0) > 0 && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive flex items-center justify-center">
                        <span className="text-xs text-white font-bold">{match.unreadCount > 9 ? "9+" : match.unreadCount}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className={cn("font-semibold truncate", (match.unreadCount ?? 0) > 0 && "text-foreground")}>{match.otherProfile?.displayName ?? "Unknown"}</p>
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">
                        {match.lastMessage
                          ? formatDistanceToNow(new Date(match.lastMessage.createdAt), { addSuffix: true })
                          : formatDistanceToNow(new Date(match.matchedAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className={cn("text-sm truncate", (match.unreadCount ?? 0) > 0 ? "text-foreground font-medium" : "text-muted-foreground")}>
                      {match.lastMessage ? match.lastMessage.content : "You matched! Say hello"}
                    </p>
                  </div>

                  <MessageCircle className="w-4 h-4 text-muted-foreground shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
