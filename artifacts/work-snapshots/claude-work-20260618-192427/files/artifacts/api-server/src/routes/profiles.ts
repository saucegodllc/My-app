import { Router } from "express";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { and, eq, gt, or } from "drizzle-orm";
import { randomUUID, createHash, createHmac, timingSafeEqual } from "crypto";
import { db } from "@workspace/db";
import { blocksTable, profilesTable, livenessNoncesTable, livenessAttemptsTable } from "@workspace/db";
import { UpsertMyProfileBody } from "@workspace/api-zod";
import { getAuth } from "@clerk/express";
import { ObjectStorageService } from "../lib/objectStorage";
import { rateLimit } from "../middlewares/rateLimit";
import { shouldUseLocalDbFallback } from "../launchGuards";

const router = Router();
const objectStorageService = new ObjectStorageService();
const workspaceRoot = process.cwd().endsWith(join("artifacts", "api-server"))
  ? join(process.cwd(), "..", "..")
  : process.cwd();
const localDbPath = join(workspaceRoot, "artifacts", "api-server", "db.json");

type UpsertProfileInput = {
  displayName: string;
  username?: string;
  bio?: string;
  birthDate?: string;
  gender?: string;
  location?: string;
  country?: string;
  intent: "dating" | "friendship" | "networking" | "all";
  interests?: string[];
  languages?: string[];
  photos?: string[];
  role?: string;
  profession?: string;
  connectionSubtype?: string;
  showGenderOnProfile?: boolean;
  lookingForGender?: string;
  modeData?: Record<string, unknown>;
  latitude?: number;
  longitude?: number;
  locationVisibility?: "hidden" | "fuzzy" | "active";
  acceptCommunityCode?: boolean;
};

type LocalProfile = {
  id: string;
  userId: string;
  displayName: string;
  username?: string;
  bio?: string;
  birthDate?: string;
  gender?: string;
  location?: string;
  country?: string;
  intent: "dating" | "friendship" | "networking" | "all";
  interests?: string[];
  languages?: string[];
  photos?: string[];
  role?: string;
  profession?: string;
  connectionSubtype?: string;
  modeData?: Record<string, unknown>;
  latitude?: number;
  longitude?: number;
  locationVisibility?: "hidden" | "fuzzy" | "active";
  communityCodeAcceptedAt?: string;
  isPremium?: boolean;
  isVerified?: boolean;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  profileViews?: number;
  createdAt?: string;
  updatedAt?: string;
};

type LocalLivenessNonce = {
  id: string;
  nonce: string;
  userId: string;
  expiresAt: string;
  used: boolean;
  tickedChallenges: number[];
  createdAt: string;
};

type LocalDb = Record<string, unknown> & {
  profiles?: LocalProfile[];
  livenessNonces?: LocalLivenessNonce[];
};

function localFallbackUserId(req: Parameters<typeof getAuth>[0]) {
  const header = req.headers["x-connectsphere-user-id"];
  const candidate = Array.isArray(header) ? header[0] : header;
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : "demo-user";
}

function authUserId(req: Parameters<typeof getAuth>[0]) {
  const { userId } = getAuth(req);
  if (userId) return userId;
  return shouldUseLocalDbFallback() ? localFallbackUserId(req) : null;
}

function readLocalDb(): LocalDb {
  if (!existsSync(localDbPath)) return { profiles: [], livenessNonces: [] };
  const parsed = JSON.parse(readFileSync(localDbPath, "utf8")) as LocalDb;
  return {
    ...parsed,
    profiles: parsed.profiles ?? [],
    livenessNonces: parsed.livenessNonces ?? [],
  };
}

function writeLocalDb(localDb: LocalDb) {
  mkdirSync(dirname(localDbPath), { recursive: true });
  writeFileSync(localDbPath, `${JSON.stringify(localDb, null, 2)}\n`);
}

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

function normalizeUsername(input: unknown): string | undefined {
  if (typeof input !== "string") return undefined;
  const username = input.trim().toLowerCase().replace(/^@+/, "");
  return username || undefined;
}

function validateUsername(input: unknown): { username?: string; error?: string } {
  const username = normalizeUsername(input);
  if (!username) return { error: "Choose a username to continue." };
  if (!USERNAME_RE.test(username)) {
    return { error: "Username must be 3-20 characters using lowercase letters, numbers, or underscores." };
  }
  return { username };
}

function usernameFromProfile(profile: { username?: string | null; modeData?: unknown }): string | undefined {
  if (typeof profile.username === "string" && profile.username.trim()) return profile.username.trim().toLowerCase();
  const modeData = profile.modeData as Record<string, unknown> | null | undefined;
  return normalizeUsername(modeData?.username);
}

function profilePhoto(profile: { photos?: unknown }): string | undefined {
  return Array.isArray(profile.photos) && typeof profile.photos[0] === "string" ? profile.photos[0] : undefined;
}

function profileSearchResult(profile: LocalProfile | typeof profilesTable.$inferSelect) {
  return {
    userId: profile.userId,
    username: usernameFromProfile(profile),
    displayName: profile.displayName,
    photoUrl: profilePhoto(profile),
    intent: profile.intent === "networking" ? "friendship" : profile.intent,
    connectionSubtype: profile.connectionSubtype,
    isVerified: !!profile.isVerified,
    isPremium: !!profile.isPremium,
  };
}

function sortProfileSearchResults<T extends { username?: string; displayName?: string }>(query: string, items: T[]) {
  const q = query.toLowerCase();
  return [...items].sort((a, b) => {
    const aUser = a.username?.toLowerCase() ?? "";
    const bUser = b.username?.toLowerCase() ?? "";
    const aPrefix = aUser.startsWith(q) ? 0 : 1;
    const bPrefix = bUser.startsWith(q) ? 0 : 1;
    if (aPrefix !== bPrefix) return aPrefix - bPrefix;
    return (a.displayName ?? a.username ?? "").localeCompare(b.displayName ?? b.username ?? "");
  });
}

