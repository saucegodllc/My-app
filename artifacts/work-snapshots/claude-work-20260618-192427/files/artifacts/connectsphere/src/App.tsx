import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClerkProvider, useAuth } from "@clerk/react";
import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import LandingPage from "@/pages/landing";
import SignInPage from "@/pages/sign-in";
import SignUpPage from "@/pages/sign-up";
import OnboardingPage from "@/pages/onboarding";
import DiscoverPage from "@/pages/discover";
import MatchesPage from "@/pages/matches";
import MessagesPage from "@/pages/messages";
import DashboardPage from "@/pages/dashboard";
import PremiumPage from "@/pages/premium";
import ProfileMePage from "@/pages/profile-me";
import ProfilePage from "@/pages/profile";
import SettingsPage from "@/pages/settings";
import LegalPage from "@/pages/legal";
import AdminModerationPage from "@/pages/admin-moderation";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

setBaseUrl(null);
const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const isLocalPreviewMode = !clerkPublishableKey;

function AuthSync() {
  const { getToken } = useAuth();
  useEffect(() => {
    setAuthTokenGetter(() => getToken());
  }, [getToken]);
  return null;
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  if (isLocalPreviewMode) return <Component />;
  const { isSignedIn, isLoaded } = useAuth();
  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  return <Component />;
}

function PublicOnlyRoute({ component: Component }: { component: React.ComponentType }) {
  if (isLocalPreviewMode) return <Component />;
  const { isSignedIn, isLoaded } = useAuth();
  if (!isLoaded) return null;
  if (isSignedIn) return <Redirect to="/discover" />;
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <PublicOnlyRoute component={LandingPage} />} />
      <Route path="/sign-in" component={() => <PublicOnlyRoute component={SignInPage} />} />
      <Route path="/sign-up" component={() => <PublicOnlyRoute component={SignUpPage} />} />
      <Route path="/onboarding" component={() => <ProtectedRoute component={OnboardingPage} />} />
      <Route path="/discover" component={() => <ProtectedRoute component={DiscoverPage} />} />
      <Route path="/matches" component={() => <ProtectedRoute component={MatchesPage} />} />
      <Route path="/messages/:matchId" component={() => <ProtectedRoute component={MessagesPage} />} />
      <Route path="/dashboard" component={() => <ProtectedRoute component={DashboardPage} />} />
      <Route path="/premium" component={() => <ProtectedRoute component={PremiumPage} />} />
      <Route path="/profile/me" component={() => <ProtectedRoute component={ProfileMePage} />} />
      <Route path="/profile/:userId" component={() => <ProtectedRoute component={ProfilePage} />} />
      <Route path="/settings" component={() => <ProtectedRoute component={SettingsPage} />} />
      <Route path="/admin/moderation" component={() => <ProtectedRoute component={AdminModerationPage} />} />
      <Route path="/legal/privacy" component={() => <LegalPage kind="privacy" />} />
      <Route path="/legal/terms" component={() => <LegalPage kind="terms" />} />
      <Route path="/legal/community-guidelines" component={() => <LegalPage kind="guidelines" />} />
      <Route path="/safety" component={() => <LegalPage kind="safety" />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  if (isLocalPreviewMode) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster position="top-center" richColors />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey}
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AuthSync />
            <Router />
          </WouterRouter>
          <Toaster position="top-center" richColors />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default App;
