# ADR-001: Animation System — Reanimated v3 over the Legacy Animated API

**Status:** Accepted  
**Date:** 2026-06-05  
**Deciders:** Mobile engineering (ConnectSphere)  
**Context file:** `components/DatingMatchModal.tsx`, `components/SwipeCard.tsx`

---

## Context

ConnectSphere's core engagement surfaces — the swipe deck, the "It's a Match!" reveal, and
the action-rail buttons — are animation-heavy. The original `DatingMatchModal` was written
with React Native's built-in `Animated` API (JS-thread driver) and the result was:

- **Soft / low-impact burst**: spring stiffness 160, damping 20 produced a slow float
  rather than the snap expected from a premium match moment
- **Frame drops on mid-range Android**: `Animated` runs JS-side; any JS work during the
  modal open (network calls, re-renders) could stutter the animation
- **No worklet path**: `useNativeDriver: false` was required for `shadowOpacity` and
  interpolated colors, forcing the whole sequence off the native thread
- **Inconsistency**: `SwipeCard.tsx` already uses Reanimated v3 (`useSharedValue`,
  `withSpring`). Two animation systems in one screen creates maintenance overhead

---

## Decision

**Migrate DatingMatchModal (and all future animation-heavy components) to Reanimated v3.**

`SwipeCard` confirms the library is already installed and working. The match modal is the
highest-impact remaining holdout.

---

## Options Considered

### Option A — Keep `Animated` API, tune spring values (rejected)

| Dimension      | Assessment                                              |
|----------------|---------------------------------------------------------|
| Effort         | Low — just change stiffness numbers                     |
| Performance    | JS thread; still drops frames if JS is busy             |
| Consistency    | Two animation APIs in the same file tree               |
| Ceiling        | `useNativeDriver: false` required for glow / shadow     |

**Rejected**: The ceiling is too low. Shadow/glow animations cannot run native, so the most
visually important element (the bloom pulse) always risks jank.

---

### Option B — Reanimated v3 worklets ✅ (accepted)

| Dimension      | Assessment                                                         |
|----------------|--------------------------------------------------------------------|
| Effort         | Medium — rewrite hooks; same JSX structure                         |
| Performance    | UI-thread worklets; immune to JS-thread load                       |
| Consistency    | Single animation system across Discover screen                     |
| Ceiling        | Full — spring physics, interpolation, `runOnJS` for side effects   |
| Risk           | Low — already used in SwipeCard without issues on SDK 54           |

**Key wins with v3:**
- `withSpring({ stiffness: 300, damping: 16 })` snaps hearts out in ~180 ms vs ~520 ms
  with the old JS spring
- `withRepeat(withSequence(...), -1)` for the glow loop runs entirely on the UI thread
- `runOnJS(dismiss)()` in the slide-out completion callback is the correct pattern for
  triggering navigation after an animation without `InteractionManager`
- `cancelAnimation(sv)` cleanly stops loops on unmount (replaces `.stop()` on the old ref)

---

### Option C — Skottie / Lottie for the burst (rejected)

| Dimension      | Assessment                                                         |
|----------------|--------------------------------------------------------------------|
| Asset pipeline | Requires designer to export `.json` for every variation           |
| Bundle size    | +~200 KB for the player                                            |
| Flexibility    | Cannot react to runtime data (match photo, profile name)           |

**Rejected**: Overkill for a single modal. The emoji-particle approach is already more
personalised than a static Lottie, and worklets give equivalent smoothness.

---

## Architecture — DatingMatchModal v2

```
useSharedValue × 10  (backdrop, sceneX, heartProg, leftX, rightX,
                       titleScale, glowVal, buttonsOp, buttonsY,
                       burst1, burst2)
        │
        ├─ useAnimatedStyle × 7   ← runs on UI thread (worklet)
        │   ├─ backdropStyle
        │   ├─ sceneStyle (slide-out dismiss)
        │   ├─ leftStyle / rightStyle (avatar fly-in)
        │   ├─ titleStyle (elastic pop)
        │   ├─ buttonsStyle (glide-up)
        │   └─ glowStyle (opacity + scale pulse)
        │
        ├─ HeartParticle × 42     ← each reads heartProg, computes
        │   useAnimatedStyle       translateX/Y, opacity, scale
        │                          ALL on UI thread
        │
        └─ StarburstRing × 2      ← ring scale 0.12 → 3.4, opacity 1 → 0
            useAnimatedStyle       runs on UI thread
```

**Animation sequence (wall-clock offsets):**

| t (ms) | What                         | Driver                          |
|--------|------------------------------|---------------------------------|
| 0      | Backdrop fade in (100 ms)    | withTiming                      |
| 0      | Burst ring 1 (620 ms)        | withTiming                      |
| 110    | Burst ring 2 (830 ms)        | withDelay + withTiming          |
| 40     | 42 hearts snap out           | withDelay + withSpring 300/16   |
| 60     | Avatars glide in             | withDelay + withSpring 260/22   |
| 120    | "It's a Match!" elastic pop  | withDelay + withSpring 320/12   |
| 380    | Buttons glide up             | withDelay + withSpring 200/22   |
| ∞      | Glow pulse 1100 ms cycle     | withRepeat(withSequence(...))   |

---

## Consequences

**Easier going forward:**
- New animated components default to Reanimated v3 — no more per-component API choice
- `worklet` tag enables Reanimated's babel plugin to hoist pure math off JS thread
- `cancelAnimation` is synchronous and safe to call in cleanup effects

**Harder / watch out for:**
- `useSharedValue` hooks must be called unconditionally (before any early `return null`)
- Callbacks inside `withTiming/withSpring` run on UI thread; use `runOnJS` to call
  navigation or state setters from them
- `shadowOpacity` animated via Reanimated still requires a workaround on Android
  (use `elevation` for Android shadows, reserve `shadowOpacity` for iOS)
- If a new developer adds a `useNativeDriver: true` Animated call next to Reanimated
  shared values, React Native will warn — enforce lint rule `no-legacy-animated-api`

---

## Action Items

- [x] Migrate `DatingMatchModal` to Reanimated v3 (this ADR)
- [x] `SwipeCard` — already on Reanimated v3
- [x] Migrate `ProfileBoostBanner` glow loop from `Animated.loop` to `withRepeat`
- [ ] Add ESLint rule to ban `new Animated.Value` in `components/` going forward
- [ ] QA on Pixel 6 (Android 13) and iPhone 14 (iOS 17) before App Store submission
