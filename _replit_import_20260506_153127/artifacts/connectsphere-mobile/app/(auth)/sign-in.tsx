import { useOAuth, useSignIn } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  ActivityIndicator,
  Alert,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

WebBrowser.maybeCompleteAuthSession();

const PINK = "#FF299B";
const BG = "#060010";

function extractClerkError(err: unknown, fallback: string): string {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    if (Array.isArray(e.errors) && e.errors.length > 0) {
      const first = e.errors[0] as Record<string, unknown>;
      return (first.longMessage as string) || (first.message as string) || fallback;
    }
    if (typeof e.message === "string") return e.message;
  }
  return fallback;
}

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const { startOAuthFlow: googleOAuth } = useOAuth({ strategy: "oauth_google" });
  const { startOAuthFlow: appleOAuth } = useOAuth({ strategy: "oauth_apple" });
  const { startOAuthFlow: linkedinOAuth } = useOAuth({ strategy: "oauth_linkedin_oidc" });

  const [mode, setMode] = useState<"email" | "phone">("email");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);

  const passwordRef = useRef<TextInput>(null);
  const redirectUrl = Linking.createURL("/", { scheme: "connectsphere" });

  async function handleOAuth(strategy: "google" | "apple" | "linkedin") {
    const flow = strategy === "google" ? googleOAuth : strategy === "apple" ? appleOAuth : linkedinOAuth;
    setOauthLoading(strategy);
    try {
      const { createdSessionId, setActive: sa } = await flow({ redirectUrl });
      if (createdSessionId && sa) {
        await sa({ session: createdSessionId });
      }
    } catch (err: unknown) {
      Alert.alert("Sign In Failed", extractClerkError(err, `Could not sign in with ${strategy}.`));
    } finally {
      setOauthLoading(null);
    }
  }

  async function handleSignIn() {
    if (!isLoaded) return;
    if (!identifier.trim()) {
      Alert.alert("Missing Info", mode === "email" ? "Please enter your email." : "Please enter your phone number.");
      return;
    }
    if (mode === "email" && !password) {
      Alert.alert("Missing Info", "Please enter your password.");
      return;
    }
    setLoading(true);
    try {
      const id = mode === "email"
        ? identifier.trim().toLowerCase()
        : identifier.trim().startsWith("+") ? identifier.trim() : `+1${identifier.trim().replace(/\D/g, "")}`;
      const result = await signIn!.create({ identifier: id, ...(mode === "email" ? { password } : {}) });
      if (result.status === "complete") {
        await setActive!({ session: result.createdSessionId });
      }
    } catch (err: unknown) {
      Alert.alert("Sign In Failed", extractClerkError(err, "Incorrect credentials. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      {/* Glow orbs — slow floating drift */}
      <GlowOrb size={480} top={-160} right={-140} color="rgba(255,41,155,0.42)" driftX={-28} driftY={22} duration={7000} delay={0} />
      <GlowOrb size={320} bottom={60} left={-100} color="rgba(160,40,255,0.28)" driftX={22} driftY={-30} duration={9000} delay={1200} />
      <GlowOrb size={150} top={320} left={-30} color="rgba(255,41,155,0.18)" driftX={18} driftY={18} duration={5500} delay={600} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: topInset + 16, paddingBottom: bottomInset + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back button */}
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <BlurView intensity={20} tint="dark" style={styles.backBtnBlur}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </BlurView>
          </Pressable>

          {/* Brand + headline */}
          <View style={styles.headline}>
            <Text style={styles.wordmark}>ConnectSphere</Text>
            <Text style={styles.title}>Welcome{"\n"}back</Text>
            <Text style={styles.subtitle}>Sign in to your ConnectSphere account</Text>
          </View>

          {/* Glass card */}
          <BlurView intensity={24} tint="dark" style={styles.card}>
            <View style={styles.cardInner}>

              {/* Social circles */}
              <View style={styles.socialRow}>
                <SocialCircle onPress={() => handleOAuth("google")} loading={oauthLoading === "google"}>
                  <GoogleG />
                </SocialCircle>
                <SocialCircle onPress={() => handleOAuth("apple")} loading={oauthLoading === "apple"}>
                  <Ionicons name="logo-apple" size={26} color="#fff" />
                </SocialCircle>

                <SocialCircle onPress={() => handleOAuth("linkedin")} loading={oauthLoading === "linkedin"}>
                  <Ionicons name="logo-linkedin" size={26} color="#0A66C2" />
                </SocialCircle>
              </View>

              {/* Divider */}
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Tab switcher */}
              <View style={styles.tabRow}>
                <TabPill
                  label="Email"
                  icon="mail-outline"
                  active={mode === "email"}
                  onPress={() => { setMode("email"); setIdentifier(""); setPassword(""); }}
                />
                <TabPill
                  label="Phone"
                  icon="phone-portrait-outline"
                  active={mode === "phone"}
                  onPress={() => { setMode("phone"); setIdentifier(""); setPassword(""); }}
                />
              </View>

              {/* Form */}
              <View style={styles.form}>
                <GlassInput
                  placeholder={mode === "email" ? "your@email.com" : "(305) 000-0000"}
                  value={identifier}
                  onChangeText={setIdentifier}
                  keyboardType={mode === "email" ? "email-address" : "phone-pad"}
                  autoCapitalize="none"
                  returnKeyType={mode === "email" ? "next" : "done"}
                  onSubmitEditing={mode === "email" ? () => passwordRef.current?.focus() : handleSignIn}
                  prefix={mode === "phone" ? "+1" : undefined}
                />

                {mode === "email" && (
                  <GlassInput
                    ref={passwordRef}
                    placeholder="Your password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    returnKeyType="done"
                    onSubmitEditing={handleSignIn}
                    rightIcon={
                      <Pressable onPress={() => setShowPassword(!showPassword)}>
                        <Ionicons name={showPassword ? "eye-off" : "eye"} size={18} color="rgba(255,255,255,0.35)" />
                      </Pressable>
                    }
                  />
                )}

                {/* Forgot password */}
                <Pressable style={styles.forgotRow}>
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </Pressable>

                {/* CTA */}
                <Pressable onPress={handleSignIn} disabled={loading || oauthLoading !== null} testID="sign-in-submit">
                  {({ pressed }) => (
                    <LinearGradient
                      colors={["#FF299B", "#c4006e", "#8B00C9"]}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={[styles.ctaButton, { opacity: pressed || loading ? 0.8 : 1 }]}
                    >
                      {loading
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.ctaText}>Sign In →</Text>}
                    </LinearGradient>
                  )}
                </Pressable>

                <Text style={styles.legal}>
                  By signing in you agree to our{" "}
                  <Text style={{ color: "rgba(255,41,155,0.8)" }}>Terms</Text>
                  {" "}and{" "}
                  <Text style={{ color: "rgba(255,41,155,0.8)" }}>Privacy Policy</Text>.
                </Text>
              </View>
            </View>
          </BlurView>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <Pressable onPress={() => router.replace("/(auth)/sign-up")}>
              <Text style={[styles.footerText, { color: PINK, fontFamily: "Inter_600SemiBold" }]}>Sign Up</Text>
            </Pressable>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function GlowOrb({ size, top, right, bottom, left, color, driftX = 0, driftY = 0, duration = 5000, delay = 0 }: {
  size: number; color: string;
  top?: number; right?: number; bottom?: number; left?: number;
  driftX?: number; driftY?: number; duration?: number; delay?: number;
}) {
  const animX = useRef(new Animated.Value(0)).current;
  const animY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loopX = Animated.loop(
      Animated.sequence([
        Animated.timing(animX, { toValue: driftX, duration, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        Animated.timing(animX, { toValue: 0, duration, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      ])
    );
    const loopY = Animated.loop(
      Animated.sequence([
        Animated.timing(animY, { toValue: driftY, duration: duration * 1.4, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        Animated.timing(animY, { toValue: 0, duration: duration * 1.4, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      ])
    );
    Animated.sequence([Animated.delay(delay)]).start(() => loopX.start());
    loopY.start();
    return () => { loopX.stop(); loopY.stop(); };
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        width: size, height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        top, right, bottom, left,
        opacity: 0.9,
        transform: [{ translateX: animX }, { translateY: animY }],
      }}
    />
  );
}

function SocialCircle({ children, onPress, loading }: {
  children: React.ReactNode;
  onPress: () => void;
  loading: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => [styles.socialCircle, { opacity: pressed || loading ? 0.7 : 1 }]}
    >
      {loading ? <ActivityIndicator size="small" color={PINK} /> : children}
    </Pressable>
  );
}

function TabPill({ label, icon, active, onPress }: {
  label: string; icon: string; active: boolean; onPress: () => void;
}) {
  if (active) {
    return (
      <LinearGradient
        colors={["#FF299B", "#c4006e"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={styles.tabPill}
      >
        <Pressable onPress={onPress} style={styles.tabPillInner}>
          <Ionicons name={icon as never} size={15} color="#fff" />
          <Text style={[styles.tabText, { color: "#fff" }]}>{label}</Text>
        </Pressable>
      </LinearGradient>
    );
  }
  return (
    <Pressable onPress={onPress} style={[styles.tabPill, styles.tabPillInner]}>
      <Ionicons name={icon as never} size={15} color="rgba(255,255,255,0.4)" />
      <Text style={[styles.tabText, { color: "rgba(255,255,255,0.4)" }]}>{label}</Text>
    </Pressable>
  );
}

const GlassInput = ({
  ref: _ref, placeholder, value, onChangeText, keyboardType, autoCapitalize,
  returnKeyType, onSubmitEditing, secureTextEntry, rightIcon, prefix,
}: any) => (
  <View style={styles.inputWrapper}>
    {prefix && <Text style={styles.inputPrefix}>{prefix}</Text>}
    <TextInput
      ref={_ref}
      style={styles.inputField}
      placeholder={placeholder}
      placeholderTextColor="rgba(255,255,255,0.3)"
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize ?? "none"}
      autoCorrect={false}
      returnKeyType={returnKeyType}
      onSubmitEditing={onSubmitEditing}
      secureTextEntry={secureTextEntry}
    />
    {rightIcon}
  </View>
);

function GoogleG() {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24">
      <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: 20, gap: 20 },

  backBtn: { alignSelf: "flex-start", marginBottom: 4 },
  backBtnBlur: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
  },

  headline: { gap: 6 },
  wordmark: {
    fontSize: 11, fontFamily: "Inter_700Bold",
    letterSpacing: 3, textTransform: "uppercase",
    color: PINK,
  },
  title: {
    fontSize: 32, fontFamily: "Inter_700Bold",
    color: "#fff", letterSpacing: -0.5, lineHeight: 38,
  },
  subtitle: {
    fontSize: 14, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.45)",
  },

  card: {
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,41,155,0.2)",
  },
  cardInner: {
    padding: 20,
    gap: 16,
    backgroundColor: "rgba(255,255,255,0.03)",
  },

  socialRow: { flexDirection: "row", justifyContent: "center", gap: 12 },
  socialCircle: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center", justifyContent: "center",
  },

  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.08)" },
  dividerText: {
    fontSize: 11, fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.3)",
    letterSpacing: 2, textTransform: "uppercase",
  },

  tabRow: {
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 18, borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    padding: 4, gap: 4,
  },
  tabPill: { flex: 1, borderRadius: 14, overflow: "hidden" },
  tabPillInner: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, height: 40,
  },
  tabText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  form: { gap: 10 },
  inputWrapper: {
    flexDirection: "row", alignItems: "center",
    height: 52, borderRadius: 16, borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 16, gap: 8,
  },
  inputPrefix: { fontSize: 15, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.5)" },
  inputField: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", color: "#fff" },

  forgotRow: { alignItems: "flex-end" },
  forgotText: { fontSize: 13, fontFamily: "Inter_500Medium", color: PINK },

  ctaButton: {
    height: 54, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
    marginTop: 4,
    shadowColor: PINK,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  },
  ctaText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },

  legal: {
    fontSize: 10, fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.3)",
    textAlign: "center", lineHeight: 16,
  },

  footer: { flexDirection: "row", justifyContent: "center", paddingTop: 4 },
  footerText: { fontSize: 14, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.45)" },
});
