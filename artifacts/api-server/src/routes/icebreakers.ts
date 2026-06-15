/**
 * GET /api/icebreakers?matchId=&userId=
 *
 * Returns 3 personalised conversation-starter suggestions based on
 * the two users' shared Vibe Check answers.  No external AI call —
 * purely deterministic template selection so it works instantly and
 * without extra cost.
 *
 * Front-end calls this once on first-open of a new chat and caches
 * the result in AsyncStorage so it never re-shows after first message.
 */
import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { db } from "@workspace/db";
import { matches, profiles } from "@workspace/db/schema";
import { eq, or, and } from "drizzle-orm";
import { z } from "zod";

const router = Router();

// ─── Vibe answer types (mirrors mobile types) ────────────────────────────────

type LoveLanguage = "words" | "touch" | "acts" | "gifts" | "time";
type EnergyType = "homebody" | "adventurer" | "balanced";
type ConflictStyle = "talk-it-out" | "need-space" | "quick-fix";
type DatePace = "slow-burn" | "medium" | "fast-sparks";
type AdventureLevel = 1 | 2 | 3 | 4 | 5;

type VibeAnswers = {
  loveLanguage: LoveLanguage;
  energyType: EnergyType;
  conflictStyle: ConflictStyle;
  datePace: DatePace;
  adventureLevel: AdventureLevel;
};

// ─── Template bank — keyed by shared traits ──────────────────────────────────

const TEMPLATES = {
  // Shared love language
  loveLanguage: {
    words: [
      "I saw you're into words of affirmation too — what's the nicest thing someone's ever said to you? 💬",
      "Fellow words person here — do you say it or text it first?",
    ],
    touch: [
      "Big hugger or handshake person on a first meet? 😄",
      "So we're both touch people — awkward first hug or go for it?",
    ],
    acts: [
      "Acts of service gang — what's the most thoughtful thing you've done for someone?",
      "I show I care by *doing* things. What's your go-to act of service?",
    ],
    gifts: [
      "Both gift givers! Best gift you've ever given or received?",
      "What's the most creative gift you've come up with? 🎁",
    ],
    time: [
      "Quality time is everything — ideal no-phone afternoon?",
      "If we had one free afternoon, what would you plan? 🌿",
    ],
  },

  // Shared energy
  energyType: {
    homebody: [
      "Fellow homebody! Best cosy movie + snack combo? 🛋️",
      "Netflix night or board games — what's your go-to chill plan?",
    ],
    adventurer: [
      "Always out energy detected ⚡ — wildest thing you've done recently?",
      "Best spontaneous plan you've ever said yes to?",
    ],
    balanced: [
      "Mood-dependent energy is honestly the correct answer. What tips you toward going out?",
      "What does a perfect Saturday look like for you? 🌤️",
    ],
  },

  // High adventure
  highAdventure: [
    "Your adventure level is basically calling me out — what's on your bucket list?",
    "5/5 adventurer? I need to hear the wildest story 🪂",
  ],

  // Shared pace
  datePace: {
    "slow-burn": [
      "Slow burns are the best — what's something you'd want to know before a first date?",
      "Taking our time ✓ — coffee or a walk first?",
    ],
    medium: [
      "Natural pace feels right — what do you usually know about someone before you meet?",
      "Favourite low-key first date idea?",
    ],
    "fast-sparks": [
      "Fast sparks person! What usually tells you right away if there's a connection?",
      "What's the most direct way you've shown interest in someone? ⚡",
    ],
  },

  // Fallback bank (always available)
  fallback: [
    "Our vibe match is real — what's one thing about you that surprised your last match?",
    "Best thing that happened to you this week? 👀",
    "If you could only keep 3 apps on your phone, which ones?",
    "Night owl or early bird? And be honest.",
    "What do you think we'd actually talk about if we met IRL?",
    "Pick one: beach sunset or mountain view?",
  ],
};

// ─── Generator ───────────────────────────────────────────────────────────────

function generateIcebreakers(
  myAnswers: VibeAnswers,
  theirAnswers: VibeAnswers,
  theirName: string,
): string[] {
  const suggestions: string[] = [];

  // 1. Shared love language opener
  if (myAnswers.loveLanguage === theirAnswers.loveLanguage) {
    const pool = TEMPLATES.loveLanguage[myAnswers.loveLanguage];
    suggestions.push(pool[Math.floor(Math.random() * pool.length)]);
  }

  // 2. Shared energy opener
  if (myAnswers.energyType === theirAnswers.energyType) {
    const pool = TEMPLATES.energyType[myAnswers.energyType];
    suggestions.push(pool[Math.floor(Math.random() * pool.length)]);
  }

  // 3. Shared pace opener
  if (myAnswers.datePace === theirAnswers.datePace) {
    const pool = TEMPLATES.datePace[myAnswers.datePace];
    suggestions.push(pool[Math.floor(Math.random() * pool.length)]);
  }

  // 4. High adventure
  if (myAnswers.adventureLevel >= 4 && theirAnswers.adventureLevel >= 4 && suggestions.length < 3) {
    suggestions.push(
      TEMPLATES.highAdventure[Math.floor(Math.random() * TEMPLATES.highAdventure.length)]
    );
  }

  // 5. Fill remaining with fallbacks (deduplicated)
  const shuffled = [...TEMPLATES.fallback].sort(() => Math.random() - 0.5);
  for (const fb of shuffled) {
    if (suggestions.length >= 3) break;
    if (!suggestions.includes(fb)) suggestions.push(fb);
  }

  return suggestions.slice(0, 3);
}

// ─── Route ───────────────────────────────────────────────────────────────────

const QuerySchema = z.object({
  matchId: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
});

router.get("/icebreakers", requireAuth, async (req, res) => {
  const parsed = QuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid query params" });
  }

  const callerId = req.auth?.userId;
  if (!callerId) return res.status(401).json({ error: "Unauthorized" });

  // Attempt to load vibe answers from both users via DB
  // Falls back to generic openers if no vibe data exists yet
  try {
    const { matchId, userId: otherUserId } = parsed.data;

    // Load both profiles to get vibeCheck answers
    let theirProfile: (typeof profiles.$inferSelect) | undefined;

    if (matchId) {
      const match = await db.query.matches
        ?.findFirst({ where: (m) => eq(m.id, matchId) })
        .catch(() => null);
      if (match) {
        const otherId =
          match.userId1 === callerId ? match.userId2 : match.userId1;
        theirProfile = await db.query.profiles
          ?.findFirst({ where: (p) => eq(p.userId, otherId) })
          .catch(() => undefined);
      }
    } else if (otherUserId) {
      theirProfile = await db.query.profiles
        ?.findFirst({ where: (p) => eq(p.userId, otherUserId) })
        .catch(() => undefined);
    }

    const myProfile = await db.query.profiles
      ?.findFirst({ where: (p) => eq(p.userId, callerId) })
      .catch(() => undefined);

    const myVibe = (myProfile as any)?.vibeCheck?.answers as VibeAnswers | undefined;
    const theirVibe = (theirProfile as any)?.vibeCheck?.answers as VibeAnswers | undefined;
    const theirName = (theirProfile as any)?.name ?? "them";

    if (myVibe && theirVibe) {
      const icebreakers = generateIcebreakers(myVibe, theirVibe, theirName);
      return res.json({ icebreakers, personalized: true });
    }
  } catch {
    // Fall through to generic
  }

  // Generic fallbacks when no vibe data available
  const shuffled = [...TEMPLATES.fallback].sort(() => Math.random() - 0.5);
  return res.json({ icebreakers: shuffled.slice(0, 3), personalized: false });
});

export default router;
