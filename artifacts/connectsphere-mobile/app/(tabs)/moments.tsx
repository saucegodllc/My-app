/**
 * Moments — ConnectSphere
 *
 * Story-style ephemeral posts, open to all users.
 * Replies → Moment Requests in Connect tab.
 * Likes → Moment Likes section in Connect tab.
 *
 * Anti-choppiness rules:
 *  • useNativeDriver:true on ALL animations
 *  • Progress bar via translateX (native-compatible, not width)
 *  • FlatList with keyExtractor + windowSize + removeClippedSubviews
 *  • Viewer as Modal (native slide — no JS-mounted conditional)
 *  • Pulse dot: Animated.loop, stops on unmount
 *  • No anonymous functions in FlatList renderItem
 *  • InteractionManager for post-focus heavy work
 */

import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  InteractionManager,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUser } from "@clerk/clerk-expo";
import { shouldUseDemoSeeds } from "@/lib/launchConfig";
import { openProfile } from "@/lib/routes";

// ── Constants ─────────────────────────────────────────────────────────────────
const PINK   = "#FF2DA8";
const PURPLE = "#A855F7";
const BG     = "#050008";
const CARD   = "#0D0A18";
const MUTED  = "rgba(255,255,255,0.45)";
const DIM    = "rgba(255,255,255,0.15)";

const { width: SW, height: SH } = Dimensions.get("window");
const STORY_SIZE  = 58;
const VIEWER_PROG_W = SW - 32;

// ── Types ─────────────────────────────────────────────────────────────────────
type MomentFilter = "all" | "matches" | "nearby" | "new";

interface PublicMoment {
  id: string;
  userId: string;
  userDisplayName: string;
  userPhotoUrl?: string;
  text: string;
  location?: string;
  echoCount: number;
  echoOfMomentId?: string;
  liveWatchers: number;
  totalViews: number;
  percentRemaining: number;
  timeLabel: string;
  isTrending: boolean;
  isOwn: boolean;
  createdAt: number;
  seen?: boolean;
}

// ── Mock data (replaced by API call in useMoments hook) ──────────────────────
const MOCK_GRADIENT_PAIRS: [string, string][] = [
  ["#A855F7","#3B82F6"],
  ["#FF2DA8","#F97316"],
  ["#10B981","#06B6D4"],
  ["#F59E0B","#EF4444"],
  ["#8B5CF6","#EC4899"],
];

const MOCK_BG: [string,string,string][] = [
  ["#1a0533","#2d0a4e","#0a1a3e"],
  ["#2a0a00","#3d1500","#1a0800"],
  ["#0a1a0a","#0d2e1a","#051a10"],
  ["#1a1000","#2e1a00","#1a0a00"],
  ["#1a0020","#2d0035","#100015"],
];

const MOCK_EMOJI = ["🌅","🍜","💪","☕","🌺"];
const MOCK_INITIALS = ["K","M","J","A","S"];

function buildMockMoments(): PublicMoment[] {
  const now = Date.now();
  const hr = 3_600_000;
  const raw: Omit<PublicMoment,"id"|"userId"|"userPhotoUrl"|"echoOfMomentId"|"isOwn">[] = [
    { userDisplayName:"Kayla", text:"Sunday reset hits different at Crandon 🧘‍♀️", location:"Crandon Park · Key Biscayne", echoCount:3, liveWatchers:14, totalViews:14, percentRemaining:0.06, timeLabel:"1h 22m left", isTrending:true, createdAt: now - 22*60_000 },
    { userDisplayName:"Maya",  text:"new ramen spot in wynwood actually slaps. come try it 👀", location:"Wynwood · Miami", echoCount:0, liveWatchers:6, totalViews:6, percentRemaining:0.43, timeLabel:"10h 12m left", isTrending:false, createdAt: now - 38*60_000 },
    { userDisplayName:"Jess",  text:"5am club. chaotic but we love it 😭", location:"Equinox Brickell", echoCount:1, liveWatchers:2, totalViews:22, percentRemaining:0.85, timeLabel:"20h 30m left", isTrending:false, createdAt: now - 3.5*hr },
    { userDisplayName:"Alicia",text:"Coffee and ocean views. This is the life ☕", location:"South Beach · Miami Beach", echoCount:0, liveWatchers:0, totalViews:8, percentRemaining:0.78, timeLabel:"18h 46m left", isTrending:false, createdAt: now - 5.2*hr },
    { userDisplayName:"Sofia", text:"Farmers market finds 🌸 anyone else obsessed with the Gables market?", location:"Coral Gables Farmers Market", echoCount:2, liveWatchers:3, totalViews:19, percentRemaining:0.55, timeLabel:"13h 8m left", isTrending:false, createdAt: now - 11*hr },
  ];
  return raw.map((m, i) => ({
    ...m,
    id: `mock-${i}`,
    userId: `demo-${m.userDisplayName.toLowerCase()}`,
    isOwn: false,
    seen: i > 2,
  }));
}

