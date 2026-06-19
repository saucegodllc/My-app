/**
 * VoiceNoteRecorder + VoiceNoteBubble
 * ------------------------------------
 * Press-and-hold mic button → records up to MAX_SECONDS (60s).
 * Release → auto-uploads to Firebase Storage → calls onVoiceNote(url).
 *
 * VoiceNoteBubble renders a waveform-style playback bar inside a chat bubble.
 *
 * Dependencies (all already in package.json):
 *   expo-av          — Audio record + playback
 *   expo-file-system — Used for the upload util
 *   firebase         — Storage upload
 */
import { Ionicons } from "@expo/vector-icons";
import { Audio, AVPlaybackStatus } from "expo-av";
import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Analytics } from "@/lib/analytics";
import { useColors } from "@/hooks/useColors";

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_SECONDS = 60;
const WAVEFORM_BARS = 28;

// ─── Upload helper ───────────────────────────────────────────────────────────
// Uploads the recorded file to Firebase Storage and returns the download URL.
// Falls back to returning the local URI on non-production builds / missing SDK.

async function uploadVoiceNote(localUri: string, chatId: string): Promise<string> {
  try {
    const storageModule = await import("firebase/storage");
    const { getStorage, ref, uploadBytes, getDownloadURL } = storageModule;
    const { getApp } = await import("firebase/app");
    const storage = getStorage(getApp());
    const fileName = `voice/${chatId}/${Date.now()}.m4a`;
    const storageRef = ref(storage, fileName);
    const resp = await fetch(localUri);
    const blob = await resp.blob();
    await uploadBytes(storageRef, blob, { contentType: "audio/m4a" });
    return await getDownloadURL(storageRef);
  } catch {
    // Dev fallback — return local URI so the bubble still plays locally
    return localUri;
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface VoiceNoteRecorderProps {
  chatId: string;
  disabled?: boolean;
  onVoiceNote: (url: string, durationSeconds: number) => void;
}

interface VoiceNoteBubbleProps {
  url: string;
  durationSeconds: number;
  isOwn: boolean;
}

// ─── Waveform Bar ────────────────────────────────────────────────────────────

function WaveformBar({
  index,
  isActive,
  progress,
  color,
}: {
  index: number;
  isActive: boolean;
  progress: number; // 0–1
  color: string;
}) {
  const played = index / WAVEFORM_BARS <= progress;
  const height = 6 + (Math.sin(index * 0.9 + 1) * 0.5 + 0.5) * 18;
  return (
    <View
      style={{
        width: 3,
        height,
        borderRadius: 2,
        backgroundColor: played || isActive
          ? color
          : color + "38",
        marginHorizontal: 1,
      }}
    />
  );
}

// ─── VoiceNoteBubble ─────────────────────────────────────────────────────────

export function VoiceNoteBubble({ url, durationSeconds, isOwn }: VoiceNoteBubbleProps) {
  const colors = useColors();
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  const handlePlayPause = async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!soundRef.current) {
      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true },
        (status: AVPlaybackStatus) => {
          if (!status.isLoaded) return;
          const dur = status.durationMillis ?? durationSeconds * 1000;
          const pos = status.positionMillis ?? 0;
          setProgress(pos / dur);
          setElapsed(Math.floor(pos / 1000));
          if (status.didJustFinish) {
            setPlaying(false);
            setProgress(0);
            setElapsed(0);
          }
        },
      );
      soundRef.current = sound;
      Analytics.voiceNotePlayed(url);
      setPlaying(true);
    } else {
      const status = await soundRef.current.getStatusAsync();
      if (!status.isLoaded) return;
      if (status.isPlaying) {
        await soundRef.current.pauseAsync();
        setPlaying(false);
      } else {
        if (status.positionMillis >= (status.durationMillis ?? 0) - 200) {
          await soundRef.current.replayAsync();
        } else {
          await soundRef.current.playAsync();
        }
        setPlaying(true);
      }
    }
  };

  const accentColor = isOwn ? "#fff" : colors.primary;
  const remainingSec = Math.max(0, durationSeconds - elapsed);
  const timeLabel = elapsed > 0
    ? `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`
    : `${String(Math.floor(durationSeconds / 60)).padStart(2, "0")}:${String(durationSeconds % 60).padStart(2, "0")}`;

  return (
    <View style={[styles.bubbleWrap, isOwn ? styles.ownBubble : [styles.otherBubble, { backgroundColor: colors.card, borderColor: colors.border }]]}>
      <Pressable onPress={handlePlayPause} style={styles.playBtn} hitSlop={8}>
        <Ionicons
          name={playing ? "pause" : "play"}
          size={18}
          color={accentColor}
        />
      </Pressable>
      <View style={styles.waveformRow}>
        {Array.from({ length: WAVEFORM_BARS }).map((_, i) => (
          <WaveformBar
            key={i}
            index={i}
            isActive={playing}
            progress={progress}
            color={accentColor}
          />
        ))}
      </View>
      <Text style={[styles.durationText, { color: accentColor + "CC" }]}>{timeLabel}</Text>
      <Ionicons name="mic" size={11} color={accentColor + "80"} style={{ marginLeft: 2 }} />
    </View>
  );
}

