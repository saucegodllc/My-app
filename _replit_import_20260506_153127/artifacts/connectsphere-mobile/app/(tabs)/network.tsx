import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useState, useRef, useEffect } from "react";
import {
  Animated,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Dimensions,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";

import { useColors } from "@/hooks/useColors";
import {
  useGetNetworkDirectory,
  useGetNetworkConnections,
  useSendNetworkRequest,
  useRespondNetworkRequest,
  useCreateNetworkChatMatch,
  getGetNetworkDirectoryQueryKey,
  getGetNetworkConnectionsQueryKey,
} from "@workspace/api-client-react";
import type { NetworkProfile, NetworkConnection } from "@workspace/api-client-react";

const PINK = "#FF299B";
const { width: SW } = Dimensions.get("window");

const INTENT_TABS = [
  { id: "network", label: "Network", icon: "globe-outline" as const },
  { id: "build",   label: "Build",   icon: "hammer-outline" as const },
  { id: "hire",    label: "Hire",    icon: "briefcase-outline" as const },
  { id: "learn",   label: "Learn",   icon: "book-outline" as const },
  { id: "chill",   label: "Chill",   icon: "cafe-outline" as const },
];

const INTENT_COLORS: Record<string, string> = {
  network: "#FF299B",
  build:   "#60A5FA",
  hire:    "#34D399",
  learn:   "#FBBF24",
  chill:   "#A78BFA",
};

const NEAR_YOU_MOCK = [
  { id: "n1", initials: "SK", name: "Sarah K.",   distance: "0.2 mi", headline: "Looking for UI/UX Designer", active: true  },
  { id: "n2", initials: "MD", name: "Mike D.",    distance: "0.3 mi", headline: "Let's build something cool",  active: true  },
  { id: "n3", initials: "LM", name: "Leila M.",   distance: "0.4 mi", headline: "Investor looking for founders", active: false },
  { id: "n4", initials: "JW", name: "James W.",   distance: "0.8 mi", headline: "Gym partner in Brickell",    active: true  },
];

const HOT_CONNECTIONS = [
  { id: "h1", initials: "SK", name: "Sarah K.",  distance: "0.2 mi" },
  { id: "h2", initials: "MD", name: "Mike D.",   distance: "0.3 mi" },
  { id: "h3", initials: "LM", name: "Leila M.",  distance: "0.4 mi" },
  { id: "h4", initials: "CT", name: "Chris T.",  distance: "0.5 mi" },
  { id: "h5", initials: "AR", name: "Ava R.",    distance: "0.6 mi" },
  { id: "h6", initials: "DB", name: "Daniel B.", distance: "0.7 mi" },
];

const LIVE_ROOMS = [
  { id: "r1", name: "Startup Founders Room", count: 14, color: PINK },
  { id: "r2", name: "Designers Connect",     count: 8,  color: "#60A5FA" },
  { id: "r3", name: "Investors Hangout",     count: 21, color: "#34D399" },
  { id: "r4", name: "AI Builders",           count: 11, color: "#FBBF24" },
];

function Initials({ text, color, size = 44 }: { text: string; color?: string; size?: number }) {
  const bg = color ?? PINK;
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: bg + "33",
      borderWidth: 1.5, borderColor: bg + "55",
      alignItems: "center", justifyContent: "center",
    }}>
      <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: size * 0.33 }}>{text}</Text>
    </View>
  );
}

function ActiveDot() {
  return <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#4ADE80" }} />;
}

