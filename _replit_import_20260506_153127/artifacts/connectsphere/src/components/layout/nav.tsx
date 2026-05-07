import { useLocation, Link } from "wouter";
import { useUser, UserButton } from "@clerk/react";
import { useGetDashboardSummary, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { Globe, Heart, Sparkles, User, Settings, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const navItems = [
  { href: "/discover", label: "Discover", icon: Globe },
  { href: "/matches", label: "Connect", icon: Heart },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/profile/me", label: "Profile", icon: User },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Nav() {
  const [location] = useLocation();
  const { user } = useUser();
  const { data: summary } = useGetDashboardSummary({
    query: { queryKey: getGetDashboardSummaryQueryKey() },
  });

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-6xl mx-auto h-full px-4 flex items-center justify-between">
          <Link href="/discover" className="flex items-center gap-2 font-bold text-xl text-primary">
            <Sparkles className="w-5 h-5" />
            ConnectSphere
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors relative",
                  location === href || location.startsWith(href + "/")
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
                {href === "/matches" && (summary?.unreadMessages ?? 0) > 0 && (
                  <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 p-0 text-xs flex items-center justify-center">
                    {summary!.unreadMessages > 9 ? "9+" : summary!.unreadMessages}
                  </Badge>
                )}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {!summary?.isPremium && (
              <Link
                href="/premium"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white text-xs font-semibold"
              >
                <Sparkles className="w-3 h-3" />
                Go Premium
              </Link>
            )}
            <UserButton />
          </div>
        </div>
      </header>

      <nav className="fixed bottom-0 left-0 right-0 z-[900] md:hidden bg-background/90 backdrop-blur-xl border-t border-border">
        <div className="flex items-center justify-around h-16 px-2">
          {navItems.slice(0, 5).map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors relative",
                location === href || location.startsWith(href + "/")
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              <Icon className="w-5 h-5" />
              {label}
              {href === "/matches" && (summary?.unreadMessages ?? 0) > 0 && (
                <Badge variant="destructive" className="absolute top-1 right-2 h-3 w-3 p-0 text-[8px] flex items-center justify-center">
                  {summary!.unreadMessages > 9 ? "9+" : summary!.unreadMessages}
                </Badge>
              )}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
