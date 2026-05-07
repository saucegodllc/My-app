import { Router } from "express";
import { and, eq, gt } from "drizzle-orm";
import { randomUUID, createHash, createHmac, timingSafeEqual } from "crypto";
import { db } from "@workspace/db";
import { profilesTable, livenessNoncesTable, livenessAttemptsTable } from "@workspace/db";
import { UpsertMyProfileBody } from "@workspace/api-zod";
import { getAuth } from "@clerk/express";
import { ObjectStorageService } from "../lib/objectStorage";

const router = Router();
const objectStorageService = new ObjectStorageService();

const CHALLENGE_POOL = ["smile"] as const;
type Challenge = typeof CHALLENGE_POOL[number];

// Server-only MAC secret derived from CLERK_SECRET_KEY — never sent to clients.
// Startup fails fast if the env var is absent.
const SERVER_PROOF_SECRET = (() => {
  const base = process.env.CLERK_SECRET_KEY;
  if (!base) throw new Error("CLERK_SECRET_KEY is required for liveness proof signing");
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
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId))
    .limit(1);

  if (!profile) return res.status(404).json({ error: "Profile not found" });

  return res.json({ ...profile, age: ageFromDob(profile.birthDate) });
});

router.put("/profiles/me", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const parsed = UpsertMyProfileBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid data" });

  const data = parsed.data;

  const [existing] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId))
    .limit(1);

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
    if (!["dating", "friendship"].includes(data.intent ?? "")) {
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
  if (data.modeData !== undefined || data.showGenderOnProfile !== undefined || data.lookingForGender !== undefined) {
    const existingMd = (existing?.modeData as Record<string, unknown>) ?? {};
    const incomingMd = data.modeData ?? {};
    patch.modeData = {
      ...existingMd,
      ...incomingMd,
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

  return res.json({ ...profile, age: ageFromDob(profile.birthDate) });
});

router.post("/profiles/me/community-code", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const [profile] = await db
    .update(profilesTable)
    .set({ communityCodeAcceptedAt: new Date(), updatedAt: new Date() })
    .where(eq(profilesTable.userId, userId))
    .returning();

  if (!profile) return res.status(404).json({ error: "Profile not found" });
  return res.json({ ok: true, acceptedAt: profile.communityCodeAcceptedAt });
});

router.get("/profiles/liveness-nonce", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const now = Date.now();
  const NONCE_TTL_MS = 5 * 60_000; // 5 minutes

  const nonce      = randomUUID();
  const challenges = challengesFromNonce(nonce);
  const expiresAt  = new Date(now + NONCE_TTL_MS);

  await db.insert(livenessNoncesTable).values({ nonce, userId, expiresAt });

  const sessionToken = createSessionToken({ userId, nonce, challenges, iat: now, exp: expiresAt.getTime() });

  return res.json({ sessionToken, challenges, expiresAt: expiresAt.getTime() });
});

router.post("/profiles/liveness-challenge-tick", async (req, res) => {
  const { userId } = getAuth(req);
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

router.post("/profiles/verify-face", async (req, res) => {
  const { userId } = getAuth(req);
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

router.get("/profiles/:userId", async (req, res) => {
  const { userId: authUserId } = getAuth(req);
  if (!authUserId) return res.status(401).json({ error: "Unauthorized" });

  const { userId } = req.params;
  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId))
    .limit(1);

  if (!profile) return res.status(404).json({ error: "Profile not found" });

  await db
    .update(profilesTable)
    .set({ profileViews: (profile.profileViews ?? 0) + 1 })
    .where(eq(profilesTable.userId, userId));

  const visibility = (profile.locationVisibility ?? "fuzzy") as "hidden" | "fuzzy" | "active";
  const safeProfile = {
    ...profile,
    age: ageFromDob(profile.birthDate),
    latitude: visibility === "hidden" ? null : profile.latitude,
    longitude: visibility === "hidden" ? null : profile.longitude,
    locationVisibility: visibility,
    distancePrecision: visibility === "active" ? "live" : visibility === "fuzzy" ? "approx" : "none",
  };

  return res.json(safeProfile);
});

const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic"]);
const MAX_PHOTO_BYTES = 15 * 1024 * 1024; // 15 MB

router.post("/profiles/me/photos", async (req, res) => {
  const { userId } = getAuth(req);
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
