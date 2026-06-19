/**
 * ConnectSphere Design System Tokens
 * Single source of truth — import from here, never hardcode values in components.
 */

// ── Brand Colors ──────────────────────────────────────────────────────────────
export const BRAND = {
  /** Primary pink — CTAs, active states, like stamp */
  pink: "#FF2DA8",
  /** Hot pink — gradients, verified badge */
  hotPink: "#FB3D8E",
  /** Deeper rose — pressed states */
  rose: "#D91880",
  /** Purple — super-like, premium, double-date */
  purple: "#A855F7",
  /** Cyan — friendship mode accent */
  cyan: "#22D3EE",
  /** Blue — message reactions, info */
  blue: "#3B82F6",
  /** Sky blue — friend mode secondary */
  sky: "#38BDF8",
  /** Green — online dot, success */
  green: "#22C55E",
  /** Amber — warnings, events */
  amber: "#F59E0B",
  /** Red — pass button, error, block */
  red: "#F87171",
  /** Gold — premium, sparks */
  gold: "#FBBF24",
} as const;

// ── Neutral Palette ────────────────────────────────────────────────────────────
export const NEUTRAL = {
  black: "#000000",
  /** App background */
  bg: "#050506",
  /** Card surface */
  card: "#101014",
  /** Elevated card */
  card2: "#18181B",
  /** Input / modal surface */
  surface: "#1C1C1E",
  /** Divider / border */
  border: "rgba(255,255,255,0.10)",
  /** Strong border */
  borderStrong: "rgba(255,255,255,0.18)",
  /** Glass overlay */
  glass: "rgba(255,255,255,0.07)",
  /** Primary text */
  text: "#FFFFFF",
  /** Secondary text */
  textMuted: "rgba(255,255,255,0.58)",
  /** Tertiary / placeholder */
  textFaint: "rgba(255,255,255,0.32)",
  /** Disabled */
  textDisabled: "rgba(255,255,255,0.18)",
  white: "#FFFFFF",
} as const;

// ── Semantic Colors ────────────────────────────────────────────────────────────
export const SEMANTIC = {
  like: BRAND.pink,
  likeSoft: "rgba(255,45,168,0.18)",
  pass: BRAND.red,
  passSoft: "rgba(248,113,113,0.18)",
  superLike: "#60A5FA",
  superLikeSoft: "rgba(96,165,250,0.18)",
  match: BRAND.pink,
  online: BRAND.green,
  offline: "#71717A",
  premium: BRAND.gold,
  verified: BRAND.pink,
  danger: BRAND.red,
  success: BRAND.green,
  warning: BRAND.amber,
} as const;

// ── Intent Themes ─────────────────────────────────────────────────────────────
export const INTENT_THEME = {
  dating: {
    accent: BRAND.pink,
    accentSoft: "rgba(255,45,168,0.18)",
    label: "Dating",
    fitLabel: "Match",
    rightStamp: "LIKE",
    upStamp: "SUPER",
    leftStamp: "PASS",
    icon: "flame" as const,
  },
  friendship: {
    accent: BRAND.cyan,
    accentSoft: "rgba(34,211,238,0.18)",
    label: "Friends",
    fitLabel: "Friend Fit",
    rightStamp: "ADD",
    upStamp: "INVITE",
    leftStamp: "SKIP",
    icon: "people" as const,
  },
} as const;

// ── Typography ────────────────────────────────────────────────────────────────
export const TYPE = {
  hero: { fontSize: 38, lineHeight: 44, fontFamily: "Inter_700Bold" },
  h1: { fontSize: 28, lineHeight: 34, fontFamily: "Inter_700Bold" },
  h2: { fontSize: 22, lineHeight: 28, fontFamily: "Inter_700Bold" },
  h3: { fontSize: 18, lineHeight: 24, fontFamily: "Inter_700Bold" },
  title: { fontSize: 16, lineHeight: 22, fontFamily: "Inter_700Bold" },
  body: { fontSize: 15, lineHeight: 22, fontFamily: "Inter_400Regular" },
  bodyMedium: { fontSize: 15, lineHeight: 22, fontFamily: "Inter_500Medium" },
  bodySemi: { fontSize: 15, lineHeight: 22, fontFamily: "Inter_600SemiBold" },
  label: { fontSize: 13, lineHeight: 18, fontFamily: "Inter_500Medium" },
  labelBold: { fontSize: 13, lineHeight: 18, fontFamily: "Inter_700Bold" },
  caption: { fontSize: 11, lineHeight: 16, fontFamily: "Inter_500Medium" },
  captionBold: { fontSize: 11, lineHeight: 16, fontFamily: "Inter_700Bold" },
  micro: { fontSize: 10, lineHeight: 14, fontFamily: "Inter_700Bold" },
} as const;

// ── Spacing ───────────────────────────────────────────────────────────────────
export const SPACE = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
  "6xl": 64,
} as const;

// ── Border Radius ─────────────────────────────────────────────────────────────
export const RADIUS = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  card: 30,
  pill: 999,
} as const;

// ── Shadows ───────────────────────────────────────────────────────────────────
export const SHADOW = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 10,
  },
  glow: (color: string, radius = 22, opacity = 0.45) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: opacity,
    shadowRadius: radius,
    elevation: 6,
  }),
  subtle: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
} as const;

// ── Animation Presets ─────────────────────────────────────────────────────────
export const SPRING = {
  /** Snappy — button presses, toggles */
  snappy: { damping: 20, stiffness: 350, mass: 0.8 },
  /** Bouncy — card flyback, match modal */
  bouncy: { damping: 12, stiffness: 180, mass: 0.9 },
  /** Gentle — sheet slides, modals */
  gentle: { damping: 22, stiffness: 180, mass: 1.0 },
  /** Stiff — tab transitions */
  stiff: { damping: 28, stiffness: 400, mass: 0.7 },
} as const;

// ── Swipe Config ──────────────────────────────────────────────────────────────
export const SWIPE = {
  /** Translation threshold to trigger a swipe */
  distanceThreshold: 0.28, // × screen width
  /** Velocity threshold (px/s) to trigger a swipe regardless of distance */
  velocityThreshold: 600,
  /** Max rotation in degrees at screen edge */
  rotationRange: 12,
  /** Duration (ms) of fly-off animation base */
  flyDuration: 220,
} as const;
