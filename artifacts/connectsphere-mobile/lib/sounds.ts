/**
 * lib/sounds.ts
 *
 * Lightweight sound-effect layer built on expo-av.
 *
 * Usage:
 *   import { playSound } from "@/lib/sounds";
 *   await playSound("match");          // fire and forget — never throws
 *
 * Sound files live in assets/sounds/*.mp3.
 * Replace the silent placeholders with real audio before shipping.
 * User preference (mute) is respected via AsyncStorage key "cs:sounds:muted".
 *
 * Design goals:
 *  - Never blocks the UI — every call is fire-and-forget
 *  - Graceful degradation: missing/corrupt file = silent, never a crash
 *  - One loaded Sound object per name, re-used across calls
 *  - Does not interfere with background music (mix with others)
 */

import { Audio, type AVPlaybackSource } from "expo-av";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ── Types ──────────────────────────────────────────────────────────────────────

export type SoundName = "swipe_right" | "swipe_left" | "match" | "message_ping";

// ── Asset map ─────────────────────────────────────────────────────────────────
// Keep as a plain object so Metro can tree-shake unused assets.

const SOUND_ASSETS: Record<SoundName, AVPlaybackSource> = {
  swipe_right: require("../assets/sounds/swipe_right.mp3"),
  swipe_left: require("../assets/sounds/swipe_left.mp3"),
  match: require("../assets/sounds/match.mp3"),
  message_ping: require("../assets/sounds/message_ping.mp3"),
};

// ── State ─────────────────────────────────────────────────────────────────────

const MUTE_KEY = "cs:sounds:muted";

/** Cached Sound objects — loaded lazily, one per name. */
const cache = new Map<SoundName, Audio.Sound>();

/** Whether the user has muted SFX. Loaded once at first use. */
let mutedResolved = false;
let muted = false;

// ── Audio mode (set once) ─────────────────────────────────────────────────────

let audioModeSet = false;

async function ensureAudioMode() {
  if (audioModeSet) return;
  audioModeSet = true;
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: false, // respect the iOS ringer switch
      staysActiveInBackground: false,
      shouldDuckAndroid: false,
    });
  } catch {
    // non-fatal
  }
}

// ── Mute helpers ──────────────────────────────────────────────────────────────

async function loadMutePref() {
  if (mutedResolved) return;
  mutedResolved = true;
  try {
    const val = await AsyncStorage.getItem(MUTE_KEY);
    muted = val === "1";
  } catch {
    muted = false;
  }
}

/** Toggle SFX mute. Returns the new muted state. */
export async function toggleSoundsMuted(): Promise<boolean> {
  muted = !muted;
  mutedResolved = true;
  try {
    await AsyncStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    // non-fatal
  }
  return muted;
}

/** Read current muted state (loads from storage the first time). */
export async function isSoundsMuted(): Promise<boolean> {
  await loadMutePref();
  return muted;
}

// ── Core playback ─────────────────────────────────────────────────────────────

/**
 * Play a sound effect. Always resolves — never rejects.
 * Silently does nothing if the device is muted or the file fails.
 */
export async function playSound(name: SoundName): Promise<void> {
  try {
    await loadMutePref();
    if (muted) return;

    await ensureAudioMode();

    let sound = cache.get(name);

    if (!sound) {
      const { sound: loaded } = await Audio.Sound.createAsync(
        SOUND_ASSETS[name],
        { shouldPlay: false, volume: 0.85 }
      );
      cache.set(name, loaded);
      sound = loaded;
    }

    // Rewind to start before replaying so rapid-fire calls work
    await sound.setPositionAsync(0);
    await sound.playAsync();
  } catch {
    // Silent failure — bad file, no audio session, etc.
  }
}

/** Convenience aliases */
export const playSoundSwipeRight = () => playSound("swipe_right");
export const playSoundSwipeLeft = () => playSound("swipe_left");
export const playSoundMatch = () => playSound("match");
export const playSoundPing = () => playSound("message_ping");

/** Unload all cached sounds (call on logout / app background to free memory). */
export async function unloadAllSounds(): Promise<void> {
  const promises: Promise<void>[] = [];
  for (const [, sound] of cache) {
    promises.push(sound.unloadAsync().then(() => undefined).catch(() => undefined));
  }
  cache.clear();
  await Promise.all(promises);
}
