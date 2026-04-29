import { useRef, useState, useCallback, useEffect } from "react";
import * as Crypto from "expo-crypto";
import type { CameraView } from "expo-camera";
import {
  useFaceDetector,
  SMILE_RATIO_THRESHOLD,
  SMILE_LIP_RISE_MIN,
  TURN_RATIO,
  NOD_DELTA,
  EAR_BLINK_THRESHOLD,
  BLINK_FRAMES_NEEDED,
  QUALITY_MIN_AREA,
  QUALITY_MAX_AREA,
  QUALITY_MAX_OFFSET,
  QUALITY_MIN_BRIGHTNESS,
  QUALITY_MAX_BRIGHTNESS,
  QUALITY_MIN_BLUR,
  QUALITY_MIN_TEXTURE,
  QUALITY_MAX_REFLECTION,
  QUALITY_MIN_CONFIDENCE,
  type FaceAnalysis,
} from "./useFaceDetector";

export type ChallengeType = "smile";
export type Phase = "loading" | "modelwait" | "quality" | "challenge" | "submitting" | "success" | "failed";

interface LivenessSession {
  sessionToken: string;  // opaque server-signed token; echoed back in verify-face
  challenges: ChallengeType[];
  expiresAt: number;
}

interface ChallengeRecord {
  challenge: ChallengeType;
  duration: number;
  challengeSignal: number;
  peakLandmarkConfidence: number;
}

export const CHALLENGE_LABELS: Record<ChallengeType, string> = {
  smile: "Give a big smile 😊",
};

export const CHALLENGE_ICONS: Record<ChallengeType, string> = {
  smile: "happy-outline",
};

const BLINK_WINDOW_MS         = 4_000;
const NOD_DOWN_TIMEOUT_MS     = 2_000;
const CONSECUTIVE_PASS_NEEDED = 10;
const QUALITY_FRAMES_NEEDED   = 2;
const QUALITY_FAIL_MS         = 15_000;
const FRAME_INTERVAL_MS       = 350;

// SHA-256 of quantised geometry vector, via expo-crypto (works in Expo Go on iOS + Android).
async function computeFaceHash(geometryVector: number[]): Promise<string> {
  const quantised = geometryVector.map((v) => Math.max(0, Math.min(15, Math.round(v * 15))));
  const hexStr    = quantised.map((b) => b.toString(16).padStart(1, "0")).join("");
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, hexStr, {
    encoding: Crypto.CryptoEncoding.HEX,
  });
}

function computeLivenessScore(records: ChallengeRecord[]): number {
  if (!records.length) return 0;
  const confidenceComponent = records.reduce((s, r) => s + Math.min(1, r.peakLandmarkConfidence), 0) / records.length;
  const timingComponent     = records.filter((r) => r.duration >= 600 && r.duration <= 6_000).length / records.length;
  return 0.60 * confidenceComponent + 0.40 * timingComponent;
}

// ── Quality helpers ────────────────────────────────────────────────────────────────────────

function faceQualityOk(a: FaceAnalysis): boolean {
  return (
    a.detected &&
    a.faceAreaRatio  >= QUALITY_MIN_AREA          &&
    a.faceAreaRatio  <= QUALITY_MAX_AREA          &&
    Math.abs(a.faceOffsetX) <= QUALITY_MAX_OFFSET &&
    Math.abs(a.faceOffsetY) <= QUALITY_MAX_OFFSET &&
    a.brightnessScore >= QUALITY_MIN_BRIGHTNESS   &&
    a.brightnessScore <= QUALITY_MAX_BRIGHTNESS   &&
    a.blurScore       >= QUALITY_MIN_BLUR         &&
    a.textureScore    >= QUALITY_MIN_TEXTURE      &&
    a.reflectionScore <= QUALITY_MAX_REFLECTION   &&
    a.confidence      >= QUALITY_MIN_CONFIDENCE
  );
}