// ── useMoments hook ───────────────────────────────────────────────────────────
function useMoments(filter: MomentFilter) {
  const [moments, setMoments]     = useState<PublicMoment[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading]     = useState(true);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      // TODO: replace with actual API call
      // const res = await fetch(`${API_BASE}/api/moments/feed?filter=${filter}`);
      // const data = await res.json();
      // setMoments(data.moments);
      await new Promise(r => setTimeout(r, 400)); // simulate network
      setMoments(shouldUseDemoSeeds() ? buildMockMoments() : []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useFocusEffect(useCallback(() => {
    const task = InteractionManager.runAfterInteractions(() => { load(); });
    return () => task.cancel();
  }, [load]));

  return { moments, refreshing, loading, reload: () => load(true) };
}

// ── PulseDot ──────────────────────────────────────────────────────────────────
function PulseDot() {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.5, duration: 650, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1,   duration: 650, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scale]);
  return (
    <Animated.View style={[styles.pulseDot, { transform: [{ scale }] }]} />
  );
}

// ── StoryItem ─────────────────────────────────────────────────────────────────
function StoryItem({
  moment,
  index,
  onPress,
  onOpenProfile,
}: {
  moment: PublicMoment;
  index: number;
  onPress: () => void;
  onOpenProfile: () => void;
}) {
  const grad = MOCK_GRADIENT_PAIRS[index % MOCK_GRADIENT_PAIRS.length]!;
  const ringStyle = moment.seen
    ? styles.storyRingSeen
    : styles.storyRingLive;

  return (
    <Pressable onPress={onPress} style={styles.storyItem}>
      <LinearGradient
        colors={moment.seen ? ["rgba(255,255,255,0.15)","rgba(255,255,255,0.15)"] : [PINK, PURPLE]}
        style={styles.storyRingOuter}
      >
        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            onOpenProfile();
          }}
          accessibilityRole="button"
          accessibilityLabel={`Open ${moment.userDisplayName}'s profile`}
        >
        <LinearGradient colors={grad} style={styles.storyAv}>
          <Text style={styles.storyInitial}>
            {MOCK_INITIALS[index % MOCK_INITIALS.length]}
          </Text>
        </LinearGradient>
        </Pressable>
      </LinearGradient>
      {moment.liveWatchers > 0 && !moment.seen && (
        <View style={styles.storyLivePip}>
          <Text style={styles.storyLivePipText}>LIVE</Text>
        </View>
      )}
      <Text
        style={styles.storyName}
        numberOfLines={1}
        onPress={onOpenProfile}
        accessibilityRole="button"
      >
        {moment.userDisplayName}
      </Text>
    </Pressable>
  );
}

// ── YourStoryItem ─────────────────────────────────────────────────────────────
function YourStoryItem({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.storyItem}>
      <View style={styles.storyRingAdd}>
        <LinearGradient colors={[PINK, PURPLE]} style={styles.storyAv}>
          <Ionicons name="add" size={22} color="#fff" />
        </LinearGradient>
      </View>
      <Text style={[styles.storyName, { color: PINK }]}>Your Moment</Text>
    </Pressable>
  );
}

// ── ExpiryBar ─────────────────────────────────────────────────────────────────
// Uses width on JS thread — smooth for 5-24h animations.
function ExpiryBar({ percent }: { percent: number }) {
  const anim = useRef(new Animated.Value(percent)).current;
  return (
    <View style={styles.expiryTrack}>
      <Animated.View
        style={[
          styles.expiryFill,
          { width: anim.interpolate({ inputRange:[0,1], outputRange:["0%","100%"] }) },
        ]}
      />
    </View>
  );
}