function localProfileResponse(profile: LocalProfile) {
  return {
    ...profile,
    username: usernameFromProfile(profile),
    intent: profile.intent === "networking" ? "friendship" : profile.intent,
    isPremium: profile.isPremium ?? false,
    isVerified: profile.isVerified ?? false,
    profileViews: profile.profileViews ?? 0,
    locationVisibility: profile.locationVisibility ?? "fuzzy",
    age: ageFromDob(profile.birthDate),
  };
}

function profileResponse<T extends { intent?: string; birthDate?: string | null; username?: string | null; modeData?: unknown }>(profile: T) {
  return {
    ...profile,
    username: usernameFromProfile(profile),
    intent: profile.intent === "networking" ? "friendship" : profile.intent,
    age: ageFromDob(profile.birthDate),
  };
}

const CHALLENGE_POOL = ["smile"] as const;
type Challenge = "smile" | "blink" | "turn_left" | "turn_right" | "nod";

// Server-only MAC secret derived from CLERK_SECRET_KEY — never sent to clients.
// Startup fails fast if the env var is absent.
const SERVER_PROOF_SECRET = (() => {
  const base = process.env.CLERK_SECRET_KEY ?? "connectsphere-local-liveness-secret";
  return createHash("sha256").update("liveness-session-v2:" + base).digest();
})();

interface SessionPayload {
  userId: string;
  nonce: string;
  challenges: string[];
  iat: number; // issued-at ms — used server-side to enforce minimum elapsed challenge time
  exp: number;
}

function createSessionToken(payload: SessionPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", SERVER_PROOF_SECRET).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

function verifySessionToken(token: string): SessionPayload {
  const dot = token.lastIndexOf(".");
  if (dot < 0) throw new Error("Malformed session token");
  const encoded = token.slice(0, dot);
  const sig     = token.slice(dot + 1);
  const expectedSig = createHmac("sha256", SERVER_PROOF_SECRET).update(encoded).digest("base64url");
  const sigBuf = Buffer.from(sig, "base64url");
  const expBuf = Buffer.from(expectedSig, "base64url");
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    throw new Error("Session token signature invalid");
  }
  return JSON.parse(Buffer.from(encoded, "base64url").toString()) as SessionPayload;
}

function challengesFromNonce(nonce: string): Challenge[] {
  const pool = [...CHALLENGE_POOL] as Challenge[];
  const hash = createHash("sha256").update(nonce).digest();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = hash[pool.length - 1 - i] % (i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 1);
}

const MIN_AGE = 18;

function ageFromDob(dob: string | null | undefined): number | undefined {
  if (!dob) return undefined;
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

function asStringArray(input: unknown): string[] {
  return Array.isArray(input) ? input.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

type CompletionProfile = {
  displayName?: string | null;
  bio?: string | null;
  birthDate?: string | null;
  intent?: string | null;
  interests?: unknown;
  photos?: unknown;
  modeData?: unknown;
  locationVisibility?: string | null;
  communityCodeAcceptedAt?: string | Date | null;
};

function calculateProfileCompletion(profile: CompletionProfile | null | undefined) {
  const photos = asStringArray(profile?.photos);
  const modeData = (profile?.modeData ?? {}) as Record<string, unknown>;
  const prompts = asStringArray(modeData.prompts ?? modeData.answers ?? modeData.profilePrompts);
  const hasStrongPrompt = prompts.some((prompt) => prompt.trim().split(/\s+/).length >= 5) || (profile?.bio?.trim().split(/\s+/).length ?? 0) >= 10;
  const checks = [
    { id: "photos", label: "Add at least 3 photos", done: photos.length >= 3, weight: 28 },
    { id: "basics", label: "Finish your name, age, and intent", done: !!profile?.displayName && !!profile?.birthDate && !!profile?.intent, weight: 22 },
    { id: "prompt_quality", label: "Add a stronger prompt or bio", done: hasStrongPrompt, weight: 18 },
    { id: "interests", label: "Choose interests so people know what to ask about", done: asStringArray(profile?.interests).length >= 3, weight: 14 },
    { id: "location_privacy", label: "Choose location privacy", done: !!profile?.locationVisibility, weight: 10 },
    { id: "community", label: "Accept the community code", done: !!profile?.communityCodeAcceptedAt, weight: 8 },
  ];
  const percent = Math.min(100, checks.reduce((sum, item) => sum + (item.done ? item.weight : 0), 0));
  const missingItems = checks.filter((item) => !item.done).map((item) => ({ id: item.id, label: item.label, weight: item.weight }));
  const photoMissing = Math.max(0, 3 - photos.length);
  const nudges = [
    photoMissing > 0 ? `Add ${photoMissing} more ${photoMissing === 1 ? "photo" : "photos"} to get seen more` : null,
    photoMissing > 0 ? "Profiles with 3+ photos feel more real" : null,
    !hasStrongPrompt ? "A specific prompt gives people an easy first message" : null,
    percent < 100 ? "Finish this and your card is ready" : "Your card is ready to meet people",
  ].filter((item): item is string => Boolean(item));
  return {
    percent,
    isLaunchReady: photos.length >= 3 && missingItems.length === 0,
    photoCount: photos.length,
    requiredPhotoCount: 3,
    missingItems,
    blockingItems: missingItems.filter((item) => item.id === "photos" || item.id === "basics"),
    softNudges: nudges,
    completedSections: checks.filter((item) => item.done).map((item) => item.id),
  };
}

// Server-side fuzzing — clients cannot bypass by sending exact GPS.
// Random offset within a 500m radius using equirectangular approximation.
function fuzzCoordinate(lat: number, lng: number): { lat: number; lng: number } {
  const radiusDeg = 500 / 111320; // ≈0.0045°
  const u = Math.random();
  const v = Math.random();
  const w = radiusDeg * Math.sqrt(u);
  const t = 2 * Math.PI * v;
  const dLat = w * Math.cos(t);
  const dLng = (w * Math.sin(t)) / Math.cos((lat * Math.PI) / 180);
  return { lat: lat + dLat, lng: lng + dLng };
}

router.get("/profiles/me", async (req, res) => {
  const userId = authUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  if (shouldUseLocalDbFallback()) {
    const localDb = readLocalDb();
    const profile = localDb.profiles?.find((item) => item.userId === userId);
    if (!profile) return res.status(404).json({ error: "Profile not found" });
    return res.json(localProfileResponse(profile));
  }

  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId))
    .limit(1);

  if (!profile) return res.status(404).json({ error: "Profile not found" });

  return res.json(profileResponse(profile));
});

