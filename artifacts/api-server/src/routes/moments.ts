/**
 * Moments API routes
 *
 * In-memory store — no DB schema needed for launch.
 * Replace `momentStore` / `requestStore` / `likeStore` with DB calls when ready.
 *
 * Routes:
 *   GET    /moments/feed             — paginated feed sorted by heat score
 *   POST   /moments                  — create a moment
 *   POST   /moments/:id/view         — record a view (increments watcher count)
 *   POST   /moments/:id/like         — like a moment
 *   DELETE /moments/:id/like         — unlike
 *   POST   /moments/:id/reply        — reply (creates a Moment Request)
 *   GET    /moments/requests         — get requests on your moments
 *   PUT    /moments/requests/:rid/accept  — accept → opens conversation
 *   DELETE /moments/requests/:rid    — decline (silent)
 *   GET    /moments/likes            — get who liked your moments
 */

import { Router } from "express";
import { getAuth } from "@clerk/express";
import { randomUUID } from "crypto";
import { rateLimit } from "../middlewares/rateLimit";

const router = Router();

// ── Types ────────────────────────────────────────────────────────────────────

interface Moment {
  id: string;
  userId: string;
  userDisplayName: string;
  userPhotoUrl?: string;
  text: string;
  location?: string;
  mediaUrl?: string;
  mediaType?: "photo" | "video";
  expiresAt: number; // unix ms
  createdAt: number;
  viewerIds: string[];    // deduplicated live viewers
  totalViews: number;
  echoCount: number;
  echoOfMomentId?: string; // if this is an Echo
}

interface MomentRequest {
  id: string;
  momentId: string;
  momentText: string;
  momentLocation?: string;
  fromUserId: string;
  fromDisplayName: string;
  fromPhotoUrl?: string;
  toUserId: string;
  message: string;
  createdAt: number;
  status: "pending" | "accepted" | "declined";
}

interface MomentLike {
  id: string;
  momentId: string;
  momentText: string;
  fromUserId: string;
  fromDisplayName: string;
  fromPhotoUrl?: string;
  toUserId: string;
  createdAt: number;
}

// ── In-memory store ───────────────────────────────────────────────────────────

const momentStore = new Map<string, Moment>();
const requestStore = new Map<string, MomentRequest>();
const likeStore = new Map<string, MomentLike>();

/** Composite like key so one user = one like per moment */
const likeKey = (userId: string, momentId: string) => `${userId}::${momentId}`;

/** Heat score — higher = more prominent in feed */
function heatScore(m: Moment): number {
  const hoursOld = Math.max(0.1, (Date.now() - m.createdAt) / 3_600_000);
  const reactionCount = m.totalViews > 0 ? m.echoCount / m.totalViews : 0;
  return (m.totalViews * (1 + reactionCount * 2)) / hoursOld;
}

/** Prune expired moments */
function pruneExpired() {
  const now = Date.now();
  for (const [id, m] of momentStore) {
    if (m.expiresAt < now) momentStore.delete(id);
  }
}

// ── Seed with realistic Miami demo data (dev only) ───────────────────────────
function seedDemoMoments() {
  if (momentStore.size > 0) return;
  const now = Date.now();
  const hr = 3_600_000;

  const demos: Omit<Moment, "id">[] = [
    {
      userId: "demo-kayla",
      userDisplayName: "Kayla",
      text: "Sunday reset hits different at Crandon 🧘‍♀️",
      location: "Crandon Park · Key Biscayne",
      expiresAt: now + 1.4 * hr,
      createdAt: now - 22 * 60_000,
      viewerIds: ["u1","u2","u3","u4","u5","u6","u7","u8","u9","u10","u11","u12","u13","u14"],
      totalViews: 14,
      echoCount: 3,
    },
    {
      userId: "demo-maya",
      userDisplayName: "Maya",
      text: "new ramen spot in wynwood actually slaps. someone come try it with me 👀",
      location: "Wynwood · Miami",
      expiresAt: now + 5.2 * hr,
      createdAt: now - 38 * 60_000,
      viewerIds: ["u1","u2","u3","u4","u5","u6"],
      totalViews: 6,
      echoCount: 0,
    },
    {
      userId: "demo-jess",
      userDisplayName: "Jess",
      text: "5am club. chaotic but we love it 😭",
      location: "Equinox Brickell",
      expiresAt: now + 20.5 * hr,
      createdAt: now - 3.5 * hr,
      viewerIds: ["u1","u2"],
      totalViews: 22,
      echoCount: 1,
    },
    {
      userId: "demo-alicia",
      userDisplayName: "Alicia",
      text: "Coffee and ocean views. This is the life ☕",
      location: "South Beach · Miami Beach",
      expiresAt: now + 18.8 * hr,
      createdAt: now - 5.2 * hr,
      viewerIds: [],
      totalViews: 8,
      echoCount: 0,
    },
  ];

  for (const d of demos) {
    const id = randomUUID();
    momentStore.set(id, { id, ...d });
  }
}