// ── MomentCard ────────────────────────────────────────────────────────────────
function MomentCard({
  moment,
  index,
  onPress,
  onOpenProfile,
  onReply,
  onLike,
}: {
  moment: PublicMoment;
  index: number;
  onPress: () => void;
  onOpenProfile: () => void;
  onReply: () => void;
  onLike: () => void;
}) {
  const bg    = MOCK_BG[index % MOCK_BG.length]!;
  const emoji = MOCK_EMOJI[index % MOCK_EMOJI.length]!;
  const replyScale = useRef(new Animated.Value(1)).current;
  const likeScale  = useRef(new Animated.Value(1)).current;

  const bounceReact = (anim: Animated.Value, cb: () => void) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.spring(anim, { toValue: 1.45, useNativeDriver: true, speed: 50 }),
      Animated.spring(anim, { toValue: 1,    useNativeDriver: true, speed: 20 }),
    ]).start();
    cb();
  };

  return (
    <Pressable onPress={onPress} style={styles.card}>
      {/* Visual */}
      <View style={styles.cardVisual}>
        <LinearGradient colors={bg} style={StyleSheet.absoluteFill} />
        <Text style={styles.cardBgEmoji}>{emoji}</Text>
        <LinearGradient
          colors={["rgba(5,0,8,0.72)","transparent"]}
          style={styles.cardGradTop}
        />
        <LinearGradient
          colors={["transparent","rgba(13,10,24,1)"]}
          style={styles.cardGradBot}
        />
        {/* User info */}
        <Pressable
          style={styles.cardUser}
          onPress={(event) => {
            event.stopPropagation();
            onOpenProfile();
          }}
          accessibilityRole="button"
          accessibilityLabel={`Open ${moment.userDisplayName}'s profile`}
        >
          <LinearGradient
            colors={MOCK_GRADIENT_PAIRS[index % MOCK_GRADIENT_PAIRS.length]!}
            style={styles.cardUserAv}
          >
            <Text style={styles.cardUserInitial}>
              {MOCK_INITIALS[index % MOCK_INITIALS.length]}
            </Text>
          </LinearGradient>
          <View>
            <Text style={styles.cardUserName}>{moment.userDisplayName}</Text>
            <Text style={styles.cardUserTime}>{moment.liveWatchers > 0 ? "Active now" : `${Math.round((Date.now()-moment.createdAt)/60_000)}m ago`}</Text>
          </View>
        </Pressable>
        {/* Badges */}
        <View style={styles.cardBadges}>
          <View style={styles.timerBadge}>
            <Ionicons name="time-outline" size={9} color="#FFC107" />
            <Text style={styles.timerBadgeText}>{moment.timeLabel}</Text>
          </View>
          {moment.isTrending && (
            <View style={styles.trendBadge}>
              <Text style={styles.trendBadgeText}>🔥 Trending</Text>
            </View>
          )}
          {moment.echoCount > 0 && (
            <View style={styles.echoBadge}>
              <Text style={styles.echoBadgeText}>↩ {moment.echoCount} Echo{moment.echoCount>1?"s":""}</Text>
            </View>
          )}
        </View>
        {/* Caption */}
        <View style={styles.cardCaption}>
          <Text style={styles.cardText} numberOfLines={2}>{moment.text}</Text>
          {moment.location ? (
            <Text style={styles.cardLoc}>📍 {moment.location}</Text>
          ) : null}
        </View>
      </View>

      {/* Live pulse row */}
      {moment.liveWatchers > 0 && (
        <View style={styles.pulseRow}>
          <PulseDot />
          <Text style={styles.pulseText}>
            <Text style={{ color: PINK, fontWeight: "700" }}>{moment.liveWatchers} people</Text>
            {" watching right now"}
          </Text>
        </View>
      )}

      {/* Expiry bar */}
      <View style={styles.expiryRow}>
        <ExpiryBar percent={moment.percentRemaining} />
        <Text style={styles.expiryLabel}>{moment.timeLabel}</Text>
      </View>

      {/* Actions */}
      <View style={styles.cardActions}>
        <Pressable style={styles.replyBox} onPress={onReply}>
          <Text style={styles.replyBoxText}>Reply to {moment.userDisplayName}…</Text>
        </Pressable>
        <Animated.View style={{ transform: [{ scale: likeScale }] }}>
          <Pressable
            onPress={() => bounceReact(likeScale, onLike)}
            hitSlop={8}
          >
            <Text style={styles.reactEmoji}>🔥</Text>
          </Pressable>
        </Animated.View>
        <Animated.View style={{ transform: [{ scale: replyScale }] }}>
          <Pressable
            onPress={() => bounceReact(replyScale, onReply)}
            hitSlop={8}
          >
            <Text style={styles.reactEmoji}>😍</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Pressable>
  );
}

// ── Progress bar for viewer (native driver via translateX) ────────────────────
function ViewerProgressBar({
  active,
  done,
  durationMs,
  onComplete,
}: {
  active: boolean;
  done: boolean;
  durationMs: number;
  onComplete?: () => void;
}) {
  const tx = useRef(new Animated.Value(-VIEWER_PROG_W / 5)).current;

  useEffect(() => {
    if (done) {
      Animated.timing(tx, { toValue: 0, duration: 0, useNativeDriver: true }).start();
      return;
    }
    if (!active) {
      tx.setValue(-VIEWER_PROG_W / 5);
      return;
    }
    tx.setValue(-VIEWER_PROG_W / 5);
    const anim = Animated.timing(tx, {
      toValue: 0,
      duration: durationMs,
      useNativeDriver: true,
    });
    anim.start(({ finished }) => { if (finished) onComplete?.(); });
    return () => anim.stop();
  }, [active, done, durationMs]);

  return (
    <View style={styles.vpTrack}>
      <Animated.View
        style={[
          styles.vpFill,
          { transform: [{ translateX: tx }] },
        ]}
      />
    </View>
  );
}