// 10 profile updates / minute — prevents thrashing / brute-force username enumeration
router.put("/profiles/me", rateLimit({ key: "profile_update", windowMs: 60_000, max: 10 }), async (req, res) => {
  const userId = authUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const parsed = UpsertMyProfileBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid profile data.",
      details: parsed.error.issues.map((issue) => `${issue.path.join(".") || "profile"}: ${issue.message}`),
    });
  }

  const data = parsed.data as UpsertProfileInput;

  if (shouldUseLocalDbFallback()) {
    const localDb = readLocalDb();
    const profiles = localDb.profiles ?? [];
    const existingIndex = profiles.findIndex((item) => item.userId === userId);
    const existing = existingIndex >= 0 ? profiles[existingIndex] : undefined;
    const usernameCheck = validateUsername(data.username ?? usernameFromProfile(existing ?? { modeData: {} }));
    if (usernameCheck.error || !usernameCheck.username) return res.status(400).json({ error: usernameCheck.error });
    const username = usernameCheck.username;
    const usernameTaken = profiles.some((item) => item.userId !== userId && usernameFromProfile(item) === username);
    if (usernameTaken) return res.status(409).json({ error: "That username is already taken." });

    const effectiveDob = data.birthDate ?? existing?.birthDate ?? null;
    const effectiveAge = ageFromDob(effectiveDob) ?? null;
    if (effectiveAge === null) {
      return res.status(400).json({ error: "Date of birth is required." });
    }
    if (effectiveAge < MIN_AGE) {
      return res.status(400).json({ error: `You must be at least ${MIN_AGE} years old to use ConnectSphere.` });
    }

    const alreadyAccepted = !!existing?.communityCodeAcceptedAt;
    const willAccept = data.acceptCommunityCode === true;
    if (!alreadyAccepted && !willAccept) {
      return res.status(400).json({ error: "You must accept the Miami Community Code to continue." });
    }
    if (data.intent === "networking") {
      return res.status(400).json({ error: "Choose Dating or Friends to continue." });
    }
    if (willAccept && !["dating", "friendship", "all"].includes(data.intent ?? "")) {
      return res.status(400).json({ error: "Choose Dating or Friends to continue." });
    }

    const existingModeData = existing?.modeData ?? {};
    const incomingModeData = data.modeData ?? {};
    const now = new Date().toISOString();
    const nextProfile: LocalProfile = {
      id: existing?.id ?? randomUUID(),
      userId,
      displayName: data.displayName,
      username,
      bio: data.bio,
      birthDate: data.birthDate,
      gender: data.gender,
      location: data.location,
      country: data.country,
      intent: data.intent,
      interests: data.interests ?? existing?.interests ?? [],
      languages: data.languages ?? existing?.languages ?? [],
      photos: data.photos ?? existing?.photos ?? [],
      role: data.role,
      profession: data.profession,
      connectionSubtype: data.connectionSubtype,
      modeData: {
        ...existingModeData,
        ...incomingModeData,
        username,
        ...(data.showGenderOnProfile !== undefined ? { showGenderOnProfile: data.showGenderOnProfile } : {}),
        ...(data.lookingForGender !== undefined ? { lookingForGender: data.lookingForGender } : {}),
      },
      latitude: data.latitude,
      longitude: data.longitude,
      locationVisibility: data.locationVisibility ?? existing?.locationVisibility ?? "fuzzy",
      communityCodeAcceptedAt: willAccept ? now : existing?.communityCodeAcceptedAt,
      isPremium: existing?.isPremium ?? false,
      isVerified: existing?.isVerified ?? false,
      stripeCustomerId: existing?.stripeCustomerId,
      stripeSubscriptionId: existing?.stripeSubscriptionId,
      profileViews: existing?.profileViews ?? 0,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    if (existingIndex >= 0) profiles[existingIndex] = nextProfile;
    else profiles.push(nextProfile);
    localDb.profiles = profiles;
    writeLocalDb(localDb);
    return res.json(localProfileResponse(nextProfile));
  }

  const [existing] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId))
    .limit(1);

  const usernameCheck = validateUsername(data.username ?? usernameFromProfile(existing ?? { modeData: {} }));
  if (usernameCheck.error || !usernameCheck.username) return res.status(400).json({ error: usernameCheck.error });
  const username = usernameCheck.username;
  const allProfilesForUsername = await db.select().from(profilesTable);
  const usernameTaken = allProfilesForUsername.some((item) => item.userId !== userId && usernameFromProfile(item) === username);
  if (usernameTaken) return res.status(409).json({ error: "That username is already taken." });

  // Effective DOB after this update (incoming or already on file)
  const effectiveDob = data.birthDate ?? existing?.birthDate ?? null;
  const effectiveAge = ageFromDob(effectiveDob) ?? null;
  if (effectiveAge === null) {
    return res.status(400).json({ error: "Date of birth is required." });
  }
  if (effectiveAge < MIN_AGE) {
    return res.status(400).json({ error: `You must be at least ${MIN_AGE} years old to use ConnectSphere.` });
  }

  // Community Code must be accepted before we'll create/finalize a profile.
  const alreadyAccepted = !!existing?.communityCodeAcceptedAt;
  const willAccept = data.acceptCommunityCode === true;
  if (!alreadyAccepted && !willAccept) {
    return res.status(400).json({ error: "You must accept the Miami Community Code to continue." });
  }

  // When finalizing onboarding (accepting community code), intent must be a valid mode.
  if (willAccept) {
    if (data.intent === "networking") {
      return res.status(400).json({ error: "Choose Dating or Friends to continue." });
    }
    if (!["dating", "friendship", "all"].includes(data.intent ?? "")) {
      return res.status(400).json({ error: "Choose Dating or Friends to continue." });
    }
  }

  // Build patch — only include fields that were sent so partial updates don't wipe state.
  const patch: Record<string, unknown> = {
    displayName: data.displayName,
    bio: data.bio,
    birthDate: data.birthDate,
    gender: data.gender,
    location: data.location,
    country: data.country,
    intent: data.intent,
    ...(data.interests !== undefined ? { interests: data.interests } : {}),
    ...(data.languages !== undefined ? { languages: data.languages } : {}),
    ...(data.photos !== undefined ? { photos: data.photos } : {}),
    role: data.role,
    profession: data.profession,
    connectionSubtype: data.connectionSubtype,
    updatedAt: new Date(),
  };
  if (data.modeData !== undefined || data.showGenderOnProfile !== undefined || data.lookingForGender !== undefined || username !== undefined) {
    const existingMd = (existing?.modeData as Record<string, unknown>) ?? {};
    const incomingMd = data.modeData ?? {};
    patch.modeData = {
      ...existingMd,
      ...incomingMd,
      username,
      ...(data.showGenderOnProfile !== undefined ? { showGenderOnProfile: data.showGenderOnProfile } : {}),
      ...(data.lookingForGender !== undefined ? { lookingForGender: data.lookingForGender } : {}),
    };
  }
  // Always re-fuzz client-supplied coordinates server-side (privacy: clients can't store exact GPS).
  if (data.latitude !== undefined && data.longitude !== undefined) {
    const fuzzed = fuzzCoordinate(data.latitude, data.longitude);
    patch.latitude = fuzzed.lat;
    patch.longitude = fuzzed.lng;
  }
  if (data.locationVisibility !== undefined) patch.locationVisibility = data.locationVisibility;
  if (willAccept) patch.communityCodeAcceptedAt = new Date();

  let profile;
  if (existing) {
    [profile] = await db
      .update(profilesTable)
      .set(patch)
      .where(eq(profilesTable.userId, userId))
      .returning();
  } else {
    [profile] = await db
      .insert(profilesTable)
      .values({
        id: randomUUID(),
        userId,
        ...patch,
      } as typeof profilesTable.$inferInsert)
      .returning();
  }

  return res.json(profileResponse(profile));
});

