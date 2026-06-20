/**
 * sounds.test.ts
 *
 * Tests for lib/sounds.ts — focuses on the mute preference layer
 * (AsyncStorage read/write) rather than the audio engine itself, since
 * expo-av playback is fully mocked by jest-expo.
 *
 * Run: pnpm test
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

// Mock expo-av before importing sounds so Audio.Sound is never instantiated
jest.mock("expo-av", () => ({
  Audio: {
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
    Sound: {
      createAsync: jest.fn().mockResolvedValue({
        sound: {
          setPositionAsync: jest.fn().mockResolvedValue(undefined),
          playAsync: jest.fn().mockResolvedValue(undefined),
          unloadAsync: jest.fn().mockResolvedValue(undefined),
        },
      }),
    },
  },
}));

// Import AFTER mocking expo-av
import {
  isSoundsMuted,
  playSound,
  toggleSoundsMuted,
  unloadAllSounds,
} from "../lib/sounds";

const MUTE_KEY = "cs:sounds:muted";

// Reset AsyncStorage and module-level state between tests
beforeEach(async () => {
  await AsyncStorage.clear();
  // Force the module to re-read the mute pref on the next call
  jest.resetModules();
});

// ── isSoundsMuted ─────────────────────────────────────────────────────────────

test("isSoundsMuted returns false when no pref stored", async () => {
  const { isSoundsMuted: check } = await import("../lib/sounds");
  const muted = await check();
  expect(muted).toBe(false);
});

test("isSoundsMuted returns true when storage value is '1'", async () => {
  await AsyncStorage.setItem(MUTE_KEY, "1");
  const { isSoundsMuted: check } = await import("../lib/sounds");
  const muted = await check();
  expect(muted).toBe(true);
});

test("isSoundsMuted returns false when storage value is '0'", async () => {
  await AsyncStorage.setItem(MUTE_KEY, "0");
  const { isSoundsMuted: check } = await import("../lib/sounds");
  const muted = await check();
  expect(muted).toBe(false);
});

// ── toggleSoundsMuted ─────────────────────────────────────────────────────────

test("toggleSoundsMuted flips false → true and persists to storage", async () => {
  const { toggleSoundsMuted: toggle, isSoundsMuted: check } =
    await import("../lib/sounds");

  const next = await toggle();
  expect(next).toBe(true);

  // Confirm AsyncStorage was updated
  const stored = await AsyncStorage.getItem(MUTE_KEY);
  expect(stored).toBe("1");

  // Re-reading the preference should still return true
  const still = await check();
  expect(still).toBe(true);
});

test("toggleSoundsMuted flips true → false when already muted", async () => {
  await AsyncStorage.setItem(MUTE_KEY, "1");
  const { toggleSoundsMuted: toggle } = await import("../lib/sounds");

  const next = await toggle();
  expect(next).toBe(false);

  const stored = await AsyncStorage.getItem(MUTE_KEY);
  expect(stored).toBe("0");
});

test("two toggles return to original state", async () => {
  const { toggleSoundsMuted: toggle } = await import("../lib/sounds");
  const first = await toggle();   // false → true
  const second = await toggle();  // true → false
  expect(first).toBe(true);
  expect(second).toBe(false);
});

// ── playSound — fire-and-forget, never throws ─────────────────────────────────

test("playSound resolves without throwing for any valid SoundName", async () => {
  const { playSound: play } = await import("../lib/sounds");
  const names = ["swipe_right", "swipe_left", "match", "message_ping"] as const;
  await expect(
    Promise.all(names.map((n) => play(n))),
  ).resolves.not.toThrow();
});

test("playSound resolves silently when muted", async () => {
  await AsyncStorage.setItem(MUTE_KEY, "1");
  const { playSound: play } = await import("../lib/sounds");
  // Should resolve immediately without calling Audio.Sound
  await expect(play("match")).resolves.toBeUndefined();
});

// ── unloadAllSounds ───────────────────────────────────────────────────────────

test("unloadAllSounds resolves without throwing even with empty cache", async () => {
  const { unloadAllSounds: unload } = await import("../lib/sounds");
  await expect(unload()).resolves.not.toThrow();
});