// ─── Open Door Modal ──────────────────────────────────────────────────────────
function OpenDoorModal({
  person,
  visible,
  onClose,
}: {
  person: { name: string; intentLabel?: string } | null;
  visible: boolean;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const firstName = person?.name.split(" ")[0] ?? "";
  const msg = `Hey ${firstName}! I love what you're building. I've worked on similar things and would love to connect and see how we can build something great together.`;

  function handleSend() {
    setSent(true);
    setTimeout(() => { setSent(false); setNote(""); onClose(); }, 1400);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={s.modalSheet}>
          <View style={s.modalHandle} />

          <View style={s.modalHeader}>
            <View>
              <Text style={s.modalTitle}>Open Door</Text>
              <Text style={s.modalSub}>Send a smart introduction that gets replies.</Text>
            </View>
            <Pressable onPress={onClose} style={s.modalClose}>
              <Ionicons name="close" size={20} color="#71717a" />
            </Pressable>
          </View>

          <View style={s.msgBubble}>
            <Ionicons name="sparkles" size={13} color={PINK} style={{ position: "absolute", top: 10, right: 10 }} />
            <Text style={s.msgText}>{msg}</Text>
          </View>

          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Add a personal note (optional)"
            placeholderTextColor="#52525b"
            maxLength={100}
            multiline
            style={s.noteInput}
          />
          <Text style={s.charCount}>{note.length}/100</Text>

          {sent ? (
            <View style={[s.sendBtn, { backgroundColor: "#4ADE8022", borderWidth: 1, borderColor: "#4ADE8044" }]}>
              <Ionicons name="checkmark-circle" size={16} color="#4ADE80" />
              <Text style={[s.sendBtnText, { color: "#4ADE80" }]}>Message sent!</Text>
            </View>
          ) : (
            <Pressable onPress={handleSend} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}>
              <LinearGradient colors={[PINK, "#a855f7"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.sendBtn}>
                <Ionicons name="flash" size={16} color="#fff" />
                <Text style={s.sendBtnText}>Open Door & Connect</Text>
              </LinearGradient>
            </Pressable>
          )}
          <Text style={s.sendNote}>This message will be sent instantly.</Text>

          <View style={s.recentDoors}>
            <Text style={s.recentDoorsLabel}>Recent Open Doors</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ flexDirection: "row" }}>
                {["AC","JL","MW","SM","PR"].map((i, idx) => (
                  <View key={i} style={{ marginLeft: idx === 0 ? 0 : -6 }}>
                    <Initials text={i} color={PINK} size={22} />
                  </View>
                ))}
              </View>
              <Text style={{ color: "#52525b", fontSize: 11 }}>+8 this week</Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Profile Drawer ───────────────────────────────────────────────────────────
const SCREEN_H = Dimensions.get("window").height;

function ProfileDrawer({
  person,
  visible,
  onClose,
  onOpenDoor,
}: {
  person: NetworkProfile | null;
  visible: boolean;
  onClose: () => void;
  onOpenDoor: () => void;
}) {
  const translateY  = useRef(new Animated.Value(SCREEN_H)).current;
  const backdropOp  = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);
  const personSnap  = useRef<NetworkProfile | null>(null);
  if (person) personSnap.current = person;

  useEffect(() => {
    if (visible && person) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(translateY, { toValue: 0,        duration: 340, useNativeDriver: true }),
        Animated.timing(backdropOp, { toValue: 1,        duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: SCREEN_H, duration: 300, useNativeDriver: true }),
        Animated.timing(backdropOp, { toValue: 0,        duration: 220, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  if (!mounted) return null;

  const snap = personSnap.current!;
  const initials = (snap.displayName ?? "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 99 }]} pointerEvents="box-none">
      {/* Dimmed backdrop */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.72)", opacity: backdropOp }]}
        pointerEvents={visible ? "auto" : "none"}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Sliding sheet */}
      <Animated.View
        style={[s.drawerSheet, { position: "absolute", left: 0, right: 0, bottom: 0,
          transform: [{ translateY }] }]}
        pointerEvents="auto"
      >
        {/* ── Full-bleed hero photo ── */}
        <View style={s.drawerHero}>
          {snap.photos?.[0] ? (
            <>
              <Image source={{ uri: snap.photos[0] }} style={StyleSheet.absoluteFill} contentFit="cover" />
              <LinearGradient
                colors={["transparent", "rgba(9,9,11,0.6)", "#09090b"]}
                locations={[0.3, 0.7, 1]}
                style={StyleSheet.absoluteFill}
              />
            </>
          ) : (
            <LinearGradient colors={[PINK + "88", "#09090b"]} start={{ x: 0.2, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}>
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <Initials text={initials} color={PINK} size={80} />
              </View>
            </LinearGradient>
          )}
          {/* Back button overlay */}
          <Pressable style={s.drawerBackBtn} onPress={onClose}
            hitSlop={12} android_ripple={{ color: "#ffffff22", radius: 20, borderless: true }}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </Pressable>
        </View>

        {/* ── Identity row ── */}
        <View style={s.drawerIdentity}>
          <View style={{ position: "relative" }}>
            {snap.photos?.[0] ? (
              <Image source={{ uri: snap.photos[0] }} style={s.drawerAvatarImg} contentFit="cover" />
            ) : (
              <View style={s.drawerAvatarImg}>
                <Initials text={initials} color={PINK} size={52} />
              </View>
            )}
            <View style={s.drawerAvatarDot} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 3 }}>
              <Text style={s.drawerName}>{snap.displayName}</Text>
              {snap.isVerified && <Ionicons name="checkmark-circle" size={15} color={PINK} />}
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
              <Ionicons name="location-outline" size={12} color="#71717a" />
              <Text style={s.drawerLocation}>{snap.location ?? "Miami, FL"}</Text>
              <Text style={{ color: "#52525b", fontSize: 11 }}>·</Text>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#4ADE80" }} />
              <Text style={s.drawerActiveText}>Active now</Text>
            </View>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 36 }} showsVerticalScrollIndicator={false}>

          {/* ── Action row ── */}
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 22 }}>
            <Pressable onPress={() => { onClose(); setTimeout(onOpenDoor, 320); }}
              style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.82 : 1 }]}>
              <LinearGradient colors={[PINK, "#a855f7"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={s.drawerOpenDoor}>
                <Ionicons name="flash" size={16} color="#fff" />
                <Text style={s.drawerOpenDoorText}>Open Door</Text>
              </LinearGradient>
            </Pressable>
            <Pressable style={({ pressed }) => [s.drawerShareBtn, { opacity: pressed ? 0.75 : 1 }]}>
              <Ionicons name="paper-plane-outline" size={20} color="#a1a1aa" />
            </Pressable>
          </View>

          {/* ── Three info sections ── */}
          {[
            { icon: "hammer-outline"           as const, color: "#60A5FA", label: "What I'm Building", value: snap.bio },
            { icon: "rocket-outline"            as const, color: PINK,      label: "What I Need",       value: snap.networkingGoals as string | undefined },
            { icon: "shield-checkmark-outline"  as const, color: "#4ADE80", label: "What I Offer",      value: snap.profession ?? snap.role },
          ].filter(r => r.value).map(row => (
            <View key={row.label} style={s.drawerInfoCard}>
              <View style={s.drawerInfoRow}>
                <View style={[s.drawerInfoIcon, { backgroundColor: row.color + "18" }]}>
                  <Ionicons name={row.icon} size={15} color={row.color} />
                </View>
                <Text style={[s.drawerInfoLabel, { color: row.color }]}>{row.label}</Text>
              </View>
              <Text style={s.drawerInfoValue}>{row.value}</Text>
            </View>
          ))}

          {/* ── Skills ── */}
          {snap.interests && (snap.interests as string[]).length > 0 && (
            <View style={{ marginBottom: 22 }}>
              <Text style={s.drawerSectionTitle}>Skills</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
                {(snap.interests as string[]).map(skill => (
                  <View key={skill} style={[s.skillChip, { borderColor: PINK + "44" }]}>
                    <Text style={s.skillChipText}>{skill}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── Socials ── */}
          <View>
            <Text style={s.drawerSectionTitle}>Socials</Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              {[
                { name: "logo-linkedin"   as const, color: "#60A5FA" },
                { name: "logo-twitter"    as const, color: "#e2e8f0" },
                { name: "logo-instagram"  as const, color: PINK },
                { name: "globe-outline"   as const, color: "#a1a1aa" },
              ].map(s2 => (
                <View key={s2.name} style={[s.socialBtn, { width: 44, height: 44, borderRadius: 12, backgroundColor: s2.color + "15", borderColor: s2.color + "30" }]}>
                  <Ionicons name={s2.name} size={20} color={s2.color} />
                </View>
              ))}
            </View>
          </View>

        </ScrollView>
      </Animated.View>
    </View>
  );
}

// ─── Opportunity Card ─────────────────────────────────────────────────────────
function OppCard({
  profile,
  status,
  onConnect,
  onMessage,
  onOpenDoor,
  onViewProfile,
  connectLoading,
}: {
  profile: NetworkProfile;
  status: "none" | "pending" | "accepted";
  onConnect: () => void;
  onMessage: () => void;
  onOpenDoor: () => void;
  onViewProfile: () => void;
  connectLoading: boolean;
}) {
  const [saved, setSaved] = useState(false);
  const initials = (profile.displayName ?? "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const photo = profile.photos?.[0];
  const intentColor = PINK;
  const interested = Math.floor(Math.random() * 20) + 4;

  return (
    <View style={s.card}>
      {/* Top row — tap avatar or name to open profile */}
      <View style={s.cardTop}>
        <Pressable
          onPress={onViewProfile}
          style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}
        >
          <View style={{ position: "relative" }}>
            {photo ? (
              <Image source={{ uri: photo }} style={s.cardAvatar} contentFit="cover" />
            ) : (
              <Initials text={initials} color={intentColor} size={44} />
            )}
            <View style={s.activeDot} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={s.cardName} numberOfLines={1}>{profile.displayName}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                <ActiveDot />
                <Text style={s.activeText}>Active now</Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
              <Ionicons name="location-outline" size={11} color="#52525b" />
              <Text style={s.cardLocation} numberOfLines={1}>
                {profile.location ?? "Miami, FL"}
              </Text>
            </View>
          </View>
        </Pressable>
        <Pressable onPress={() => setSaved(v => !v)} hitSlop={8}>
          <Ionicons name={saved ? "bookmark" : "bookmark-outline"} size={18} color={saved ? PINK : "#52525b"} />
        </Pressable>
      </View>

      {/* Intent badge */}
      <View style={[s.intentBadge, { backgroundColor: intentColor + "18", borderColor: intentColor + "33" }]}>
        <View style={[s.intentDot, { backgroundColor: intentColor }]} />
        <Text style={[s.intentText, { color: intentColor }]}>LOOKING FOR</Text>
      </View>

      {/* Headline */}
      <Text style={s.cardHeadline}>
        {profile.role ? `${profile.role} opportunity 🚀` : (profile.profession ?? "New opportunity 🚀")}
      </Text>

      {/* Bio */}
      {profile.bio ? (
        <Text style={s.cardBio} numberOfLines={2}>{profile.bio}</Text>
      ) : null}

      {/* Skills */}
      {profile.interests && profile.interests.length > 0 && (
        <View style={s.skillsRow}>
          {(profile.interests as string[]).slice(0, 3).map(skill => (
            <View key={skill} style={s.skillChip}>
              <Text style={s.skillChipText}>{skill}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Interested count */}
      <View style={s.interestedRow}>
        <View style={{ flexDirection: "row" }}>
          {[0, 1, 2].map(i => (
            <View key={i} style={[s.microAvatar, { marginLeft: i === 0 ? 0 : -5 }]}>
              <Text style={{ color: "#a1a1aa", fontSize: 7, fontFamily: "Inter_700Bold" }}>
                {String.fromCharCode(65 + i)}
              </Text>
            </View>
          ))}
        </View>
        <Text style={s.interestedText}>{interested} interested</Text>
      </View>

      {/* Actions */}
      <View style={s.cardActions}>
        <Pressable onPress={e => { onOpenDoor(); }} style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.85 : 1 }]}>
          <LinearGradient colors={[PINK, "#a855f7"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.openDoorBtn}>
            <Ionicons name="flash" size={14} color="#fff" />
            <Text style={s.openDoorText}>Open Door</Text>
          </LinearGradient>
        </Pressable>

        {status === "accepted" ? (
          <Pressable onPress={onMessage} style={s.secondaryBtn}>
            <Ionicons name="chatbubble-outline" size={14} color="#a1a1aa" />
            <Text style={s.secondaryBtnText}>Message</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={onConnect}
            disabled={connectLoading || status === "pending"}
            style={[s.secondaryBtn, status === "pending" && { borderColor: "#52525b" }]}
          >
            <Text style={[s.secondaryBtnText, status === "pending" && { color: "#52525b" }]}>
              {status === "pending" ? "Pending" : "Join"}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ─── People Near You ──────────────────────────────────────────────────────────
function PeopleNearYou() {
  return (
    <View style={s.section}>
      <View style={s.sectionHeaderRow}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Ionicons name="location" size={15} color={PINK} />
          <Text style={s.sectionTitle}>People Near You</Text>
          <Text style={s.sectionSub}>Miami, FL</Text>
        </View>
        <Pressable style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
          <Text style={[s.seeAll, { color: PINK }]}>Map</Text>
          <Ionicons name="chevron-forward" size={13} color={PINK} />
        </Pressable>
      </View>

      {NEAR_YOU_MOCK.map(p => (
        <View key={p.id} style={s.nearbyCard}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
            <View style={{ position: "relative" }}>
              <Initials text={p.initials} color={PINK} size={38} />
              {p.active && (
                <View style={[s.activeDot, { bottom: -1, right: -1 }]} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={s.nearbyName}>{p.name}</Text>
                {p.active && <ActiveDot />}
              </View>
              <Text style={s.nearbyHeadline} numberOfLines={1}>
                <Ionicons name="location-outline" size={10} color="#52525b" /> {p.distance} · {p.headline}
              </Text>
            </View>
          </View>
          <Pressable style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}>
            <LinearGradient colors={[PINK, "#a855f7"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.connectBtn}>
              <Text style={s.connectBtnText}>Connect</Text>
            </LinearGradient>
          </Pressable>
        </View>
      ))}

      <Pressable style={s.seeMoreBtn}>
        <Text style={s.seeMoreText}>See more people nearby</Text>
        <Ionicons name="chevron-forward" size={14} color="#71717a" />
      </Pressable>
    </View>
  );
}

// ─── Live Rooms ───────────────────────────────────────────────────────────────
function LiveRooms() {
  return (
    <View style={s.section}>
      <View style={s.sectionHeaderRow}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name="radio" size={15} color={PINK} />
          <Text style={s.sectionTitle}>Live Rooms</Text>
          <View style={[s.liveBadge]}>
            <Text style={s.liveBadgeText}>LIVE</Text>
          </View>
        </View>
        <Text style={[s.seeAll, { color: PINK }]}>Join Instantly</Text>
      </View>

      {LIVE_ROOMS.map(room => (
        <View key={room.id} style={s.liveCard}>
          <View style={[s.liveIcon, { backgroundColor: room.color + "18", borderColor: room.color + "33" }]}>
            <Ionicons name="mic" size={18} color={room.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.liveRoomName}>{room.name}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
              <View style={{ flexDirection: "row" }}>
                {[0, 1, 2].map(i => (
                  <View key={i} style={[s.microAvatar, { marginLeft: i === 0 ? 0 : -5 }]} />
                ))}
              </View>
              <Text style={s.liveCount}>{room.count} in room</Text>
            </View>
          </View>
          <Pressable style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}>
            <LinearGradient colors={[room.color + "cc", room.color + "88"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.joinBtn}>
              <Text style={s.joinBtnText}>Join</Text>
            </LinearGradient>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

// ─── Hot Connections ──────────────────────────────────────────────────────────
function HotConnections() {
  return (
    <View style={[s.section, { paddingBottom: 8 }]}>
      <View style={s.sectionHeaderRow}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Ionicons name="flame" size={15} color="#f97316" />
          <Text style={s.sectionTitle}>Hot Connections Near You</Text>
        </View>
        <Ionicons name="chevron-forward" size={15} color="#52525b" />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingBottom: 4 }}>
        {HOT_CONNECTIONS.map(p => (
          <Pressable key={p.id} style={{ alignItems: "center", gap: 4 }}>
            <View style={{ position: "relative" }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: PINK + "22", borderWidth: 1.5, borderColor: PINK + "33", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 }}>{p.initials}</Text>
              </View>
              <View style={{ position: "absolute", bottom: -2, right: -2, backgroundColor: "#18181b", borderRadius: 8, paddingHorizontal: 3, paddingVertical: 1, borderWidth: 1, borderColor: "#27272a" }}>
                <Text style={{ color: "#a1a1aa", fontSize: 8, fontFamily: "Inter_600SemiBold" }}>{p.distance}</Text>
              </View>
            </View>
            <Text style={{ color: "#d4d4d8", fontSize: 10, fontFamily: "Inter_500Medium", width: 52, textAlign: "center" }} numberOfLines={1}>{p.name}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function NetworkFooter() {
  return (
    <View style={s.footer}>
      <View style={s.footerRow}>
        {[
          { icon: "flash", label: "OPPORTUNITIES", sub: "Find you." },
          { icon: "people", label: "CONNECTIONS", sub: "Change you." },
          { icon: "globe",  label: "COMMUNITY",    sub: "Builds you." },
        ].map(item => (
          <View key={item.label} style={{ alignItems: "center", flex: 1 }}>
            <Ionicons name={item.icon as any} size={18} color={PINK} style={{ marginBottom: 3 }} />
            <Text style={s.footerLabel}>{item.label}</Text>
            <Text style={s.footerSub}>{item.sub}</Text>
          </View>
        ))}
      </View>
      <Text style={s.footerTagline}>THE FUTURE OF NETWORKING IS HERE.</Text>
      <Pressable style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1, marginTop: 12 }]}>
        <LinearGradient colors={[PINK, "#a855f7"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.createOppBtn}>
          <Ionicons name="flash" size={15} color="#fff" />
          <Text style={s.createOppText}>Create Opportunity</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function NetworkScreen() {
  const { isSignedIn } = useAuth();
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const queryClient = useQueryClient();

  const [activeIntent, setActiveIntent] = useState("network");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [openDoorPerson, setOpenDoorPerson] = useState<{ name: string } | null>(null);
  const [profilePerson, setProfilePerson] = useState<NetworkProfile | null>(null);
  const [pendingConnects, setPendingConnects] = useState<Set<string>>(new Set());

  function handleSearchChange(text: string) {
    setSearch(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(text), 400);
  }

  const {
    data: directoryData,
    isLoading,
    isRefetching,
    refetch,
  } = useGetNetworkDirectory(
    { limit: 30, search: debouncedSearch || undefined },
    { query: { enabled: !!isSignedIn } }
  );

  const { data: connectionsData } = useGetNetworkConnections({
    query: { enabled: !!isSignedIn },
  });

  const requestMutation = useSendNetworkRequest();
  const chatMatchMutation = useCreateNetworkChatMatch();

  function getConnectionStatus(userId: string): "none" | "pending" | "accepted" {
    if (pendingConnects.has(userId)) return "pending";
    if (!connectionsData) return "none";
    if (connectionsData.pendingOutgoing.find(c => c.recipientId === userId)) return "pending";
    if (connectionsData.accepted.find(c => c.requesterId === userId || c.recipientId === userId)) return "accepted";
    return "none";
  }

  async function handleConnect(profile: NetworkProfile) {
    setPendingConnects(prev => new Set(prev).add(profile.userId));
    try {
      await requestMutation.mutateAsync({ data: { recipientId: profile.userId } });
      queryClient.invalidateQueries({ queryKey: getGetNetworkDirectoryQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetNetworkConnectionsQueryKey() });
    } catch {
      setPendingConnects(prev => { const n = new Set(prev); n.delete(profile.userId); return n; });
    }
  }

  async function handleMessage(otherUserId: string) {
    try {
      const result = await chatMatchMutation.mutateAsync({ data: { otherUserId } });
      router.push(`/chat/${result.matchId}` as any);
    } catch {}
  }

  if (!isSignedIn) {
    return (
      <View style={[s.centered, { backgroundColor: "#09090b" }]}>
        <Ionicons name="lock-closed" size={48} color="#52525b" />
        <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", marginTop: 12 }}>Sign in to network</Text>
      </View>
    );
  }

  const profiles = directoryData?.profiles ?? [];

  return (
    <View style={[s.root, { backgroundColor: "#09090b" }]}>
      {/* Spacer for status bar */}
      <View style={{ height: topInset + 8 }} />

      {/* Intent Tabs — full-width row, all 5 visible */}
      <View style={s.intentTabsRow}>
        {INTENT_TABS.map(tab => {
          const active = activeIntent === tab.id;
          const c = INTENT_COLORS[tab.id];
          return (
            <Pressable key={tab.id} onPress={() => setActiveIntent(tab.id)}
              style={[s.intentTab, active && { backgroundColor: c + "cc", borderColor: c + "55" }]}>
              <Ionicons name={tab.icon} size={12} color={active ? "#fff" : "#71717a"} />
              <Text style={[s.intentTabText, { color: active ? "#fff" : "#71717a" }]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <Ionicons name="search-outline" size={15} color="#52525b" />
        <TextInput
          value={search}
          onChangeText={handleSearchChange}
          placeholder="Search skills, names, opportunities…"
          placeholderTextColor="#52525b"
          style={s.searchInput}
        />
        {search.length > 0 && (
          <Pressable onPress={() => { setSearch(""); setDebouncedSearch(""); }}>
            <Ionicons name="close-circle" size={16} color="#52525b" />
          </Pressable>
        )}
      </View>

      {/* Main scrollable feed */}
      <FlatList
        data={profiles}
        keyExtractor={item => item.userId}
        renderItem={({ item }) => {
          const status = getConnectionStatus(item.userId);
          return (
            <OppCard
              profile={item}
              status={status}
              onConnect={() => handleConnect(item)}
              onMessage={() => handleMessage(item.userId)}
              onOpenDoor={() => setOpenDoorPerson({ name: item.displayName ?? "them" })}
              onViewProfile={() => setProfilePerson(item)}
              connectLoading={requestMutation.isPending}
            />
          );
        }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={PINK} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={{ marginBottom: 4 }}>
            <View style={s.feedHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={[s.livePulse, { backgroundColor: PINK }]} />
                <Text style={s.feedHeaderText}>
                  {profiles.length} opportunities live
                </Text>
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          isLoading ? null : (
            <View style={s.emptyState}>
              <Ionicons name="briefcase-outline" size={48} color="#3f3f46" />
              <Text style={s.emptyTitle}>No opportunities found</Text>
              <Text style={s.emptySub}>Try a different intent or clear search</Text>
            </View>
          )
        }
        ListFooterComponent={
          profiles.length > 0 ? (
            <>
              <PeopleNearYou />
              <LiveRooms />
              <HotConnections />
              <NetworkFooter />
            </>
          ) : null
        }
      />

      <OpenDoorModal
        person={openDoorPerson}
        visible={!!openDoorPerson}
        onClose={() => setOpenDoorPerson(null)}
      />
      <ProfileDrawer
        person={profilePerson}
        visible={!!profilePerson}
        onClose={() => setProfilePerson(null)}
        onOpenDoor={() => setOpenDoorPerson({ name: profilePerson?.displayName ?? "them" })}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:               { flex: 1 },
  centered:           { flex: 1, alignItems: "center", justifyContent: "center" },

  header:             { paddingHorizontal: 16, paddingBottom: 12, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  headerTitle:        { color: "#fff", fontFamily: "Inter_800ExtraBold", fontSize: 20, lineHeight: 24 },
  headerSub:          { color: "#52525b", fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
  headerBtn:          { width: 36, height: 36, borderRadius: 10, backgroundColor: "#18181b", borderWidth: 1, borderColor: "#27272a", alignItems: "center", justifyContent: "center", position: "relative" },
  notifDot:           { position: "absolute", top: 6, right: 6, width: 6, height: 6, borderRadius: 3, backgroundColor: PINK },

  intentTabsRow:      { flexDirection: "row", paddingHorizontal: 12, gap: 6, marginBottom: 8 },
  intentTab:          { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 8, borderRadius: 50, backgroundColor: "#18181b", borderWidth: 1, borderColor: "#27272a" },
  intentTabText:      { fontFamily: "Inter_600SemiBold", fontSize: 11 },

  searchWrap:         { marginHorizontal: 16, marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#18181b", borderWidth: 1, borderColor: "#27272a", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput:        { flex: 1, color: "#fff", fontFamily: "Inter_400Regular", fontSize: 13 },

  feedHeader:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  feedHeaderText:     { color: "#71717a", fontFamily: "Inter_500Medium", fontSize: 12 },
  livePulse:          { width: 6, height: 6, borderRadius: 3 },

  // Card
  card:               { backgroundColor: "#18181b", borderWidth: 1, borderColor: "#27272a", borderRadius: 16, padding: 14, marginBottom: 12 },
  cardTop:            { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  cardName:           { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  activeText:         { color: "#4ADE80", fontFamily: "Inter_500Medium", fontSize: 10 },
  cardLocation:       { color: "#52525b", fontFamily: "Inter_400Regular", fontSize: 11 },
  activeDot:          { position: "absolute", bottom: 0, right: 0, width: 11, height: 11, borderRadius: 5.5, backgroundColor: "#4ADE80", borderWidth: 2, borderColor: "#18181b" },
  cardAvatar:         { width: 44, height: 44, borderRadius: 22 },

  intentBadge:        { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 50, borderWidth: 1, marginBottom: 8 },
  intentDot:          { width: 5, height: 5, borderRadius: 2.5 },
  intentText:         { fontFamily: "Inter_700Bold", fontSize: 10, letterSpacing: 0.5 },

  cardHeadline:       { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15, lineHeight: 20, marginBottom: 5 },
  cardBio:            { color: "#71717a", fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 17, marginBottom: 10 },

  skillsRow:          { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  skillChip:          { backgroundColor: "#27272a", borderWidth: 1, borderColor: "#3f3f46", borderRadius: 50, paddingHorizontal: 10, paddingVertical: 4 },
  skillChipText:      { color: "#a1a1aa", fontFamily: "Inter_500Medium", fontSize: 11 },

  interestedRow:      { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  microAvatar:        { width: 18, height: 18, borderRadius: 9, backgroundColor: "#3f3f46", borderWidth: 1.5, borderColor: "#18181b", alignItems: "center", justifyContent: "center" },
  interestedText:     { color: "#52525b", fontFamily: "Inter_400Regular", fontSize: 11 },

  cardActions:        { flexDirection: "row", gap: 8 },
  openDoorBtn:        { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 9, borderRadius: 10 },
  openDoorText:       { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 12 },
  secondaryBtn:       { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 9, borderRadius: 10, backgroundColor: "#27272a", borderWidth: 1, borderColor: "#3f3f46" },
  secondaryBtnText:   { color: "#a1a1aa", fontFamily: "Inter_600SemiBold", fontSize: 12 },

  // Section
  section:            { marginBottom: 20 },
  sectionHeaderRow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle:       { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 },
  sectionSub:         { color: "#52525b", fontFamily: "Inter_400Regular", fontSize: 11 },
  seeAll:             { fontFamily: "Inter_600SemiBold", fontSize: 12 },

  // Nearby
  nearbyCard:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#18181b", borderWidth: 1, borderColor: "#27272a", borderRadius: 14, padding: 12, marginBottom: 8 },
  nearbyName:         { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 },
  nearbyHeadline:     { color: "#52525b", fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 2 },
  connectBtn:         { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  connectBtnText:     { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 11 },
  seeMoreBtn:         { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 12, backgroundColor: "#18181b", borderWidth: 1, borderColor: "#27272a", borderRadius: 12 },
  seeMoreText:        { color: "#71717a", fontFamily: "Inter_500Medium", fontSize: 12 },

  // Live rooms
  liveBadge:          { backgroundColor: PINK, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  liveBadgeText:      { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 9, letterSpacing: 0.5 },
  liveCard:           { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#18181b", borderWidth: 1, borderColor: "#27272a", borderRadius: 14, padding: 12, marginBottom: 8 },
  liveIcon:           { width: 38, height: 38, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  liveRoomName:       { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 },
  liveCount:          { color: "#52525b", fontFamily: "Inter_400Regular", fontSize: 11 },
  joinBtn:            { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  joinBtnText:        { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 11 },

  // Modal
  modalOverlay:       { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.7)" },
  modalSheet:         { backgroundColor: "#18181b", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingBottom: 36, borderTopWidth: 1, borderColor: "#27272a" },
  modalHandle:        { width: 40, height: 4, borderRadius: 2, backgroundColor: "#3f3f46", alignSelf: "center", marginVertical: 12 },
  modalHeader:        { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 },
  modalTitle:         { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 18 },
  modalSub:           { color: "#71717a", fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
  modalClose:         { width: 32, height: 32, borderRadius: 16, backgroundColor: "#27272a", alignItems: "center", justifyContent: "center" },
  msgBubble:          { backgroundColor: "#27272a", borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: "#3f3f46" },
  msgText:            { color: "#d4d4d8", fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19 },
  noteInput:          { backgroundColor: "#27272a", borderWidth: 1, borderColor: "#3f3f46", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, color: "#fff", fontFamily: "Inter_400Regular", fontSize: 13 },
  charCount:          { color: "#52525b", fontFamily: "Inter_400Regular", fontSize: 11, textAlign: "right", marginTop: 4, marginBottom: 12 },
  sendBtn:            { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 13, borderRadius: 12 },
  sendBtnText:        { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 },
  sendNote:           { color: "#52525b", fontFamily: "Inter_400Regular", fontSize: 11, textAlign: "center", marginTop: 8 },
  recentDoors:        { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: "#27272a" },
  recentDoorsLabel:   { color: "#52525b", fontFamily: "Inter_600SemiBold", fontSize: 11, marginBottom: 8 },

  // Drawer
  drawerSheet:        { backgroundColor: "#09090b", borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: SCREEN_H * 0.92, borderTopWidth: 1, borderColor: "#27272a", overflow: "hidden" },
  drawerHero:         { height: 210, width: "100%", overflow: "hidden" },
  drawerBackBtn:      { position: "absolute", top: 14, left: 14, width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },
  drawerIdentity:     { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 14, paddingBottom: 16 },
  drawerAvatarImg:    { width: 54, height: 54, borderRadius: 27, borderWidth: 2.5, borderColor: PINK, overflow: "hidden" },
  drawerAvatarDot:    { position: "absolute", bottom: 2, right: 2, width: 14, height: 14, borderRadius: 7, backgroundColor: "#4ADE80", borderWidth: 2.5, borderColor: "#09090b" },
  drawerName:         { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 19 },
  drawerLocation:     { color: "#71717a", fontFamily: "Inter_400Regular", fontSize: 12 },
  drawerActiveText:   { color: "#4ADE80", fontFamily: "Inter_500Medium", fontSize: 12 },
  drawerOpenDoor:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 14, borderRadius: 14 },
  drawerOpenDoorText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 },
  drawerShareBtn:     { width: 50, height: 50, borderRadius: 14, backgroundColor: "#18181b", borderWidth: 1, borderColor: "#3f3f46", alignItems: "center", justifyContent: "center" },
  drawerInfoCard:     { marginBottom: 14 },
  drawerInfoRow:      { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 5 },
  drawerInfoIcon:     { width: 26, height: 26, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  drawerInfoLabel:    { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  drawerInfoValue:    { color: "#a1a1aa", fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 20, paddingLeft: 2 },
  drawerSectionTitle: { color: "#52525b", fontFamily: "Inter_600SemiBold", fontSize: 11, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 },
  socialBtn:          { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },

  // Footer
  footer:             { backgroundColor: "#18181b", borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: "#27272a" },
  footerRow:          { flexDirection: "row", marginBottom: 16 },
  footerLabel:        { color: "#fff", fontFamily: "Inter_800ExtraBold", fontSize: 9, letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 },
  footerSub:          { color: "#52525b", fontFamily: "Inter_400Regular", fontSize: 10 },
  footerTagline:      { color: "#a1a1aa", fontFamily: "Inter_800ExtraBold", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", textAlign: "center" },
  createOppBtn:       { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 13, borderRadius: 12 },
  createOppText:      { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 },

  emptyState:         { alignItems: "center", paddingTop: 60, paddingBottom: 20 },
  emptyTitle:         { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 16, marginTop: 12 },
  emptySub:           { color: "#52525b", fontFamily: "Inter_400Regular", fontSize: 13, marginTop: 6, textAlign: "center" },
});