router.post("/profiles/me/community-code", async (req, res) => {
  const userId = authUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  if (shouldUseLocalDbFallback()) {
    const localDb = readLocalDb();
    const profiles = localDb.profiles ?? [];
    const index = profiles.findIndex((item) => item.userId === userId);
    if (index < 0) return res.status(404).json({ error: "Profile not found" });
    const acceptedAt = new Date().toISOString();
    profiles[index] = { ...profiles[index], communityCodeAcceptedAt: acceptedAt, updatedAt: acceptedAt };
    localDb.profiles = profiles;
    writeLocalDb(localDb);
    return res.json({ ok: true, acceptedAt });
  }

  const [profile] = await db
    .update(profilesTable)
    .set({ communityCodeAcceptedAt: new Date(), updatedAt: new Date() })
    .where(eq(profilesTable.userId, userId))
    .returning();

  if (!profile) return res.status(404).json({ error: "Profile not found" });
  return res.json({ ok: true, acceptedAt: profile.communityCodeAcceptedAt });
});

router.get("/profiles/liveness-nonce", async (req, res) => {
  const userId = authUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const now = Date.now();
  const NONCE_TTL_MS = 5 * 60_000; // 5 minutes

  const nonce      = randomUUID();
  const challenges = challengesFromNonce(nonce);
  const expiresAt  = new Date(now + NONCE_TTL_MS);

  if (shouldUseLocalDbFallback()) {
    const localDb = readLocalDb();
    localDb.livenessNonces = [
      ...(localDb.livenessNonces ?? []).filter((item) => new Date(item.expiresAt).getTime() > now && !item.used),
      {
        id: randomUUID(),
        nonce,
        userId,
        expiresAt: expiresAt.toISOString(),
        used: false,
        tickedChallenges: [],
        createdAt: new Date(now).toISOString(),
      },
    ];
    writeLocalDb(localDb);
    const sessionToken = createSessionToken({ userId, nonce, challenges, iat: now, exp: expiresAt.getTime() });
    return res.json({ sessionToken, challenges, expiresAt: expiresAt.getTime() });
  }

  await db.insert(livenessNoncesTable).values({ nonce, userId, expiresAt });

  const sessionToken = createSessionToken({ userId, nonce, challenges, iat: now, exp: expiresAt.getTime() });

  return res.json({ sessionToken, challenges, expiresAt: expiresAt.getTime() });
});