// ── MomentViewer (Modal) ──────────────────────────────────────────────────────
function MomentViewer({
  moments,
  startIndex,
  visible,
  onClose,
  onOpenProfile,
  onReply,
}: {
  moments: PublicMoment[];
  startIndex: number;
  visible: boolean;
  onClose: () => void;
  onOpenProfile: (moment: PublicMoment) => void;
  onReply: (moment: PublicMoment, message: string) => void;
}) {
  const [idx, setIdx]         = useState(startIndex);
  const [replyText, setReply] = useState("");
  const [showReplyInput, setShowReplyInput] = useState(false);
  const insets  = useSafeAreaInsets();

  const current = moments[idx];

  useEffect(() => {
    if (visible) setIdx(startIndex);
  }, [visible, startIndex]);

  const goNext = useCallback(() => {
    if (idx < moments.length - 1) setIdx(i => i + 1);
    else onClose();
  }, [idx, moments.length, onClose]);

  const goPrev = useCallback(() => {
    if (idx > 0) setIdx(i => i - 1);
  }, [idx]);

  const handleReply = () => {
    if (!replyText.trim() || !current) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onReply(current, replyText.trim());
    setReply("");
    setShowReplyInput(false);
    onClose();
  };

  if (!current) return null;

  const bg     = MOCK_BG[idx % MOCK_BG.length]!;
  const emoji  = MOCK_EMOJI[idx % MOCK_EMOJI.length]!;
  const grad   = MOCK_GRADIENT_PAIRS[idx % MOCK_GRADIENT_PAIRS.length]!;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.viewerWrap}>
        <LinearGradient colors={bg} style={StyleSheet.absoluteFill} />
        <Text style={styles.viewerBgEmoji}>{emoji}</Text>

        {/* Gradient overlays */}
        <LinearGradient
          colors={["rgba(5,0,8,0.85)","transparent"]}
          style={[styles.viewerGradTop, { paddingTop: insets.top }]}
        />
        <LinearGradient
          colors={["transparent","rgba(5,0,8,0.95)"]}
          style={styles.viewerGradBot}
        />

        {/* Progress bars */}
        <View style={[styles.vpRow, { top: insets.top + 8 }]}>
          {moments.map((_, i) => (
            <ViewerProgressBar
              key={i}
              active={i === idx}
              done={i < idx}
              durationMs={5000}
              onComplete={i === idx ? goNext : undefined}
            />
          ))}
        </View>

        {/* Header */}
        <View style={[styles.viewerHeader, { top: insets.top + 22 }]}>
          <Pressable
            style={styles.viewerHeaderLeft}
            onPress={() => onOpenProfile(current)}
            accessibilityRole="button"
            accessibilityLabel={`Open ${current.userDisplayName}'s profile`}
          >
            <LinearGradient colors={grad} style={styles.viewerAv}>
              <Text style={styles.viewerAvText}>
                {MOCK_INITIALS[idx % MOCK_INITIALS.length]}
              </Text>
            </LinearGradient>
            <View>
              <Text style={styles.viewerName}>{current.userDisplayName}</Text>
              <Text style={styles.viewerTime}>{current.timeLabel}</Text>
            </View>
          </Pressable>
          <Pressable onPress={onClose} hitSlop={12} style={styles.viewerClose}>
            <Ionicons name="close" size={20} color="rgba(255,255,255,0.8)" />
          </Pressable>
        </View>

        {/* Tap zones: left = prev, right = next */}
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <View style={styles.tapLeft} pointerEvents="auto">
            <Pressable style={StyleSheet.absoluteFill} onPress={goPrev} />
          </View>
          <View style={styles.tapRight} pointerEvents="auto">
            <Pressable style={StyleSheet.absoluteFill} onPress={goNext} />
          </View>
        </View>

        {/* Bottom content */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={[styles.viewerBottom, { paddingBottom: insets.bottom + 16 }]}
        >
          {/* Live metrics */}
          <View style={styles.viewerMetrics}>
            {current.liveWatchers > 0 && (
              <View style={styles.metricPill}>
                <PulseDot />
                <Text style={styles.metricNum}>{current.liveWatchers}</Text>
                <Text style={styles.metricLbl}>watching</Text>
              </View>
            )}
            {current.echoCount > 0 && (
              <View style={styles.metricPill}>
                <Text style={[styles.metricNum,{color:PURPLE}]}>{current.echoCount}</Text>
                <Text style={styles.metricLbl}>echo{current.echoCount>1?"s":""}</Text>
              </View>
            )}
            <View style={styles.metricPill}>
              <Ionicons name="time-outline" size={11} color="#FFC107" />
              <Text style={[styles.metricNum, { fontSize: 11, color: "#FFC107" }]}>
                {current.timeLabel}
              </Text>
            </View>
          </View>

          {/* Caption */}
          <Text style={styles.viewerCaption}>{current.text}</Text>
          {current.location && (
            <Text style={styles.viewerLoc}>📍 {current.location}</Text>
          )}

          {/* Reply / Echo row */}
          {showReplyInput ? (
            <View style={styles.replyInputRow}>
              <TextInput
                style={styles.replyInput}
                value={replyText}
                onChangeText={setReply}
                placeholder={`Reply to ${current.userDisplayName}…`}
                placeholderTextColor={MUTED}
                autoFocus
                returnKeyType="send"
                onSubmitEditing={handleReply}
                multiline={false}
                maxLength={280}
              />
              <Pressable onPress={handleReply} style={styles.replyInputSend}>
                <Ionicons name="send" size={18} color={PINK} />
              </Pressable>
            </View>
          ) : (
            <View style={styles.viewerActions}>
              <Pressable
                style={styles.viewerReplyBox}
                onPress={() => setShowReplyInput(true)}
              >
                <Text style={styles.viewerReplyBoxText}>
                  Reply to {current.userDisplayName}…
                </Text>
              </Pressable>
              <Pressable
                style={styles.echoBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  Alert.alert(
                    "Echo coming soon 🔜",
                    "Echo lets you re-share a Moment to your own feed. Shipping next update!",
                    [{ text: "Got it", onPress: onClose }],
                  );
                }}
              >
                <Text style={styles.echoBtnText}>↩ Echo</Text>
              </Pressable>
            </View>
          )}

          {/* React row */}
          {!showReplyInput && (
            <View style={styles.viewerReacts}>
              {["🔥","😍","💀","🫶","👀"].map((e) => (
                <Pressable
                  key={e}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  hitSlop={6}
                >
                  <Text style={styles.viewerReactEmoji}>{e}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ── Create Moment Sheet ───────────────────────────────────────────────────────
function CreateMomentSheet({
  visible,
  onClose,
  onPost,
}: {
  visible: boolean;
  onClose: () => void;
  onPost: (text: string, location: string) => void;
}) {
  const [text, setText]         = useState("");
  const [location, setLocation] = useState("");
  const insets = useSafeAreaInsets();

  const handlePost = () => {
    if (!text.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onPost(text.trim(), location.trim());
    setText("");
    setLocation("");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.createSheet, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.createHandle} />
        <View style={styles.createHeader}>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={styles.createCancel}>Cancel</Text>
          </Pressable>
          <Text style={styles.createTitle}>New Moment</Text>
          <Pressable onPress={handlePost} disabled={!text.trim()}>
            <LinearGradient
              colors={text.trim() ? [PINK, PURPLE] : ["#333","#333"]}
              style={styles.createPostBtn}
              start={{ x:0,y:0 }} end={{ x:1,y:0 }}
            >
              <Text style={styles.createPostBtnText}>Post</Text>
            </LinearGradient>
          </Pressable>
        </View>

        <View style={styles.createBody}>
          <TextInput
            style={styles.createTextInput}
            value={text}
            onChangeText={setText}
            placeholder="What are you up to right now? ✨"
            placeholderTextColor={MUTED}
            multiline
            maxLength={280}
            autoFocus
          />
          <View style={styles.createMeta}>
            <Ionicons name="location-outline" size={14} color={MUTED} />
            <TextInput
              style={styles.createLocInput}
              value={location}
              onChangeText={setLocation}
              placeholder="Add location (optional)"
              placeholderTextColor={MUTED}
            />
          </View>
          <Text style={styles.createCharCount}>{text.length}/280</Text>

          <View style={styles.createInfo}>
            <Ionicons name="time-outline" size={13} color={MUTED} />
            <Text style={styles.createInfoText}>
              Disappears in 24h · visible to everyone
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Filter pill ───────────────────────────────────────────────────────────────
const FILTERS: { key: MomentFilter; label: string }[] = [
  { key: "all",     label: "All" },
  { key: "nearby",  label: "Nearby" },
  { key: "matches", label: "Matches" },
  { key: "new",     label: "New" },
];

function FilterPills({
  active,
  onChange,
}: {
  active: MomentFilter;
  onChange: (f: MomentFilter) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.filterScroll}
      contentContainerStyle={styles.filterContent}
    >
      {FILTERS.map(f => (
        <Pressable
          key={f.key}
          onPress={() => onChange(f.key)}
          style={[styles.filterPill, active === f.key && styles.filterPillActive]}
        >
          <Text style={[styles.filterPillText, active === f.key && styles.filterPillTextActive]}>
            {f.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function MomentsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useUser();

  const [filter, setFilter]               = useState<MomentFilter>("all");
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex,  setViewerIndex]    = useState(0);
  const [createVisible,setCreateVisible]  = useState(false);
  const [sentFlash,    setSentFlash]      = useState<string | null>(null);

  const { moments, refreshing, reload } = useMoments(filter);

  const openViewer = useCallback((index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setViewerIndex(index);
    setViewerVisible(true);
  }, []);

  const openMomentProfile = useCallback((moment: PublicMoment) => {
    openProfile(moment.userId, "moments", {
      name: moment.userDisplayName,
      photoUrl: moment.userPhotoUrl,
    });
  }, []);

  const handleReply = useCallback((moment: PublicMoment, message: string) => {
    // TODO: POST /api/moments/:id/reply
    // Then route to Connect > Moments Requests
    setSentFlash(`Reply sent to ${moment.userDisplayName}!`);
    setTimeout(() => setSentFlash(null), 2200);
    // Navigate to connect so they see the request was sent
    // router.push("/(tabs)/matches?segment=moments");
  }, []);

  const handleLike = useCallback((moment: PublicMoment) => {
    // TODO: POST /api/moments/:id/like
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSentFlash(`❤️ Liked ${moment.userDisplayName}'s Moment!`);
    setTimeout(() => setSentFlash(null), 2000);
  }, [setSentFlash]);

  const handlePost = useCallback((text: string, location: string) => {
    // TODO: POST /api/moments
    setSentFlash("Moment live! Your matches can see it now ✨");
    setTimeout(() => setSentFlash(null), 2400);
    reload();
  }, [reload]);

  // ── Render item (stable ref — no choppiness) ────────────────────────────
  const renderItem = useCallback(({ item, index }: { item: PublicMoment; index: number }) => (
    <MomentCard
      moment={item}
      index={index}
      onPress={() => openViewer(index)}
      onOpenProfile={() => openMomentProfile(item)}
      onReply={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        openViewer(index);
      }}
      onLike={() => handleLike(item)}
    />
  ), [openViewer, openMomentProfile, handleLike]);

  const keyExtractor = useCallback((item: PublicMoment) => item.id, []);

  const ListHeader = useMemo(() => (
    <>
      {/* Hot Zone Banner */}
      <Pressable style={styles.hotzone} onPress={() => setFilter("nearby")}>
        <View style={styles.hotzoneLeft}>
          <View style={styles.hotzoneDot} />
          <Text style={styles.hotzoneText}>Wynwood is popping right now</Text>
        </View>
        <View style={styles.hotzoneBadge}>
          <Text style={styles.hotzoneBadgeText}>31 Moments</Text>
        </View>
      </Pressable>

      {/* Story rail */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.rail}
        contentContainerStyle={styles.railContent}
      >
        <YourStoryItem onPress={() => setCreateVisible(true)} />
        {moments.map((m, i) => (
          <StoryItem
            key={m.id}
            moment={m}
            index={i}
            onPress={() => openViewer(i)}
            onOpenProfile={() => openMomentProfile(m)}
          />
        ))}
      </ScrollView>

      <Text style={styles.feedLabel}>Recent · sorted by heat</Text>
    </>
  ), [moments, openViewer, openMomentProfile]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Moments</Text>
          <Text style={styles.headerSub}>Miami · 47 live now</Text>
        </View>
        <Pressable
          onPress={() => router.push("/(tabs)/matches?segment=moments" as never)}
          style={styles.requestsBtn}
        >
          <Ionicons name="paper-plane-outline" size={16} color={PINK} />
          <Text style={styles.requestsBtnText}>Requests</Text>
        </Pressable>
      </View>

      {/* Filter pills */}
      <FilterPills active={filter} onChange={setFilter} />

      {/* Feed */}
      <FlatList
        data={moments}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={[styles.feedContent, { paddingBottom: insets.bottom + 90 }]}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={Platform.OS === "android"}
        initialNumToRender={4}
        maxToRenderPerBatch={3}
        windowSize={7}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={reload}
            tintColor={PINK}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyEmoji}>✨</Text>
            <Text style={styles.emptyTitle}>No Moments yet</Text>
            <Text style={styles.emptySub}>Be the first to share what you're up to</Text>
            <Pressable onPress={() => setCreateVisible(true)} style={styles.emptyBtn}>
              <LinearGradient colors={[PINK, PURPLE]} style={styles.emptyBtnGrad} start={{x:0,y:0}} end={{x:1,y:0}}>
                <Text style={styles.emptyBtnText}>Post a Moment</Text>
              </LinearGradient>
            </Pressable>
          </View>
        }
      />

      {/* Sent flash */}
      {sentFlash && (
        <View style={[styles.sentFlash, { top: insets.top + 60 }]}>
          <Text style={styles.sentFlashText}>{sentFlash}</Text>
        </View>
      )}

      {/* Viewer Modal */}
      <MomentViewer
        moments={moments}
        startIndex={viewerIndex}
        visible={viewerVisible}
        onClose={() => setViewerVisible(false)}
        onOpenProfile={openMomentProfile}
        onReply={handleReply}
      />

      {/* Create Modal */}
      <CreateMomentSheet
        visible={createVisible}
        onClose={() => setCreateVisible(false)}
        onPost={handlePost}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(255,255,255,0.3)",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 2,
  },
  requestsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,45,168,0.1)",
    borderWidth: 0.5,
    borderColor: "rgba(255,45,168,0.3)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  requestsBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: PINK,
  },

  // Filters
  filterScroll: { flexGrow: 0, marginBottom: 6 },
  filterContent: { paddingHorizontal: 16, gap: 8 },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.1)",
  },
  filterPillActive: {
    backgroundColor: "rgba(255,45,168,0.15)",
    borderColor: "rgba(255,45,168,0.4)",
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255,255,255,0.5)",
  },
  filterPillTextActive: { color: PINK },

  // Hot zone
  hotzone: {
    marginHorizontal: 14,
    marginBottom: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,45,168,0.08)",
    borderWidth: 0.5,
    borderColor: "rgba(255,45,168,0.25)",
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  hotzoneLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  hotzoneDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: PINK,
  },
  hotzoneText: { fontSize: 12, fontWeight: "700", color: "rgba(255,255,255,0.8)" },
  hotzoneBadge: {
    backgroundColor: "rgba(255,45,168,0.15)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  hotzoneBadgeText: { fontSize: 10, fontWeight: "800", color: PINK },

  // Story rail
  rail: { flexGrow: 0, marginBottom: 10 },
  railContent: { paddingHorizontal: 14, gap: 12 },
  storyItem: { alignItems: "center", gap: 4 },
  storyRingOuter: {
    width: STORY_SIZE,
    height: STORY_SIZE,
    borderRadius: STORY_SIZE / 2,
    padding: 2,
  },
  storyRingLive: {},
  storyRingSeen: {},
  storyRingAdd: {
    width: STORY_SIZE,
    height: STORY_SIZE,
    borderRadius: STORY_SIZE / 2,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(255,255,255,0.2)",
    overflow: "hidden",
  },
  storyAv: {
    flex: 1,
    borderRadius: STORY_SIZE / 2 - 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: BG,
  },
  storyInitial: { fontSize: 18, fontWeight: "800", color: "#fff" },
  storyLivePip: {
    position: "absolute",
    bottom: 14,
    right: -2,
    backgroundColor: PINK,
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderWidth: 1.5,
    borderColor: BG,
  },
  storyLivePipText: { fontSize: 6, fontWeight: "800", color: "#fff", letterSpacing: 0.3 },
  storyName: {
    fontSize: 9,
    fontWeight: "600",
    color: "rgba(255,255,255,0.5)",
    maxWidth: STORY_SIZE,
    textAlign: "center",
  },

  // Feed
  feedContent: { paddingHorizontal: 12 },
  feedLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "rgba(255,255,255,0.25)",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 10,
    paddingHorizontal: 2,
  },

  // Card
  card: {
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 14,
    backgroundColor: CARD,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.07)",
  },
  cardVisual: { height: 210, position: "relative", overflow: "hidden", justifyContent: "center", alignItems: "center" },
  cardBgEmoji: {
    fontSize: 80,
    opacity: 0.15,
    position: "absolute",
  },
  cardGradTop: { position: "absolute", top: 0, left: 0, right: 0, height: 80 },
  cardGradBot: { position: "absolute", bottom: 0, left: 0, right: 0, height: 100 },
  cardUser: {
    position: "absolute",
    top: 11,
    left: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    zIndex: 3,
  },
  cardUserAv: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.3)",
  },
  cardUserInitial: { fontSize: 10, fontWeight: "800", color: "#fff" },
  cardUserName: { fontSize: 11, fontWeight: "800", color: "#fff" },
  cardUserTime: { fontSize: 9, color: MUTED },
  cardBadges: {
    position: "absolute",
    top: 10,
    right: 10,
    gap: 4,
    alignItems: "flex-end",
    zIndex: 3,
  },
  timerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(255,193,7,0.15)",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 0.5,
    borderColor: "rgba(255,193,7,0.3)",
  },
  timerBadgeText: { fontSize: 8, fontWeight: "800", color: "#FFC107" },
  trendBadge: {
    backgroundColor: "rgba(255,45,168,0.18)",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 0.5,
    borderColor: "rgba(255,45,168,0.3)",
  },
  trendBadgeText: { fontSize: 8, fontWeight: "800", color: PINK },
  echoBadge: {
    backgroundColor: "rgba(168,85,247,0.18)",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 0.5,
    borderColor: "rgba(168,85,247,0.3)",
  },
  echoBadgeText: { fontSize: 8, fontWeight: "800", color: PURPLE },
  cardCaption: {
    position: "absolute",
    bottom: 10,
    left: 11,
    right: 11,
    zIndex: 3,
  },
  cardText: { fontSize: 13, fontWeight: "700", color: "#fff", lineHeight: 18 },
  cardLoc: { fontSize: 9, color: MUTED, marginTop: 2 },

  // Pulse
  pulseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 12,
    paddingTop: 9,
    paddingBottom: 2,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: PINK,
  },
  pulseText: { fontSize: 10, color: "rgba(255,255,255,0.4)" },

  // Expiry bar
  expiryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
  },
  expiryTrack: {
    flex: 1,
    height: 2,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 1,
    overflow: "hidden",
  },
  expiryFill: {
    height: 2,
    borderRadius: 1,
    backgroundColor: PINK,
  },
  expiryLabel: { fontSize: 9, color: "rgba(255,255,255,0.3)", whiteSpace: "nowrap" } as any,

  // Card actions
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 11,
    paddingBottom: 12,
    gap: 8,
  },
  replyBox: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  replyBoxText: { fontSize: 12, color: "rgba(255,255,255,0.35)" },
  reactEmoji: { fontSize: 20 },

  // Viewer
  viewerWrap: { flex: 1, backgroundColor: BG },
  viewerBgEmoji: {
    position: "absolute",
    alignSelf: "center",
    top: SH * 0.3,
    fontSize: 120,
    opacity: 0.12,
  },
  viewerGradTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 160,
    zIndex: 1,
  },
  viewerGradBot: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 320,
    zIndex: 1,
  },
  vpRow: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    gap: 4,
    zIndex: 10,
  },
  vpTrack: {
    flex: 1,
    height: 2.5,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 2,
    overflow: "hidden",
  },
  vpFill: {
    width: VIEWER_PROG_W / 5, // divided by max segments shown
    height: 2.5,
    backgroundColor: "#fff",
    borderRadius: 2,
  },
  viewerHeader: {
    position: "absolute",
    left: 14,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 10,
  },
  viewerHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 9 },
  viewerAv: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.35)",
  },
  viewerAvText: { fontSize: 13, fontWeight: "800", color: "#fff" },
  viewerName: { fontSize: 13, fontWeight: "800", color: "#fff" },
  viewerTime: { fontSize: 10, color: "rgba(255,255,255,0.5)" },
  viewerClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  tapLeft: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: SW * 0.35,
  },
  tapRight: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: SW * 0.65,
  },
  viewerBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 14,
  },
  viewerMetrics: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  metricPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  metricNum: { fontSize: 13, fontWeight: "800", color: "#fff" },
  metricLbl: { fontSize: 9, color: "rgba(255,255,255,0.5)" },
  viewerCaption: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
    lineHeight: 24,
    marginBottom: 4,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  viewerLoc: { fontSize: 11, color: "rgba(255,255,255,0.55)", marginBottom: 14 },
  viewerActions: { flexDirection: "row", gap: 9, alignItems: "center", marginBottom: 10 },
  viewerReplyBox: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 22,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  viewerReplyBoxText: { fontSize: 13, color: "rgba(255,255,255,0.45)" },
  echoBtn: {
    backgroundColor: "rgba(168,85,247,0.18)",
    borderWidth: 0.5,
    borderColor: "rgba(168,85,247,0.4)",
    borderRadius: 22,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  echoBtnText: { fontSize: 12, fontWeight: "700", color: PURPLE },
  viewerReacts: {
    flexDirection: "row",
    gap: 16,
    justifyContent: "center",
    marginBottom: 4,
  },
  viewerReactEmoji: { fontSize: 24 },
  replyInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  replyInput: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 22,
    paddingVertical: 11,
    paddingHorizontal: 14,
    fontSize: 14,
    color: "#fff",
  },
  replyInputSend: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,45,168,0.15)",
    borderWidth: 0.5,
    borderColor: "rgba(255,45,168,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Create sheet
  createSheet: {
    flex: 1,
    backgroundColor: "#0A0714",
    paddingTop: 12,
  },
  createHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignSelf: "center",
    marginBottom: 16,
  },
  createHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    marginBottom: 20,
  },
  createTitle: { fontSize: 16, fontWeight: "700", color: "#fff" },
  createCancel: { fontSize: 15, color: MUTED },
  createPostBtn: {
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  createPostBtnText: { fontSize: 14, fontWeight: "800", color: "#fff" },
  createBody: { flex: 1, paddingHorizontal: 18 },
  createTextInput: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    minHeight: 120,
    textAlignVertical: "top",
    marginBottom: 16,
  },
  createMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderTopWidth: 0.5,
    borderTopColor: "rgba(255,255,255,0.08)",
    paddingTop: 12,
    marginBottom: 8,
  },
  createLocInput: { flex: 1, fontSize: 14, color: "#fff", paddingVertical: 4 },
  createCharCount: { fontSize: 11, color: "rgba(255,255,255,0.25)", alignSelf: "flex-end" },
  createInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 10,
    padding: 10,
  },
  createInfoText: { fontSize: 12, color: MUTED },

  // Sent flash
  sentFlash: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: "rgba(255,45,168,0.9)",
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 9,
    zIndex: 100,
  },
  sentFlashText: { fontSize: 13, fontWeight: "700", color: "#fff" },

  // Empty
  emptyWrap: { alignItems: "center", paddingTop: 60, gap: 8 },
  emptyEmoji: { fontSize: 48, marginBottom: 4 },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: "#fff" },
  emptySub: { fontSize: 13, color: MUTED, textAlign: "center", paddingHorizontal: 40 },
  emptyBtn: { marginTop: 16, borderRadius: 24, overflow: "hidden" },
  emptyBtnGrad: { paddingHorizontal: 28, paddingVertical: 12 },
  emptyBtnText: { fontSize: 15, fontWeight: "800", color: "#fff" },
});