function qualityHintFor(a: FaceAnalysis): string {
  if (!a.detected)                                  return "Center your face in the oval";
  if (a.faceAreaRatio < QUALITY_MIN_AREA)           return "Move closer to the camera";
  if (a.faceAreaRatio > QUALITY_MAX_AREA)           return "Move the phone further away";
  if (Math.abs(a.faceOffsetX) > QUALITY_MAX_OFFSET ||
      Math.abs(a.faceOffsetY) > QUALITY_MAX_OFFSET) return "Center your face in the oval";
  if (a.brightnessScore < QUALITY_MIN_BRIGHTNESS)   return "Find better lighting — it's too dark";
  if (a.brightnessScore > QUALITY_MAX_BRIGHTNESS)   return "Reduce lighting or glare";
  if (a.blurScore       < QUALITY_MIN_BLUR)         return "Hold still — the image is blurry";
  if (a.textureScore    < QUALITY_MIN_TEXTURE)      return "Avoid screens or printed photos";
  if (a.reflectionScore > QUALITY_MAX_REFLECTION)   return "Reduce glare or reflections";
  return "Hold still — getting a clear image";
}

// ── Hook ──────────────────────────────────────────────────────────────────────────────────

export function useFaceChallenge(
  domain: string,
  getToken: () => Promise<string | null>,
  cameraRef: React.RefObject<CameraView | null>,
  onSuccess: () => void,
  onCancel: () => void,
) {
  const faceDetector = useFaceDetector(cameraRef);

  const [phase, setPhase]                         = useState<Phase>("loading");
  const [session, setSession]                     = useState<LivenessSession | null>(null);
  const [challengeIndex, setChallengeIndex]       = useState(0);
  const [qualityHint, setQualityHint]             = useState("Center your face in the oval");
  const [countdown, setCountdown]                 = useState(20);
  const [errorMsg, setErrorMsg]                   = useState("");
  const [passedCount, setPassedCount]             = useState(0);
  const [detectionProgress, setDetectionProgress] = useState(0);

  const challengeRecordsRef = useRef<ChallengeRecord[]>([]);
  const challengeCertsRef   = useRef<Array<{ challengeCert: string; issuedAt: number; challengeIndex: number }>>([]);
  const frameSignalsRef     = useRef<number[]>([]);  // per-frame signal trace for current challenge
  const frameConfsRef       = useRef<number[]>([]);  // per-frame confidence trace for current challenge
  const captureTimerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const qualityTimerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const qualityFailTimerRef = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const advancingRef        = useRef(false);
  const bestGeomVecRef      = useRef<number[]>([]);  // stored locally; hash is sent (not raw vector)
  const bestConfRef         = useRef(0);
  const peakSignalRef       = useRef(0);
  const peakConfRef         = useRef(0);
  const consPassRef         = useRef(0);

  const blinkCountRef   = useRef(0);
  const blinkStartRef   = useRef(0);
  const eyeOpenRef      = useRef(true);
  const closedFramesRef = useRef(0);

  // Motion consistency: track previous nose position to reject sudden impossible jumps
  // (e.g. a static printed image being repositioned in front of the camera).
  const prevNosePosRef  = useRef<{ x: number; y: number } | null>(null);
  const MOTION_JUMP_MAX = 0.12; // > 12 % of frame dimension between frames is a discontinuity

  type NodState = "neutral" | "down" | "recovered";
  const nodStateRef       = useRef<NodState>("neutral");
  const nodBaselineRef    = useRef(0);
  const nodBaselineSetRef = useRef(false);
  const nodDownStartRef   = useRef(0);

  const stopCapture   = useCallback(() => { if (captureTimerRef.current)  { clearInterval(captureTimerRef.current);    captureTimerRef.current   = null; } }, []);
  const stopCountdown = useCallback(() => { if (countdownTimerRef.current) { clearInterval(countdownTimerRef.current);   countdownTimerRef.current  = null; } }, []);
  const stopQuality   = useCallback(() => {
    if (qualityTimerRef.current)     { clearInterval(qualityTimerRef.current);    qualityTimerRef.current   = null; }
    if (qualityFailTimerRef.current) { clearTimeout(qualityFailTimerRef.current); qualityFailTimerRef.current = null; }
  }, []);

  useEffect(() => {
    if (faceDetector.status === "loading") setPhase("modelwait");
    if (faceDetector.status === "ready" && (phase === "modelwait" || phase === "loading")) loadSession();
    if (faceDetector.status === "error") { setErrorMsg(faceDetector.initError ?? "Face model failed to load."); setPhase("failed"); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faceDetector.status]);

  const loadSession = useCallback(async () => {
    setPhase("loading");
    setErrorMsg("");
    advancingRef.current   = false;
    bestGeomVecRef.current = [];
    bestConfRef.current    = 0;
    try {
      const token = await getToken();
      const res = await fetch(`https://${domain}/api/profiles/liveness-nonce`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.status === 429) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setErrorMsg(body.error ?? "Too many attempts. Try again later.");
        setPhase("failed");
        return;
      }
      if (!res.ok) throw new Error("Could not start verification session.");
      const data = await res.json() as LivenessSession;
      setSession(data);
      setChallengeIndex(0);
      challengeRecordsRef.current = [];
      challengeCertsRef.current   = [];
      setPassedCount(0);
      setDetectionProgress(0);
      setPhase("quality");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Network error.");
      setPhase("failed");
    }
  }, [domain, getToken]);

  useEffect(() => {
    if (phase !== "quality") return;
    let passFrames = 0;

    qualityTimerRef.current = setInterval(async () => {
      const a = await faceDetector.analyzeFace();
      if (!a) return;
      if (a.detected && a.confidence > bestConfRef.current) {
        bestConfRef.current    = a.confidence;
        bestGeomVecRef.current = a.geometryVector;
      }
      if (faceQualityOk(a)) {
        passFrames++;
        setQualityHint(passFrames >= 3 ? "Hold still…" : "Good — keep centered");
        if (passFrames >= QUALITY_FRAMES_NEEDED) { stopQuality(); setPhase("challenge"); }
      } else {
        passFrames = 0;
        setQualityHint(qualityHintFor(a));
      }
    }, FRAME_INTERVAL_MS);

    qualityFailTimerRef.current = setTimeout(() => {
      stopQuality();
      setErrorMsg("Could not get a clear face image. Ensure good lighting and hold the phone 30–40 cm away.");
      setPhase("failed");
    }, QUALITY_FAIL_MS);

    return () => stopQuality();
  }, [phase, faceDetector, stopQuality]);

  const advanceChallenge = useCallback(
    async (sess: LivenessSession, idx: number, record: ChallengeRecord) => {
      if (advancingRef.current) return;
      advancingRef.current = true;
      stopCapture(); stopCountdown();
      challengeRecordsRef.current.push(record);
      setPassedCount((n) => n + 1);
      setDetectionProgress(0);
      consPassRef.current = 0;

      try {
        const measurements = frameSignalsRef.current.slice();
        const confidences  = frameConfsRef.current.slice();
        frameSignalsRef.current = [];
        frameConfsRef.current   = [];

        const token = await getToken();
        const tickRes = await fetch(`https://${domain}/api/profiles/liveness-challenge-tick`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            sessionToken:   sess.sessionToken,
            challengeIndex: idx,
            measurements,
            confidences,
            durationMs:     record.duration,
          }),
        });
        if (!tickRes.ok) {
          const body = await tickRes.json().catch(() => ({})) as { error?: string };
          throw new Error(body.error ?? "Challenge acknowledgement failed. Please retry.");
        }
        const certData = await tickRes.json() as { challengeCert: string; issuedAt: number; challengeIndex: number };
        challengeCertsRef.current.push(certData);
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "Network error during challenge.");
        setPhase("failed");
        advancingRef.current = false;
        return;
      }

      const next = idx + 1;
      if (next >= sess.challenges.length) {
        submitProof(sess);
      } else {
        setChallengeIndex(next);
        setCountdown(20);
        advancingRef.current = false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [domain, getToken, stopCapture, stopCountdown],
  );

  useEffect(() => {
    if (phase !== "challenge" || !session) return;
    const challenge = session.challenges[challengeIndex];

    advancingRef.current  = false;
    consPassRef.current   = 0;
    peakSignalRef.current = challenge === "blink" ? 1 : 0;
    peakConfRef.current   = 0;
    prevNosePosRef.current = null; // reset motion tracking for new challenge
    setCountdown(20);
    setDetectionProgress(0);

    blinkCountRef.current   = 0;
    blinkStartRef.current   = Date.now();
    eyeOpenRef.current      = true;
    closedFramesRef.current = 0;

    nodStateRef.current       = "neutral";
    nodBaselineRef.current    = 0;
    nodBaselineSetRef.current = false;
    nodDownStartRef.current   = 0;

    frameSignalsRef.current = [];
    frameConfsRef.current   = [];

    const t0 = Date.now();

    captureTimerRef.current = setInterval(async () => {
      if (advancingRef.current) return;

      const a: FaceAnalysis | null = await faceDetector.analyzeFace();
      if (!a?.detected) { consPassRef.current = 0; prevNosePosRef.current = null; return; }

      if (a.confidence > bestConfRef.current) { bestConfRef.current = a.confidence; bestGeomVecRef.current = a.geometryVector; }
      if (a.confidence > peakConfRef.current) peakConfRef.current = a.confidence;

      const currentNose = { x: a.faceOffsetX, y: a.faceOffsetY };
      if (prevNosePosRef.current) {
        const jumpX = Math.abs(currentNose.x - prevNosePosRef.current.x);
        const jumpY = Math.abs(currentNose.y - prevNosePosRef.current.y);
        if (Math.max(jumpX, jumpY) > MOTION_JUMP_MAX) {
          consPassRef.current = 0;
          prevNosePosRef.current = currentNose;
          return;
        }
      }
      prevNosePosRef.current = currentNose;

      const elapsed = Date.now() - t0;
      let passed = false;
      let currentSignal = 0;

      if (challenge === "blink") {
        const eyeNowOpen = a.ear >= EAR_BLINK_THRESHOLD;
        if (!eyeNowOpen) {
          closedFramesRef.current++;
          if (a.ear < peakSignalRef.current) peakSignalRef.current = a.ear;
        } else if (!eyeOpenRef.current) {
          if (closedFramesRef.current >= BLINK_FRAMES_NEEDED) blinkCountRef.current++;
          closedFramesRef.current = 0;
        }
        eyeOpenRef.current = eyeNowOpen;
        currentSignal = peakSignalRef.current;
        passed = blinkCountRef.current >= 2 && (Date.now() - blinkStartRef.current) <= BLINK_WINDOW_MS;
        setDetectionProgress(Math.min(1, blinkCountRef.current / 2));
      } else if (challenge === "nod") {
        if (!nodBaselineSetRef.current) { nodBaselineRef.current = a.headY; nodBaselineSetRef.current = true; }
        const delta = a.headY - nodBaselineRef.current;
        currentSignal = Math.abs(delta);
        if (currentSignal > peakSignalRef.current) peakSignalRef.current = currentSignal;
        if (nodStateRef.current === "neutral" && delta > NOD_DELTA) {
          nodStateRef.current = "down"; nodDownStartRef.current = Date.now();
        } else if (nodStateRef.current === "down") {
          if (Date.now() - nodDownStartRef.current > NOD_DOWN_TIMEOUT_MS) {
            nodStateRef.current = "neutral"; nodBaselineSetRef.current = false;
          } else if (Math.abs(delta) < NOD_DELTA * 0.35) {
            nodStateRef.current = "recovered";
          }
        }
        passed = nodStateRef.current === "recovered";
        setDetectionProgress(nodStateRef.current === "recovered" ? 1 : nodStateRef.current === "down" ? 0.5 : 0);
      } else {
        let active = false;
        if (challenge === "smile") {
          active = a.mouthRatio > SMILE_RATIO_THRESHOLD && a.lipCornerRise >= SMILE_LIP_RISE_MIN;
          currentSignal = a.mouthRatio;
        } else if (challenge === "turn_left")  { active = a.headX < -TURN_RATIO; currentSignal = -a.headX; }
        else                                   { active = a.headX > TURN_RATIO;  currentSignal = a.headX;  }
        if (currentSignal > peakSignalRef.current) peakSignalRef.current = currentSignal;
        if (active) consPassRef.current++;
        else consPassRef.current = Math.max(0, consPassRef.current - 1);
        setDetectionProgress(Math.min(1, consPassRef.current / CONSECUTIVE_PASS_NEEDED));
        passed = consPassRef.current >= CONSECUTIVE_PASS_NEEDED && elapsed >= 600;
      }

      const rawFrameSignal = challenge === "blink" ? a.ear : currentSignal;
      frameSignalsRef.current.push(rawFrameSignal);
      frameConfsRef.current.push(a.confidence);

      if (passed) {
        advanceChallenge(session, challengeIndex, {
          challenge,
          duration:               Date.now() - t0,
          challengeSignal:        peakSignalRef.current,
          peakLandmarkConfidence: peakConfRef.current,
        });
      }
    }, FRAME_INTERVAL_MS);

    countdownTimerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          stopCapture(); stopCountdown();
          setErrorMsg("Time ran out — please try again.");
          setPhase("failed");
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    return () => { stopCapture(); stopCountdown(); };
  }, [phase, challengeIndex, session, faceDetector, stopCapture, stopCountdown, advanceChallenge]);

  function submitProof(sess: LivenessSession) {
    setPhase("submitting");
    const records   = challengeRecordsRef.current;
    const timestamp = Date.now();

    const livenessScore = computeLivenessScore(records);

    const geoVec = bestGeomVecRef.current.length === 128
      ? bestGeomVecRef.current
      : Array.from<number>({ length: 128 }).fill(0);

    computeFaceHash(geoVec)
      .then((faceHash) => getToken().then((token) => ({ faceHash, token })))
      .then(({ faceHash, token }) =>
        fetch(`https://${domain}/api/profiles/verify-face`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            livenessProof: {
              sessionToken:    sess.sessionToken,
              timestamp,
              faceHash,
              livenessScore,
              challengesPassed: sess.challenges,
              challengeCerts:  challengeCertsRef.current,
            },
          }),
        })
      )
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { error?: string };
          throw new Error(body.error ?? "Verification failed. Please try again.");
        }
        setPhase("success");
        setTimeout(onSuccess, 1600);
      })
      .catch((e: unknown) => {
        setErrorMsg(e instanceof Error ? e.message : "Verification failed.");
        setPhase("failed");
      });
  }

  const retry = useCallback(() => {
    challengeRecordsRef.current = [];
    challengeCertsRef.current   = [];
    bestGeomVecRef.current      = [];
    bestConfRef.current         = 0;
    setPassedCount(0);
    setErrorMsg("");
    if (faceDetector.status === "ready") loadSession();
    else setPhase("modelwait");
  }, [loadSession, faceDetector.status]);

  return {
    phase,
    currentChallenge:  session?.challenges[challengeIndex] as ChallengeType | undefined,
    qualityHint,
    countdown,
    errorMsg,
    passedCount,
    totalChallenges:   session?.challenges.length ?? 1,
    detectionProgress,
    detectorStatus:    faceDetector.status,
    retry,
    onCancel,
    triggerBlink:      (faceDetector as unknown as { triggerBlink?: () => void }).triggerBlink,
    triggerSmile:      (faceDetector as unknown as { triggerSmile?: () => void }).triggerSmile,
    triggerTurnLeft:   (faceDetector as unknown as { triggerTurnLeft?: () => void }).triggerTurnLeft,
    triggerTurnRight:  (faceDetector as unknown as { triggerTurnRight?: () => void }).triggerTurnRight,
    triggerNod:        (faceDetector as unknown as { triggerNod?: () => void }).triggerNod,
  };
}