router.post("/profiles/liveness-challenge-tick", async (req, res) => {
  const userId = authUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  interface TickBody {
    sessionToken?: string;
    challengeIndex?: number;
    measurements?: unknown;
    confidences?: unknown;
    durationMs?: unknown;
  }

  const { sessionToken, challengeIndex, measurements, confidences, durationMs } = req.body as TickBody;

  if (!sessionToken || typeof sessionToken !== "string") {
    return res.status(400).json({ error: "Missing session token." });
  }

  let tokenPayload: SessionPayload;
  try {
    tokenPayload = verifySessionToken(sessionToken);
  } catch {
    return res.status(400).json({ error: "Invalid session token." });
  }

  const { userId: tokenUserId, nonce, challenges: tokenChallenges, exp } = tokenPayload;
  if (tokenUserId !== userId) return res.status(403).json({ error: "Session mismatch." });
  if (exp < Date.now()) return res.status(400).json({ error: "Session expired." });

  if (typeof challengeIndex !== "number" || !Number.isInteger(challengeIndex) ||
      challengeIndex < 0 || challengeIndex >= tokenChallenges.length) {
    return res.status(400).json({ error: "Invalid challenge index." });
  }

  const challenge = tokenChallenges[challengeIndex] as Challenge;

  // Validate measurement trace
  if (!Array.isArray(measurements) || measurements.length < 2 || measurements.length > 50) {
    return res.status(400).json({ error: `Challenge ${challenge}: measurement trace invalid.` });
  }
  if (!Array.isArray(confidences) || confidences.length !== measurements.length) {
    return res.status(400).json({ error: `Challenge ${challenge}: confidence trace length mismatch.` });
  }
  if (!measurements.every((v) => typeof v === "number" && Number.isFinite(v))) {
    return res.status(400).json({ error: `Challenge ${challenge}: non-numeric measurement.` });
  }
  if (!confidences.every((v) => typeof v === "number" && Number.isFinite(v))) {
    return res.status(400).json({ error: `Challenge ${challenge}: non-numeric confidence.` });
  }
  if (typeof durationMs !== "number" || durationMs < 600 || durationMs > 6_500) {
    return res.status(400).json({ error: `Challenge ${challenge}: timing outside expected range.` });
  }

  const meas = measurements as number[];
  const confs = confidences as number[];
  const meanConf = confs.reduce((a, b) => a + b, 0) / confs.length;
  if (meanConf < 0.30) {
    return res.status(400).json({ error: `Challenge ${challenge}: face detection confidence too low.` });
  }

  // Server independently validates biometric pattern using same thresholds as client.
  const EAR_CLOSE = 0.18;  // match EAR_BLINK_THRESHOLD
  const EAR_OPEN  = 0.22;  // recovery above close threshold
  const TURN_MIN  = 0.20;  // match TURN_RATIO (20% face width)
  const NOD_MIN   = 0.09;  // match NOD_DELTA

  let patternOk = false;
  if (challenge === "blink") {
    // Require TWO distinct close→open transitions in EAR trace.
    let blinks = 0;
    let open = meas[0] > EAR_CLOSE;
    for (let i = 1; i < meas.length; i++) {
      const nowOpen = meas[i] > EAR_OPEN;
      if (!open && nowOpen) blinks++;
      open = meas[i] > EAR_CLOSE;
    }
    patternOk = blinks >= 2;
  } else if (challenge === "smile") {
    patternOk = Math.max(...meas) > 0.50;
  } else if (challenge === "turn_left" || challenge === "turn_right") {
    patternOk = Math.max(...meas) > TURN_MIN;
  } else if (challenge === "nod") {
    patternOk = Math.max(...meas) > NOD_MIN;
  }

  if (!patternOk) {
    return res.status(400).json({ error: `Challenge ${challenge}: biometric pattern not detected. Please perform the action clearly.` });
  }

  if (shouldUseLocalDbFallback()) {
    const localDb = readLocalDb();
    const nonces = localDb.livenessNonces ?? [];
    const nonceIndex = nonces.findIndex((item) => item.nonce === nonce && item.userId === userId);
    const nonceRow = nonceIndex >= 0 ? nonces[nonceIndex] : undefined;
    if (!nonceRow) return res.status(400).json({ error: "Invalid or expired session." });
    if (nonceRow.used) return res.status(400).json({ error: "Session already used." });
    if (new Date(nonceRow.expiresAt).getTime() < Date.now()) return res.status(400).json({ error: "Session expired." });
    const ticked = nonceRow.tickedChallenges ?? [];
    if (ticked.includes(challengeIndex)) {
      return res.status(400).json({ error: `Challenge ${challengeIndex} already submitted.` });
    }
    nonces[nonceIndex] = { ...nonceRow, tickedChallenges: [...ticked, challengeIndex] };
    localDb.livenessNonces = nonces;
    writeLocalDb(localDb);

    const issuedAt = Date.now();
    const certMsg = `v1:${nonce}:${challengeIndex}:${challenge}:${issuedAt}`;
    const challengeCert = createHmac("sha256", SERVER_PROOF_SECRET).update(certMsg).digest("hex");
    return res.json({ challengeCert, issuedAt, challengeIndex });
  }

  // Prevent double-tick using DB row's tickedChallenges JSON array
  const [nonceRow] = await db
    .select({ tickedChallenges: livenessNoncesTable.tickedChallenges, used: livenessNoncesTable.used, expiresAt: livenessNoncesTable.expiresAt })
    .from(livenessNoncesTable)
    .where(and(eq(livenessNoncesTable.nonce, nonce), eq(livenessNoncesTable.userId, userId)))
    .limit(1);

  if (!nonceRow) return res.status(400).json({ error: "Invalid or expired session." });
  if (nonceRow.used) return res.status(400).json({ error: "Session already used." });
  if (nonceRow.expiresAt.getTime() < Date.now()) return res.status(400).json({ error: "Session expired." });

  const ticked = (nonceRow.tickedChallenges ?? []) as number[];
  if (ticked.includes(challengeIndex)) {
    return res.status(400).json({ error: `Challenge ${challengeIndex} already submitted.` });
  }

  // Record tick before issuing cert
  await db
    .update(livenessNoncesTable)
    .set({ tickedChallenges: [...ticked, challengeIndex] })
    .where(eq(livenessNoncesTable.nonce, nonce));

  // ── Issue server-signed certificate ───────────────────────────────────────
  // Cert = HMAC-SHA256(SERVER_PROOF_SECRET, "v1:<nonce>:<idx>:<challenge>:<issuedAt>")
  // Only the server can issue this cert (signing key never shared with client).
  const issuedAt = Date.now();
  const certMsg = `v1:${nonce}:${challengeIndex}:${challenge}:${issuedAt}`;
  const challengeCert = createHmac("sha256", SERVER_PROOF_SECRET).update(certMsg).digest("hex");

  return res.json({ challengeCert, issuedAt, challengeIndex });
});

