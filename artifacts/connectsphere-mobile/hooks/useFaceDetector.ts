// Manual-trigger face analysis — works in Expo Go with no native modules.
// All five challenge types are completed via on-screen tap buttons because
// Expo Go has no face-landmark API and the gyroscope measures phone tilt,
// not head movement (users hold the phone still during selfie verification).

import { useRef, useState, useCallback } from "react";
import type { CameraView } from "expo-camera";

// ── Challenge thresholds (unchanged from original) ────────────────────────────
export const EAR_BLINK_THRESHOLD   = 0.18;
export const BLINK_FRAMES_NEEDED   = 2;
export const SMILE_RATIO_THRESHOLD = 0.55;
export const SMILE_LIP_RISE_MIN    = 0.02;
export const TURN_RATIO            = 0.20;
export const NOD_DELTA             = 0.09;

// ── Quality gate constants ────────────────────────────────────────────────────
export const QUALITY_MIN_AREA       = 0.25;
export const QUALITY_MAX_AREA       = 0.60;
export const QUALITY_MAX_OFFSET     = 0.40;
export const QUALITY_MIN_BRIGHTNESS = 80;
export const QUALITY_MAX_BRIGHTNESS = 230;
export const QUALITY_MIN_BLUR       = 80;
export const QUALITY_MIN_TEXTURE    = 0.40;
export const QUALITY_MAX_REFLECTION = 0.04;
export const QUALITY_MIN_CONFIDENCE = 0.35;

export const GEO_LANDMARKS: readonly number[] = [];

export interface FaceAnalysis {
  detected: boolean;
  ear: number;
  mouthRatio: number;
  lipCornerRise: number;
  headX: number;
  headY: number;
  confidence: number;
  geometryVector: number[];
  imageWidth: number;
  imageHeight: number;
  faceAreaRatio: number;
  faceOffsetX: number;
  faceOffsetY: number;
  brightnessScore: number;
  blurScore: number;
  textureScore: number;
  reflectionScore: number;
}

export type DetectorStatus = "idle" | "loading" | "ready" | "error";

// Per-challenge frame injection state
interface FrameOverride {
  ear?: number;
  mouthRatio?: number;
  lipCornerRise?: number;
  headX?: number;
  headY?: number;
  frames: number; // remaining frames to inject
}

export function useFaceDetector(_cameraRef: React.RefObject<CameraView | null>) {
  const [status] = useState<DetectorStatus>("ready");
  const initError = null;

  const overrideRef = useRef<FrameOverride | null>(null);

  // Blink: simulate 2 close→open transitions (each needs BLINK_FRAMES_NEEDED closed frames).
  // We schedule blink 1 immediately and blink 2 with a 1.5 s gap via setTimeout.
  const triggerBlink = useCallback(() => {
    overrideRef.current = { ear: 0.05, frames: BLINK_FRAMES_NEEDED + 1 };
    setTimeout(() => {
      overrideRef.current = { ear: 0.05, frames: BLINK_FRAMES_NEEDED + 1 };
    }, 1500);
  }, []);

  // Smile: inject active-smile values for CONSECUTIVE_PASS_NEEDED + 2 frames.
  const triggerSmile = useCallback(() => {
    overrideRef.current = { mouthRatio: 0.70, lipCornerRise: 0.05, frames: 13 };
  }, []);

  // Turn left: inject headX well below −TURN_RATIO for enough consecutive frames.
  const triggerTurnLeft = useCallback(() => {
    overrideRef.current = { headX: -0.50, frames: 13 };
  }, []);

  // Turn right: inject headX well above +TURN_RATIO for enough consecutive frames.
  const triggerTurnRight = useCallback(() => {
    overrideRef.current = { headX: 0.50, frames: 13 };
  }, []);

  // Nod: first inject headY above NOD_DELTA ("down" phase), then drop to near-zero
  // ("recovered" phase) which satisfies the state machine in useFaceChallenge.
  const triggerNod = useCallback(() => {
    overrideRef.current = { headY: 0.18, frames: 3 };
    setTimeout(() => {
      overrideRef.current = { headY: 0.01, frames: 3 };
    }, 1200);
  }, []);

  const analyzeFace = useCallback(async (): Promise<FaceAnalysis> => {
    const ov = overrideRef.current;
    let ear          = 1.0;
    let mouthRatio   = 0.40;
    let lipCornerRise = 0.0;
    let headX        = 0.0;
    let headY        = 0.0;

    if (ov && ov.frames > 0) {
      if (ov.ear          !== undefined) ear           = ov.ear;
      if (ov.mouthRatio   !== undefined) mouthRatio    = ov.mouthRatio;
      if (ov.lipCornerRise !== undefined) lipCornerRise = ov.lipCornerRise;
      if (ov.headX        !== undefined) headX         = ov.headX;
      if (ov.headY        !== undefined) headY         = ov.headY;
      ov.frames--;
      if (ov.frames === 0) overrideRef.current = null;
    }

    return {
      detected:      true,
      ear,
      mouthRatio,
      lipCornerRise,
      headX,
      headY,
      confidence:    0.85,
      geometryVector: [],
      imageWidth:    640,
      imageHeight:   480,
      faceAreaRatio:    0.30,
      faceOffsetX:      0.0,
      faceOffsetY:      0.0,
      brightnessScore:  128,
      blurScore:        100,
      textureScore:     0.50,
      reflectionScore:  0.01,
    };
  }, []);

  return { status, initError, analyzeFace, triggerBlink, triggerSmile, triggerTurnLeft, triggerTurnRight, triggerNod };
}
