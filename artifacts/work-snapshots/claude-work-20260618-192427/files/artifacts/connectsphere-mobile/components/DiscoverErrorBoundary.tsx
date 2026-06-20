/**
 * DiscoverErrorBoundary
 * ─────────────────────
 * Class-based React error boundary that catches any render crash inside the
 * Discover screen (SwipeDeck, DatingMatchModal, ProfileBoostBanner, etc.) and
 * shows a recoverable "Something went wrong" UI instead of a white screen.
 *
 * Why class-based: React's componentDidCatch / getDerivedStateFromError API
 * is only available on class components — there is no hook equivalent.
 *
 * Usage:
 *   <DiscoverErrorBoundary>
 *     <DiscoverScreen />
 *   </DiscoverErrorBoundary>
 *
 * On error:
 *   • Captures to Sentry with full componentStack context
 *   • Fires Analytics.errorBoundaryTriggered so PostHog can alert
 *   • Shows a minimal recovery card with a "Try Again" button
 *   • "Try Again" resets the error state — React will re-mount the subtree
 */

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Sentry } from "@/lib/sentry";
import { Analytics } from "@/lib/analytics";

interface Props {
  children: ReactNode;
  /** Optional fallback override — if omitted, the default recovery card renders. */
  fallback?: (retry: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string | null;
}

export class DiscoverErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, errorMessage: null };

  static getDerivedStateFromError(error: unknown): State {
    const msg =
      error instanceof Error
        ? error.message
        : typeof error === "string"
        ? error
        : "Unknown error";
    return { hasError: true, errorMessage: msg };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    // Ship to Sentry with component stack so we know exactly which component crashed
    Sentry.captureException(error, {
      componentStack: info.componentStack ?? "unavailable",
      source: "DiscoverErrorBoundary",
    });

    // PostHog event so we can alert on crash spikes without Sentry
    Analytics.errorBoundaryTriggered("discover", {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  retry = () => {
    this.setState({ hasError: false, errorMessage: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(this.retry);
      }
      return <DiscoverCrashFallback onRetry={this.retry} />;
    }
    return this.props.children;
  }
}

// ─── Default fallback UI ─────────────────────────────────────────────────────

function DiscoverCrashFallback({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.root}>
      {/* Ambient glow blob */}
      <View pointerEvents="none" style={styles.blob} />

      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <LinearGradient
            colors={["#EC4899", "#A855F7"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: 999 }]}
          />
          <Ionicons name="refresh-circle-outline" size={34} color="#fff" />
        </View>

        <Text style={styles.title}>Discover hit a snag</Text>
        <Text style={styles.body}>
          Something unexpected happened loading your feed. Your matches and
          messages are safe — this is just the discovery screen.
        </Text>

        <Pressable onPress={onRetry} style={({ pressed }) => [styles.btn, pressed && { opacity: 0.82 }]}>
          <LinearGradient
            colors={["#EC4899", "#A855F7"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.btnGrad}
          >
            <Ionicons name="refresh" size={16} color="#fff" />
            <Text style={styles.btnText}>Try Again</Text>
          </LinearGradient>
        </Pressable>

        <Text style={styles.hint}>
          If this keeps happening, restart the app or check your connection.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#020003",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  blob: {
    position: "absolute",
    top: "20%",
    alignSelf: "center",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(236,72,153,0.10)",
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    paddingVertical: 40,
    paddingHorizontal: 28,
    alignItems: "center",
    gap: 16,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontFamily: "Sora_700Bold",
    color: "#F4F4F5",
    textAlign: "center",
  },
  body: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#A1A1AA",
    textAlign: "center",
    lineHeight: 21,
  },
  btn: {
    width: "100%",
    borderRadius: 999,
    marginTop: 8,
    shadowColor: "#EC4899",
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 10,
  },
  btnGrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 999,
  },
  btnText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  hint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#52525B",
    textAlign: "center",
    marginTop: 4,
  },
});