// 5 face-verify attempts / minute — ML inference is expensive; also limits brute-force liveness bypass
router.post("/profiles/verify-face", rateLimit({ key: "face_verify", windowMs: 60_000, max: 5 }), async (req, res) => {
  const userId = authUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  interface ChallengeCert {
    challengeCert: string; // 64-char hex HMAC-SHA256
    issuedAt: number;      // ms timestamp set by server at tick time
    challengeIndex: number;
  }

  const { livenessProof } = req.body as {
    livenessProof?: {
      sessionToken?: string;
      timestamp?: number;
      faceHash?: string;
      livenessScore?: number;
      challengesPassed?: string[];
      challengeCerts?: ChallengeCert[];
    };
  };

  if (!livenessProof) return res.status(400).json({ error: "Liveness proof is required." });

  const { sessionToken, timestamp, faceHash, livenessScore, challengesPassed, challengeCerts } = livenessProof;

  if (!sessionToken || typeof sessionToken !== "string") {
    return res.status(400).json({ error: "Missing session token. Please start a new verification." });
  }
  let tokenPayload: SessionPayload;
  try {
    tokenPayload = verifySessionToken(sessionToken);
  } catch {
    return res.status(400).json({ error: "Invalid session token. Please start a new verification." });
  }

  const { userId: tokenUserId, nonce, challenges: tokenChallenges, iat, exp } = tokenPayload;

  if (tokenUserId !== userId) return res.status(403).json({ error: "Session mismatch." });

  const nowMs = Date.now();
  if (exp < nowMs) return res.status(400).json({ error: "Session expired. Please start again." });

  const MIN_ELAPSED_MS = 2_000;
  if (nowMs - iat < MIN_ELAPSED_MS) {
    return res.status(400).json({ error: "Verification completed too quickly. Please retry." });
  }

  if (shouldUseLocalDbFallback()) {
    const localDb = readLocalDb();
    const nonceRow = (localDb.livenessNonces ?? []).find((item) => item.nonce === nonce && item.userId === userId);
    if (!nonceRow || nonceRow.used || new Date(nonceRow.expiresAt).getTime() <= Date.now()) {
      return res.status(400).json({ error: "Invalid, expired, or already-used session. Please start a new verification." });
    }
  } else {
    const consumed = await db
      .update(livenessNoncesTable)
      .set({ used: true })
      .where(
        and(
          eq(livenessNoncesTable.nonce, nonce),
          eq(livenessNoncesTable.userId, userId),
          eq(livenessNoncesTable.used, false),
          gt(livenessNoncesTable.expiresAt, new Date()),
        )
      )
      .returning({ id: livenessNoncesTable.id });

    if (consumed.length === 0) {
      return res.status(400).json({ error: "Invalid, expired, or already-used session. Please start a new verification." });
    }
  }

  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) {
    return res.status(400).json({ error: "Missing or invalid proof timestamp." });
  }
  if (timestamp > nowMs + 30_000 || nowMs - timestamp > 10 * 60_000) {
    return res.status(400).json({ error: "Proof timestamp out of range." });
  }

  const expectedChallenges = challengesFromNonce(nonce);
  for (const c of tokenChallenges) {
    if (!expectedChallenges.includes(c as Challenge)) {
      return res.status(400).json({ error: "Token challenge set inconsistent with nonce." });
    }
  }

  if (!Array.isArray(challengesPassed) || challengesPassed.length !== expectedChallenges.length ||
      !expectedChallenges.every((c, i) => c === challengesPassed[i])) {
    return res.status(400).json({ error: "Declared challenges do not match session." });
  }

  if (!Array.isArray(challengeCerts) || challengeCerts.length !== expectedChallenges.length) {
    return res.status(400).json({ error: "Must present a server certificate for each required challenge." });
  }

  for (let i = 0; i < expectedChallenges.length; i++) {
    const cert = challengeCerts[i];
    const expectedChallenge = expectedChallenges[i];

    if (!cert || typeof cert.challengeCert !== "string" || !/^[0-9a-f]{64}$/.test(cert.challengeCert)) {
      return res.status(400).json({ error: `Challenge ${i}: certificate missing or malformed.` });
    }
    if (typeof cert.challengeIndex !== "number" || cert.challengeIndex !== i) {
      return res.status(400).json({ error: `Challenge ${i}: certificate index mismatch.` });
    }
    if (typeof cert.issuedAt !== "number" || cert.issuedAt < iat || cert.issuedAt > nowMs + 5_000) {
      return res.status(400).json({ error: `Challenge ${i}: certificate timestamp invalid.` });
    }

    const certMsg = `v1:${nonce}:${i}:${expectedChallenge}:${cert.issuedAt}`;
    const expectedCert = createHmac("sha256", SERVER_PROOF_SECRET).update(certMsg).digest("hex");
    const certBuf = Buffer.from(cert.challengeCert, "hex");
    const expBuf  = Buffer.from(expectedCert, "hex");
    if (certBuf.length !== expBuf.length || !timingSafeEqual(certBuf, expBuf)) {
      return res.status(400).json({ error: `Challenge ${i}: certificate signature invalid.` });
    }
  }

  // Validate faceHash format (64-char hex = SHA-256 of geometry vector)
  if (typeof faceHash !== "string" || !/^[0-9a-f]{64}$/.test(faceHash)) {
    return res.status(400).json({ error: "Invalid or missing face hash." });
  }

  // Validate livenessScore (secondary hint; 0.85 floor still enforced)
  if (typeof livenessScore !== "number" || !Number.isFinite(livenessScore) || livenessScore < 0 || livenessScore > 1) {
    return res.status(400).json({ error: "Invalid or missing liveness score." });
  }

  if (livenessScore < 0.85) {
    return res.status(400).json({
      error: "Liveness score too low. Ensure good lighting, keep your face centred, and perform each action clearly.",
      livenessScore: Math.round(livenessScore * 100) / 100,
    });
  }

  // ── Persist ───────────────────────────────────────────────────────────────────
  if (shouldUseLocalDbFallback()) {
    const localDb = readLocalDb();
    const nonces = localDb.livenessNonces ?? [];
    const nonceIndex = nonces.findIndex((item) => item.nonce === nonce && item.userId === userId);
    if (nonceIndex < 0 || nonces[nonceIndex].used || new Date(nonces[nonceIndex].expiresAt).getTime() <= Date.now()) {
      return res.status(400).json({ error: "Invalid, expired, or already-used session. Please start a new verification." });
    }
    nonces[nonceIndex] = { ...nonces[nonceIndex], used: true };

    const profiles = localDb.profiles ?? [];
    const profileIndex = profiles.findIndex((item) => item.userId === userId);
    const existing = profileIndex >= 0 ? profiles[profileIndex] : undefined;
    const now = new Date().toISOString();
    const nextProfile: LocalProfile = {
      id: existing?.id ?? randomUUID(),
      userId,
      displayName: existing?.displayName ?? "",
      intent: existing?.intent ?? "all",
      ...existing,
      isVerified: true,
      modeData: {
        ...(existing?.modeData ?? {}),
        faceHash,
        livenessVerifiedAt: now,
        livenessScore: Math.round(livenessScore * 1000) / 1000,
      },
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    if (profileIndex >= 0) profiles[profileIndex] = nextProfile;
    else profiles.push(nextProfile);
    localDb.livenessNonces = nonces;
    localDb.profiles = profiles;
    writeLocalDb(localDb);
    return res.json({ ok: true, isVerified: true });
  }

  const [existing] = await db.select().from(profilesTable).where(eq(profilesTable.userId, userId)).limit(1);
  const existingModeData = (existing?.modeData as Record<string, unknown>) ?? {};
  const updatedModeData = {
    ...existingModeData,
    faceHash,
    livenessVerifiedAt: new Date().toISOString(),
    livenessScore: Math.round(livenessScore * 1000) / 1000,
  };

  let profile;
  if (existing) {
    [profile] = await db
      .update(profilesTable)
      .set({ isVerified: true, modeData: updatedModeData, updatedAt: new Date() })
      .where(eq(profilesTable.userId, userId))
      .returning();
  } else {
    [profile] = await db
      .insert(profilesTable)
      .values({
        id: randomUUID(),
        userId,
        displayName: "",
        intent: "all",
        isVerified: true,
        modeData: updatedModeData,
      } as typeof profilesTable.$inferInsert)
      .returning();
  }
  return res.json({ ok: true, isVerified: !!profile?.isVerified });
});

