import { useQueryClient } from "@tanstack/react-query";
import {
  useGetBlockedUsers,
  useBlockUser,
  useGetSubscriptionStatus,
  getGetBlockedUsersQueryKey,
  getGetSubscriptionStatusQueryKey,
} from "@workspace/api-client-react";
import { useUser, useClerk } from "@clerk/react";
import { useLocation } from "wouter";
import { Nav } from "@/components/layout/nav";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { UserX, CreditCard, LogOut, Sparkles, ShieldCheck } from "lucide-react";

type SubStatus = { isPremium?: boolean; plan?: string; currentPeriodEnd?: string; cancelAtPeriodEnd?: boolean };
type BlockedUser = { userId: string; blockedAt: string };

export default function SettingsPage() {
  const qc = useQueryClient();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [, navigate] = useLocation();

  const { data: blockedData, isLoading: blockedLoading } = useGetBlockedUsers({
    query: { queryKey: getGetBlockedUsersQueryKey() },
  });
  const { data: subStatus } = useGetSubscriptionStatus({
    query: { queryKey: getGetSubscriptionStatusQueryKey() },
  });

  const blockedUsers = (blockedData as { blockedUsers?: BlockedUser[] })?.blockedUsers ?? [];
  const sub = subStatus as SubStatus | undefined;

  async function handleSignOut() {
    await signOut();
    navigate("/");
  }

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main className="pt-20 pb-24 md:pb-8 px-4 max-w-2xl mx-auto">
        <div className="py-6">
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground text-sm">Manage your account and safety preferences</p>
        </div>

        <div className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-5">
            <h2 className="font-semibold mb-1 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-muted-foreground" />
              Subscription
            </h2>
            {sub?.isPremium ? (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white text-xs font-semibold">
                    <Sparkles className="w-3 h-3" />
                    Premium Active
                  </span>
                  {sub.plan && <span className="text-sm text-muted-foreground capitalize">{sub.plan}ly billing</span>}
                </div>
                {sub.currentPeriodEnd && (
                  <p className="text-sm text-muted-foreground mb-3">
                    {sub.cancelAtPeriodEnd ? "Cancels" : "Renews"} on {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                  </p>
                )}
                <p className="text-sm text-muted-foreground">
                  Manage your subscription from your App Store account on your iPhone.
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-muted-foreground mb-3">You're on the Free plan.</p>
                <Button size="sm" className="bg-gradient-to-r from-pink-500 to-fuchsia-500 border-0 text-white" onClick={() => navigate("/premium")}>
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  Upgrade to Premium
                </Button>
              </div>
            )}
          </div>

          <div className="bg-card border border-border rounded-2xl p-5">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-muted-foreground" />
              Blocked Users
            </h2>
            {blockedLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : blockedUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">You haven't blocked anyone.</p>
            ) : (
              <div className="space-y-2">
                {blockedUsers.map((bu) => (
                  <div key={bu.userId} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <UserX className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-mono text-muted-foreground">{bu.userId.slice(0, 12)}...</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(bu.blockedAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-card border border-border rounded-2xl p-5">
            <h2 className="font-semibold mb-1">Account</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Signed in as <strong>{user?.primaryEmailAddress?.emailAddress ?? user?.username ?? "User"}</strong>
            </p>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive border-destructive/20 hover:bg-destructive/5">
                  <LogOut className="w-4 h-4 mr-1.5" />
                  Sign Out
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Sign out?</AlertDialogTitle>
                  <AlertDialogDescription>You'll need to sign in again to access your account.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleSignOut}>Sign Out</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </main>
    </div>
  );
}