if (process.env["NODE_ENV"] !== "production") {
  seedDemoMoments();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toPublicMoment(m: Moment, requesterId: string) {
  const liveWatchers = m.viewerIds.length;
  const expiresIn = m.expiresAt - Date.now();
  const totalDuration = m.expiresAt - m.createdAt;
  const percentRemaining = Math.max(0, Math.min(1, expiresIn / totalDuration));
  const hoursRemaining = Math.floor(expiresIn / 3_600_000);
  const minsRemaining = Math.floor((expiresIn % 3_600_000) / 60_000);

  return {
    id: m.id,
    userId: m.userId,
    userDisplayName: m.userDisplayName,
    userPhotoUrl: m.userPhotoUrl,
    text: m.text,
    location: m.location,
    mediaUrl: m.mediaUrl,
    mediaType: m.mediaType,
    echoCount: m.echoCount,
    echoOfMomentId: m.echoOfMomentId,
    liveWatchers,
    totalViews: m.totalViews,
    percentRemaining,
    timeLabel: expiresIn <= 0
      ? "Expired"
      : hoursRemaining > 0
        ? `${hoursRemaining}h ${minsRemaining}m left`
        : `${minsRemaining}m left`,
    isTrending: heatScore(m) > 4,
    isOwn: m.userId === requesterId,
    createdAt: m.createdAt,
  };
}

// ── Routes ────────────────────────────────────────────────────────────────────

/** GET /moments/feed */
router.get("/moments/feed", (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  pruneExpired();

  const page = Math.max(1, Number(req.query["page"] ?? 1));
  const limit = Math.min(20, Number(req.query["limit"] ?? 10));
  const filter = req.query["filter"] as string | undefined; // "all" | "nearby" | "matches" | "new"

  let moments = [...momentStore.values()];

  if (filter === "new") {
    moments = moments.filter(m => !m.viewerIds.includes(userId));
  }

  moments.sort((a, b) => heatScore(b) - heatScore(a));

  const start = (page - 1) * limit;
  const paginated = moments.slice(start, start + limit);

  return res.json({
    moments: paginated.map(m => toPublicMoment(m, userId)),
    total: moments.length,
    page,
    hasMore: start + limit < moments.length,
  });
});

/** GET /moments/requests — Moment Requests on your moments */
router.get("/moments/requests", (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const requests = [...requestStore.values()]
    .filter(r => r.toUserId === userId && r.status === "pending")
    .sort((a, b) => b.createdAt - a.createdAt);

  return res.json({ requests });
});

/** GET /moments/likes — Who liked your moments */
router.get("/moments/likes", (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const likes = [...likeStore.values()]
    .filter(l => l.toUserId === userId)
    .sort((a, b) => b.createdAt - a.createdAt);

  return res.json({ likes });
});

/** POST /moments — create */
router.post(
  "/moments",
  rateLimit({ key: "moments_create", windowMs: 60_000, max: 5 }),
  (req, res) => {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { text, location, mediaUrl, mediaType, echoOfMomentId, userDisplayName, userPhotoUrl } =
      req.body as {
        text: string;
        location?: string;
        mediaUrl?: string;
        mediaType?: "photo" | "video";
        echoOfMomentId?: string;
        userDisplayName: string;
        userPhotoUrl?: string;
      };

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: "text is required" });
    }
    if (text.length > 280) {
      return res.status(400).json({ error: "text must be ≤ 280 characters" });
    }

    // Increment echo count on original if this is an echo
    if (echoOfMomentId) {
      const original = momentStore.get(echoOfMomentId);
      if (original) {
        original.echoCount += 1;
        momentStore.set(echoOfMomentId, original);
      }
    }

    const now = Date.now();
    const moment: Moment = {
      id: randomUUID(),
      userId,
      userDisplayName,
      userPhotoUrl,
      text: text.trim(),
      location,
      mediaUrl,
      mediaType,
      echoOfMomentId,
      expiresAt: now + 24 * 3_600_000,
      createdAt: now,
      viewerIds: [],
      totalViews: 0,
      echoCount: 0,
    };

    momentStore.set(moment.id, moment);
    return res.status(201).json({ moment: toPublicMoment(moment, userId) });
  }
);