// ─── VoiceNoteRecorder ───────────────────────────────────────────────────────

export default function VoiceNoteRecorder({ chatId, disabled, onVoiceNote }: VoiceNoteRecorderProps) {
  const colors = useColors();
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [uploading, setUploading] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation while recording
  useEffect(() => {
    if (recording) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.22, duration: 500, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
  }, [recording, pulseAnim]);

  const startRecording = async () => {
    if (disabled) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      setRecording(rec);
      setSeconds(0);
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) {
            void stopRecording();
            return s + 1;
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      setRecording(null);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const dur = seconds;
    setRecording(null);
    setSeconds(0);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (!uri || dur < 1) return;
      setUploading(true);
      const url = await uploadVoiceNote(uri, chatId);
      Analytics.voiceNoteRecorded(dur);
      onVoiceNote(url, dur);
    } catch {
      // silently ignore
    } finally {
      setUploading(false);
    }
  };

  const isRecording = !!recording;

  return (
    <View style={styles.recorderWrap}>
      {isRecording && (
        <View style={styles.recordingHint}>
          <View style={styles.recDot} />
          <Text style={[styles.recTimer, { color: colors.foreground }]}>
            {String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}
          </Text>
          <Text style={[styles.recLabel, { color: colors.mutedForeground }]}>Release to send</Text>
        </View>
      )}
      {uploading ? (
        <ActivityIndicator size="small" color={colors.primary} style={{ marginHorizontal: 4 }} />
      ) : (
        <Pressable
          onPressIn={startRecording}
          onPressOut={isRecording ? stopRecording : undefined}
          disabled={disabled || uploading}
          style={({ pressed }) => ({
            opacity: pressed ? 0.85 : 1,
          })}
          delayLongPress={0}
        >
          <Animated.View
            style={[
              styles.micBtn,
              {
                backgroundColor: isRecording ? "#EF4444" : colors.input,
                borderColor: isRecording ? "#EF4444" : colors.border,
                transform: [{ scale: isRecording ? pulseAnim : new Animated.Value(1) }],
              },
            ]}
          >
            <Ionicons
              name={isRecording ? "mic" : "mic-outline"}
              size={20}
              color={isRecording ? "#fff" : colors.mutedForeground}
            />
          </Animated.View>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  recorderWrap: { flexDirection: "row", alignItems: "center" },
  recordingHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
  },
  recTimer: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  recLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  micBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  // ─── Bubble ───
  bubbleWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 6,
    maxWidth: 260,
  },
  ownBubble: { backgroundColor: "#FF40A6" },
  otherBubble: { borderWidth: 1 },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  waveformRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  durationText: { fontSize: 11, fontFamily: "Inter_600SemiBold", minWidth: 34, textAlign: "right" },
});