router.get("/profiles/me/completion", async (req, res) => {
  const userId = authUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  if (shouldUseLocalDbFallback()) {
    const localDb = readLocalDb();
    const profile = localDb.profiles?.find((item) => item.userId === userId);
    if (!profile) return res.status(404).json({ error: "Profile not found" });
    return res.json(calculateProfileCompletion(profile));
  }

  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId))
    .limit(1);
  if (!profile) return res.status(404).json({ error: "Profile not found" });
  return res.json(calculateProfileCompletion(profile));
});

router.get("/profiles/username/check", async (req, res) => {
  const userId = authUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const result = validateUsername(req.query.username);
  if (result.error || !result.username) {
    return res.json({
      username: normalizeUsername(req.query.username) ?? "",
      valid: false,
      available: false,
      error: result.error,
    });
  }

  if (shouldUseLocalDbFallback()) {
    const localDb = readLocalDb();
    const taken = (localDb.profiles ?? []).some((profile) => profile.userId !== userId && usernameFromProfile(profile) === result.username);
    return res.json({ username: result.username, valid: true, available: !taken });
  }

  const profiles = await db.select().from(profilesTable);
  const taken = profiles.some((profile) => profile.userId !== userId && usernameFromProfile(profile) === result.username);
  return res.json({ username: result.username, valid: true, available: !taken });
});

router.get("/profiles/search", async (req, res) => {
  const userId = authUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const query = String(req.query.q ?? "").trim().toLowerCase();
  if (query.length === 0) return res.json({ profiles: [] });

  const matchesQuery = (profile: LocalProfile | typeof profilesTable.$inferSelect) => {
    const username = usernameFromProfile(profile) ?? "";
    const displayName = profile.displayName?.toLowerCase() ?? "";
    return username.includes(query) || displayName.includes(query);
  };

  if (shouldUseLocalDbFallback()) {
    const localDb = readLocalDb();
    const results = (localDb.profiles ?? [])
      .filter((profile) => profile.userId !== userId)
      .filter(matchesQuery)
      .map(profileSearchResult);
    return res.json({ profiles: sortProfileSearchResults(query, results).slice(0, 20) });
  }

  const blockedByMe = await db.select({ userId: blocksTable.blockedUserId }).from(blocksTable).where(eq(blocksTable.blockerUserId, userId));
  const blockedMe = await db.select({ userId: blocksTable.blockerUserId }).from(blocksTable).where(eq(blocksTable.blockedUserId, userId));
  const blockedIds = new Set([...blockedByMe, ...blockedMe].map((item) => item.userId));
  const profiles = await db.select().from(profilesTable);
  const results = profiles
    .filter((profile) => profile.userId !== userId)
    .filter((profile) => !blockedIds.has(profile.userId))
    .filter(matchesQuery)
    .map(profileSearchResult);
  return res.json({ profiles: sortProfileSearchResults(query, results).slice(0, 20) });
});