/** POST /moments/:id/view */
router.post("/moments/:id/view", (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const moment = momentStore.get(req.params["id"]!);
  if (!moment || moment.expiresAt < Date.now()) {
    return res.status(404).json({ error: "Moment not found or expired" });
  }

  moment.totalViews += 1;
  if (!moment.viewerIds.includes(userId)) {
    moment.viewerIds.push(userId);
  }
  momentStore.set(moment.id, moment);

  return res.json({ liveWatchers: moment.viewerIds.length, totalViews: moment.totalViews });
});

/** POST /moments/:id/like */
router.post(
  "/moments/:id/like",
  rateLimit({ key: "moments_like", windowMs: 60_000, max: 30 }),
  (req, res) => {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const momentId = String(req.params["id"]);
    const moment = momentStore.get(momentId);
    if (!moment || moment.expiresAt < Date.now()) {
      return res.status(404).json({ error: "Moment not found or expired" });
    }

    const key = likeKey(userId, moment.id);
    if (likeStore.has(key)) {
      return res.status(409).json({ error: "Already liked" });
    }

    const { userDisplayName, userPhotoUrl } = req.body as {
      userDisplayName: string;
      userPhotoUrl?: string;
    };

    const like: MomentLike = {
      id: randomUUID(),
      momentId: moment.id,
      momentText: moment.text,
      fromUserId: userId,
      fromDisplayName: userDisplayName,
      fromPhotoUrl: userPhotoUrl,
      toUserId: moment.userId,
      createdAt: Date.now(),
    };

    likeStore.set(key, like);
    return res.status(201).json({ liked: true });
  }
);

/** DELETE /moments/:id/like */
router.delete("/moments/:id/like", (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const key = likeKey(userId, req.params["id"]!);
  likeStore.delete(key);
  return res.json({ liked: false });
});

/** POST /moments/:id/reply — creates a Moment Request */
router.post(
  "/moments/:id/reply",
  rateLimit({ key: "moments_reply", windowMs: 60_000, max: 10 }),
  (req, res) => {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const momentId = String(req.params["id"]);
    const moment = momentStore.get(momentId);
    if (!moment || moment.expiresAt < Date.now()) {
      return res.status(404).json({ error: "Moment not found or expired" });
    }

    if (moment.userId === userId) {
      return res.status(400).json({ error: "Cannot reply to your own Moment" });
    }

    const { message, userDisplayName, userPhotoUrl } = req.body as {
      message: string;
      userDisplayName: string;
      userPhotoUrl?: string;
    };

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: "message is required" });
    }

    // Check reply window — free users: 2h from post, premium: full 24h
    // (premium check via subscriptions service — simplified here)
    const msSincePost = Date.now() - moment.createdAt;
    const FREE_WINDOW_MS = 2 * 3_600_000;
    const isPremium = req.body["isPremium"] === true; // client sends entitlement
    if (!isPremium && msSincePost > FREE_WINDOW_MS) {
      return res.status(403).json({
        error: "Reply window closed",
        code: "REPLY_WINDOW_EXPIRED",
        upgradeRequired: true,
      });
    }

    const request: MomentRequest = {
      id: randomUUID(),
      momentId: moment.id,
      momentText: moment.text,
      momentLocation: moment.location,
      fromUserId: userId,
      fromDisplayName: userDisplayName,
      fromPhotoUrl: userPhotoUrl,
      toUserId: moment.userId,
      message: message.trim(),
      createdAt: Date.now(),
      status: "pending",
    };

    requestStore.set(request.id, request);
    return res.status(201).json({ request });
  }
);

/** PUT /moments/requests/:rid/accept */
router.put("/moments/requests/:rid/accept", (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const request = requestStore.get(req.params["rid"]!);
  if (!request) return res.status(404).json({ error: "Request not found" });
  if (request.toUserId !== userId) return res.status(403).json({ error: "Forbidden" });
  if (request.status !== "pending") return res.status(409).json({ error: "Already resolved" });

  request.status = "accepted";
  requestStore.set(request.id, request);

  // TODO: Create a conversation thread between toUserId and fromUserId
  // with the moment text as the opening context message.
  // For now return the fromUserId so the client can open/create the chat.
  return res.json({
    accepted: true,
    openChatWithUserId: request.fromUserId,
    momentContext: request.momentText,
  });
});

/** DELETE /moments/requests/:rid — decline silently */
router.delete("/moments/requests/:rid", (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const request = requestStore.get(req.params["rid"]!);
  if (!request) return res.status(404).json({ error: "Request not found" });
  if (request.toUserId !== userId) return res.status(403).json({ error: "Forbidden" });

  request.status = "declined";
  requestStore.set(request.id, request);
  return res.json({ declined: true });
});

export default router;