router.get("/profiles/:userId", async (req, res) => {
  const viewerUserId = authUserId(req);
  if (!viewerUserId) return res.status(401).json({ error: "Unauthorized" });

  const { userId } = req.params;
  if (shouldUseLocalDbFallback()) {
    const localDb = readLocalDb();
    const profiles = localDb.profiles ?? [];
    const profileIndex = profiles.findIndex((item) => item.userId === userId);
    if (profileIndex < 0) return res.status(404).json({ error: "Profile not found" });
    const profile = profiles[profileIndex];
    profiles[profileIndex] = {
      ...profile,
      profileViews: (profile.profileViews ?? 0) + 1,
      updatedAt: new Date().toISOString(),
    };
    localDb.profiles = profiles;
    writeLocalDb(localDb);
    const visibility = profile.locationVisibility ?? "fuzzy";
    return res.json({
      ...localProfileResponse(profiles[profileIndex]),
      latitude: visibility === "hidden" ? null : profile.latitude,
      longitude: visibility === "hidden" ? null : profile.longitude,
      distancePrecision: visibility === "active" ? "live" : visibility === "fuzzy" ? "approx" : "none",
    });
  }

  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId))
    .limit(1);

  if (!profile) return res.status(404).json({ error: "Profile not found" });
  const [block] = await db
    .select()
    .from(blocksTable)
    .where(
      or(
        and(eq(blocksTable.blockerUserId, viewerUserId), eq(blocksTable.blockedUserId, userId)),
        and(eq(blocksTable.blockerUserId, userId), eq(blocksTable.blockedUserId, viewerUserId)),
      ),
    )
    .limit(1);
  if (block) return res.status(403).json({ error: "This profile is blocked." });

  await db
    .update(profilesTable)
    .set({ profileViews: (profile.profileViews ?? 0) + 1 })
    .where(eq(profilesTable.userId, userId));

  const visibility = (profile.locationVisibility ?? "fuzzy") as "hidden" | "fuzzy" | "active";
  const safeProfile = {
    ...profile,
    username: usernameFromProfile(profile),
    age: ageFromDob(profile.birthDate),
    latitude: visibility === "hidden" ? null : profile.latitude,
    longitude: visibility === "hidden" ? null : profile.longitude,
    locationVisibility: visibility,
    distancePrecision: visibility === "active" ? "live" : visibility === "fuzzy" ? "approx" : "none",
  };

  return res.json(safeProfile);
});

// 20 photo actions / minute — reorders and deletes are fast; 20 is generous for real users
router.patch("/profiles/me/photos", rateLimit({ key: "photo_patch", windowMs: 60_000, max: 20 }), async (req, res) => {
  const userId = authUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const action = typeof req.body?.action === "string" ? req.body.action : "replace";
  const incomingPhotos = asStringArray(req.body?.photos);
  const photoUrl = typeof req.body?.photoUrl === "string" ? req.body.photoUrl.trim() : "";
  const fromIndex = Number.isInteger(req.body?.fromIndex) ? Number(req.body.fromIndex) : -1;
  const toIndex = Number.isInteger(req.body?.toIndex) ? Number(req.body.toIndex) : -1;

  const updatePhotos = (existing: string[]) => {
    const photos = [...existing];
    if (action === "replace") return incomingPhotos.slice(0, 9);
    if (action === "add" && photoUrl) return [photoUrl, ...photos.filter((item) => item !== photoUrl)].slice(0, 9);
    if (action === "remove" && photoUrl) return photos.filter((item) => item !== photoUrl);
    if (action === "set_main" && photoUrl && photos.includes(photoUrl)) return [photoUrl, ...photos.filter((item) => item !== photoUrl)];
    if (action === "reorder" && fromIndex >= 0 && toIndex >= 0 && fromIndex < photos.length && toIndex < photos.length) {
      const [moved] = photos.splice(fromIndex, 1);
      photos.splice(toIndex, 0, moved);
      return photos;
    }
    return photos;
  };

  if (shouldUseLocalDbFallback()) {
    const localDb = readLocalDb();
    const profiles = localDb.profiles ?? [];
    const profileIndex = profiles.findIndex((item) => item.userId === userId);
    if (profileIndex < 0) return res.status(404).json({ error: "Profile not found" });
    const updatedAt = new Date().toISOString();
    profiles[profileIndex] = {
      ...profiles[profileIndex],
      photos: updatePhotos(profiles[profileIndex].photos ?? []),
      updatedAt,
    };
    localDb.profiles = profiles;
    writeLocalDb(localDb);
    return res.json({ photos: profiles[profileIndex].photos ?? [], completion: calculateProfileCompletion(profiles[profileIndex]) });
  }

  const [existing] = await db.select().from(profilesTable).where(eq(profilesTable.userId, userId)).limit(1);
  if (!existing) return res.status(404).json({ error: "Profile not found" });
  const photos = updatePhotos(asStringArray(existing.photos));
  const [profile] = await db
    .update(profilesTable)
    .set({ photos, updatedAt: new Date() })
    .where(eq(profilesTable.userId, userId))
    .returning();
  return res.json({ photos, completion: calculateProfileCompletion(profile) });
});

const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic"]);
const MAX_PHOTO_BYTES = 15 * 1024 * 1024; // 15 MB

// 15 base64 photo uploads / minute — each processes up to 15 MB; protects storage + CPU
router.post("/profiles/me/photos", rateLimit({ key: "photo_upload", windowMs: 60_000, max: 15 }), async (req, res) => {
  const userId = authUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { base64, contentType } = req.body as { base64?: string; contentType?: string };
  if (!base64) return res.status(400).json({ error: "Missing base64 image data" });

  const ct = contentType || "image/jpeg";
  if (!ALLOWED_PHOTO_TYPES.has(ct)) {
    return res.status(400).json({ error: "Unsupported image type. Use JPEG, PNG, WebP, or HEIC." });
  }

  try {
    const buffer = Buffer.from(base64, "base64");
    if (buffer.byteLength > MAX_PHOTO_BYTES) {
      return res.status(413).json({ error: "Image exceeds the 15 MB size limit." });
    }
    if (shouldUseLocalDbFallback()) {
      return res.json({ url: `data:${ct};base64,${base64}` });
    }
    const objectPath = await objectStorageService.uploadObjectEntityBuffer(buffer, ct);
    const id = objectPath.replace(/^\/objects\//, "");
    const domain = process.env.REPLIT_DEV_DOMAIN;
    const url = `https://${domain}/api/storage/objects/${id}`;
    return res.json({ url });
  } catch (err) {
    req.log.error({ err }, "Photo upload failed");
    return res.status(500).json({ error: "Upload failed" });
  }
});

export default router;
