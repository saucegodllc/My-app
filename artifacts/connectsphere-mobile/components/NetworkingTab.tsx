/**
 * NetworkingTab — mobile RN translation of the web spec.
 *
 * Replaces the swipe deck in the Discover screen when the user picks the
 * "Networking" intent tab. Premium black + pink + emerald aesthetic.
 *
 * Sections:
 *   1. Header        — title + subtitle + live "X active now" badge
 *   2. Power Stats   — 4 quick KPI tiles
 *   3. Quick Actions — 4 CTA tiles
 *   4. People        — connect cards
 *   5. Work Groups   — horizontal scroller
 *   6. Opportunities — LIVE feed from /api/opportunities w/ filter chips,
 *                       auto-refresh every 10 min, "Updated just now" pill,
 *                       Apply / Save / Share / Join Group Chat actions
 *   7. Viral         — Open Door / Warm Intro / Group Streak / Active Now
 *      + Build Circle CTA
 */

import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { createElement, type ComponentProps } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

/**
 * Validate and clean an opportunity's `applyUrl`. Returns the url if it's
 * an https link to a real external destination, otherwise null. Rejects:
 *   - empty / "#" placeholders
 *   - the parked connectsphere.app domain (ad networks redirect parked
 *     domains to junk like SearchHounds)
 *   - non-https schemes (avoids tel:, mailto:, intent:// abuse)
 */
function validateApplyUrl(applyUrl: string | undefined | null): string | null {
  const url = applyUrl?.trim();
  if (!url || url === "#") return null;
  if (/^https?:\/\/(www\.)?connectsphere\.app\//i.test(url)) return null;
  if (!/^https:\/\//i.test(url)) return null;
  return url;
}

/**
 * Open an external URL on native (web uses an actual <a target="_blank">
 * element rendered by ApplyButton — see below — because window.open is
 * blocked inside the Replit canvas iframe sandbox).
 */
async function openExternalNative(url: string): Promise<void> {
  await Linking.openURL(url);
}

/**
 * Apply button.
 *
 * On native (iOS/Android) we render a Pressable + Linking.openURL.
 * On web we render an actual HTML <a target="_blank"> element so the
 * browser treats the click as a native user-gesture navigation — this is
 * the only thing that reliably escapes the Replit canvas iframe sandbox
 * (window.open + window.top.location both get blocked cross-origin).
 *
 * If the URL is missing/invalid we render a Pressable on both platforms
 * that fires `onInvalid` to show the "coming soon" alert.
 */
function ApplyButton({
  url,
  onInvalid,
}: {
  url: string | null;
  onInvalid: () => void;
}) {
  const label = (
    <Text style={styles.applyBtnText}>Apply</Text>
  );

  // Web + valid url → real anchor. createElement avoids needing a JSX
  // intrinsic for 'a' (this file is RN, not DOM).
  if (Platform.OS === "web" && url) {
    return createElement(
      "a",
      {
        href: url,
        target: "_blank",
        rel: "noopener noreferrer",
        style: {
          flex: 1,
          backgroundColor: "#34D399",
          paddingTop: 9,
          paddingBottom: 9,
          borderRadius: 999,
          textAlign: "center",
          color: "#000",
          fontSize: 12,
          fontWeight: 900,
          textDecoration: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        },
      },
      "Apply",
    );
  }

  // Native (or web with no url) → Pressable.
  return (
    <Pressable
      onPress={async () => {
        if (!url) {
          onInvalid();
          return;
        }
        try {
          await openExternalNative(url);
        } catch {
          Alert.alert("Couldn't open link", url);
        }
      }}
      style={({ pressed }) => [styles.applyBtn, pressed && styles.pressed96]}
    >
      {label}
    </Pressable>
  );
}

type IoniconName = ComponentProps<typeof Ionicons>["name"];

// ─── Live Opportunities types ────────────────────────────────────────────────

type Opportunity = {
  id: string;
  title: string;
  company: string;
  location: string;
  type: string;
  source: "ConnectSphere" | "Adzuna" | "USAJOBS" | "Greenhouse" | "Lever";
  applyUrl: string;
  tags: string[];
  postedAt: string;
  isRemote: boolean;
  groupChatId: string | null;
};

type OpportunitiesResponse = {
  updatedAt: string;
  count: number;
  opportunities: Opportunity[];
};

const OPPORTUNITY_FILTERS = ["For You", "Jobs", "Internships", "Collabs"] as const;
type OpportunityFilter = (typeof OPPORTUNITY_FILTERS)[number];

const REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

// ─── Static data (mirrors the web spec) ──────────────────────────────────────

type Person = {
  name: string;
  role: string;
  org: string;
  location: string;
  openTo: string;
  skills: string[];
  image: string;
};

const PEOPLE: Person[] = [
  {
    name: "Isabella Martinez",
    role: "Product Designer",
    org: "NYU \u00b7 Miami",
    location: "Miami, FL",
    openTo: "Open to Work",
    skills: ["Design", "Figma", "UX/UI"],
    image:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80",
  },
  {
    name: "Julian Rodriguez",
    role: "Software Engineer",
    org: "FIU \u00b7 Miami",
    location: "Brickell, FL",
    openTo: "Collaboration",
    skills: ["React", "AI", "Python"],
    image:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80",
  },
  {
    name: "Aaliyah Khan",
    role: "Marketing Manager",
    org: "University of Miami",
    location: "Coral Gables, FL",
    openTo: "Mentorship",
    skills: ["Branding", "Growth", "Content"],
    image:
      "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=400&q=80",
  },
];

type WorkGroup = {
  title: string;
  members: string;
  online: string;
  icon: IoniconName | "crown";
};

const WORK_GROUPS: WorkGroup[] = [
  { title: "Miami Startup Circle", members: "1.2K", online: "84 online", icon: "sparkles" },
  { title: "FIU Career Network", members: "3.4K", online: "216 online", icon: "school" },
  { title: "Creators & Brand Deals", members: "928", online: "47 online", icon: "crown" },
  { title: "Real Estate Leads", members: "2.1K", online: "93 online", icon: "business" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Map an opportunity onto one of the user-facing filter chips. */
function matchesFilter(o: Opportunity, filter: OpportunityFilter): boolean {
  if (filter === "For You") return true;
  const t = o.type.toLowerCase();
  if (filter === "Jobs") return t === "job" || t.includes("part-time") || t.includes("full-time");
  if (filter === "Internships") return t.includes("intern");
  if (filter === "Collabs") return t.includes("collab") || t.includes("co-found") || t.includes("founding");
  return true;
}

/** "Updated just now" / "3m ago" / "2h ago" — for the freshness pill. */
function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60 * 1000) return "Updated just now";
  const mins = Math.floor(ms / (60 * 1000));
  if (mins < 60) return `Updated ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Updated ${hrs}h ago`;
  return `Updated ${Math.floor(hrs / 24)}d ago`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function NetworkingTab() {
  const [searchOpen, setSearchOpen] = useState(false);
  return (
    <View style={styles.root}>
      {/* Ambient pink + emerald blobs (mirrors the web `blur-[120px]` glows). */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={styles.blobPink} />
        <View style={styles.blobEmerald} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <NetworkingHeader onPressSearch={() => setSearchOpen(true)} />
        <PowerStats />
        <QuickActions />

        <SectionHeader title="People You Should Connect With" action="See all" mt={20} />
        <View style={{ marginTop: 12, gap: 12 }}>
          {PEOPLE.map((p) => (
            <PersonCard key={p.name} person={p} />
          ))}
        </View>

        <SectionHeader title="Work Groups" action="Explore" mt={24} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.hScrollContent}
          style={{ marginTop: 12 }}
        >
          {WORK_GROUPS.map((g) => (
            <WorkGroupCard key={g.title} group={g} />
          ))}
        </ScrollView>

        <OpportunitiesSection />

        <SectionHeader title="Viral" action="Boost" mt={24} />
        <ViralRow />

        <BuildCircleCTA />
      </ScrollView>

      <NetworkingSearchOverlay
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
      />
    </View>
  );
}

// ─── Header ──────────────────────────────────────────────────────────────────

function NetworkingHeader({ onPressSearch }: { onPressSearch: () => void }) {
  return (
    <View style={styles.headerRow}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.headerTitle}>Networking</Text>
        <Text style={styles.headerSubtitle}>
          <Text style={{ color: "#F472B6" }}>Open doors.</Text>{" "}
          <Text style={{ color: "#D4D4D8" }}>Build your circle.</Text>
        </Text>

        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>128 active now</Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pressable style={styles.headerIconBtn} onPress={onPressSearch}>
          <Ionicons name="search" size={20} color="#FFF" />
        </Pressable>
        <Pressable style={styles.headerIconBtn}>
          <Ionicons name="notifications-outline" size={20} color="#FFF" />
          <View style={styles.headerBellDot} />
        </Pressable>
      </View>
    </View>
  );
}

// ─── Search Overlay ──────────────────────────────────────────────────────────

const SEARCH_FILTERS = [
  "All",
  "Jobs",
  "Internships",
  "People",
  "Groups",
  "Events",
  "Open Doors",
] as const;
type SearchFilter = (typeof SEARCH_FILTERS)[number];

type SearchResult = {
  key: string;
  kind: Exclude<SearchFilter, "All">;
  title: string;
  subtitle: string;
  tags: string[];
  searchable: string;
};

/** Map an opportunity onto one of the search filter kinds. */
function classifyOpportunity(o: Opportunity): SearchResult["kind"] {
  const t = o.type.toLowerCase();
  if (t.includes("intern")) return "Internships";
  if (t.includes("collab") || t.includes("co-found") || t.includes("founding"))
    return "Open Doors";
  if (t === "event" || t.includes("event")) return "Events";
  return "Jobs";
}

function NetworkingSearchOverlay({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<SearchFilter>("All");
  const [opps, setOpps] = useState<Opportunity[]>([]);

  const apiBase = useMemo(() => {
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    return domain ? `https://${domain}` : "";
  }, []);

  // Lazy-load opportunities the first time the overlay opens. The API is
  // single-flight + 10-min-cached so this is cheap even if other components
  // (OpportunitiesSection) also called it.
  useEffect(() => {
    if (!visible || !apiBase) return;
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch(`${apiBase}/api/opportunities`, {
          signal: ctrl.signal,
        });
        if (!res.ok) return;
        const data: OpportunitiesResponse = await res.json();
        if (ctrl.signal.aborted) return;
        setOpps(data.opportunities);
      } catch {
        /* swallow — search still works on People + Groups */
      }
    })();
    return () => ctrl.abort();
  }, [visible, apiBase]);

  // Build a unified, searchable index every time inputs change.
  const results = useMemo<SearchResult[]>(() => {
    const peopleResults: SearchResult[] = PEOPLE.map((p) => ({
      key: `person-${p.name}`,
      kind: "People",
      title: p.name,
      subtitle: `${p.role} · ${p.org}`,
      tags: p.skills,
      searchable: [
        p.name,
        p.role,
        p.org,
        p.location,
        p.openTo,
        ...p.skills,
      ]
        .join(" ")
        .toLowerCase(),
    }));

    const groupResults: SearchResult[] = WORK_GROUPS.map((g) => ({
      key: `group-${g.title}`,
      kind: "Groups",
      title: g.title,
      subtitle: `${g.members} members · ${g.online}`,
      tags: ["Group", "Networking"],
      searchable: [g.title, g.members, g.online, "group", "networking"]
        .join(" ")
        .toLowerCase(),
    }));

    const oppResults: SearchResult[] = opps.map((o) => ({
      key: `opp-${o.id}`,
      kind: classifyOpportunity(o),
      title: o.title,
      subtitle: `${o.company} · ${o.location || "Remote"}`,
      tags: o.tags?.length ? o.tags : [o.type],
      searchable: [
        o.title,
        o.company,
        o.location,
        o.type,
        o.source,
        ...(o.tags ?? []),
      ]
        .join(" ")
        .toLowerCase(),
    }));

    const all = [...peopleResults, ...oppResults, ...groupResults];
    const q = query.trim().toLowerCase();
    return all.filter((item) => {
      if (filter !== "All" && item.kind !== filter) return false;
      if (!q) return true;
      return item.searchable.includes(q);
    });
  }, [query, filter, opps]);

  const showResults = query.trim().length > 0 || filter !== "All";

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="overFullScreen"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.searchOverlayRoot}>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View style={styles.blobPink} />
          <View style={styles.blobEmerald} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <View style={styles.searchHeaderRow}>
            <Pressable
              onPress={onClose}
              style={styles.headerIconBtn}
              hitSlop={8}
            >
              <Ionicons name="chevron-back" size={20} color="#FFF" />
            </Pressable>
            <Text style={styles.searchHeaderTitle}>Search</Text>
            <View style={{ width: 42 }} />
          </View>

          <View style={styles.searchInputWrap}>
            <Ionicons
              name="search"
              size={18}
              color="#F9A8D4"
              style={{ marginLeft: 16 }}
            />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search jobs, internships, people, groups, open doors…"
              placeholderTextColor="#71717A"
              style={styles.searchInput}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {query.length > 0 && (
              <Pressable
                onPress={() => setQuery("")}
                style={{ paddingHorizontal: 14 }}
                hitSlop={8}
              >
                <Ionicons name="close" size={18} color="#A1A1AA" />
              </Pressable>
            )}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.searchChipsRow}
          >
            {SEARCH_FILTERS.map((item) => {
              const active = filter === item;
              return (
                <Pressable
                  key={item}
                  onPress={() => setFilter(item)}
                  style={[
                    styles.searchChip,
                    active && styles.searchChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.searchChipText,
                      active && styles.searchChipTextActive,
                    ]}
                  >
                    {item}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.searchResultsList}
            keyboardShouldPersistTaps="handled"
          >
            {!showResults ? (
              <View style={styles.searchHintCard}>
                <Ionicons name="search-circle" size={36} color="#F472B6" />
                <Text style={styles.searchHintTitle}>
                  Find your next opportunity
                </Text>
                <Text style={styles.searchHintSub}>
                  Search across jobs, internships, collabs, people, and work
                  groups.
                </Text>
              </View>
            ) : results.length === 0 ? (
              <View style={styles.searchEmptyCard}>
                <Text style={styles.searchEmptyTitle}>Nothing found yet</Text>
                <Text style={styles.searchEmptySub}>
                  Post an open door and help someone connect.
                </Text>
                <Pressable style={styles.searchEmptyBtn}>
                  <Text style={styles.searchEmptyBtnText}>
                    Post an Open Door
                  </Text>
                </Pressable>
              </View>
            ) : (
              results.map((item) => (
                <View key={item.key} style={styles.searchResultCard}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={styles.searchKindPill}>
                      <Text style={styles.searchKindPillText}>{item.kind}</Text>
                    </View>
                    <Text style={styles.searchResultTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.searchResultSub} numberOfLines={1}>
                      {item.subtitle}
                    </Text>
                    <View style={styles.searchResultTagsRow}>
                      {item.tags.slice(0, 3).map((tag) => (
                        <View key={tag} style={styles.searchResultTag}>
                          <Text style={styles.searchResultTagText}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  <Pressable style={styles.searchResultOpenBtn}>
                    <Text style={styles.searchResultOpenText}>Open</Text>
                  </Pressable>
                </View>
              ))
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ─── Power Stats ─────────────────────────────────────────────────────────────

function PowerStats() {
  const stats: { label: string; value: string; icon: IoniconName; color: string }[] = [
    { label: "Hiring Now", value: "124", icon: "flame", color: "#F472B6" },
    { label: "Students", value: "2.3K", icon: "school", color: "#6EE7B7" },
    { label: "Founders", value: "842", icon: "briefcase", color: "#93C5FD" },
    { label: "Events", value: "18", icon: "calendar", color: "#FDBA74" },
  ];

  return (
    <View style={styles.statsRow}>
      {stats.map((s) => (
        <Pressable key={s.label} style={({ pressed }) => [styles.statCard, pressed && styles.pressed96]}>
          <Ionicons name={s.icon} size={16} color={s.color} style={{ alignSelf: "center" }} />
          <Text style={styles.statValue}>{s.value}</Text>
          <Text style={styles.statLabel}>{s.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// ─── Quick Actions ───────────────────────────────────────────────────────────

function QuickActions() {
  const actions: { title: string; icon: IoniconName; glow: string }[] = [
    { title: "Find People", icon: "people", glow: "rgb(236,72,153)" },
    { title: "Work Groups", icon: "chatbubble-ellipses", glow: "rgb(168,85,247)" },
    { title: "Plan Meeting", icon: "calendar", glow: "rgb(59,130,246)" },
    { title: "Post Opportunity", icon: "add", glow: "rgb(251,191,36)" },
  ];

  return (
    <View style={{ marginTop: 20 }}>
      <SectionHeader title="Quick Actions" action="Customize" />
      <View style={[styles.statsRow, { marginTop: 12 }]}>
        {actions.map((a) => (
          <Pressable
            key={a.title}
            style={({ pressed }) => [
              styles.statCard,
              { shadowColor: a.glow, shadowOpacity: 0.6, shadowRadius: 16, shadowOffset: { width: 0, height: 0 } },
              pressed && styles.pressed93,
            ]}
          >
            <Ionicons name={a.icon} size={22} color="#F9A8D4" style={{ alignSelf: "center" }} />
            <Text style={styles.actionLabel} numberOfLines={2}>
              {a.title}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ─── Person Card ─────────────────────────────────────────────────────────────

function PersonCard({ person }: { person: Person }) {
  return (
    <View style={styles.personCard}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <ExpoImage source={{ uri: person.image }} style={styles.personPhoto} contentFit="cover" />

        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={styles.personName} numberOfLines={1}>
              {person.name}
            </Text>
            <Ionicons name="shield-checkmark" size={14} color="#34D399" />
          </View>
          <Text style={styles.personRole}>{person.role}</Text>
          <Text style={styles.personOrg}>{person.org}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
            <Ionicons name="location-outline" size={11} color="#A1A1AA" />
            <Text style={styles.personLocation}>{person.location}</Text>
          </View>
        </View>

        <View style={{ alignItems: "flex-end" }}>
          <View style={styles.openToPill}>
            <Text style={styles.openToText}>{person.openTo}</Text>
          </View>
        </View>
      </View>

      <View style={styles.skillRow}>
        {person.skills.map((s) => (
          <View key={s} style={styles.skillChip}>
            <Text style={styles.skillText}>{s}</Text>
          </View>
        ))}
      </View>

      <View style={styles.personActionRow}>
        <Pressable style={({ pressed }) => [{ flex: 1 }, pressed && styles.pressed96]}>
          <LinearGradient
            colors={["#EC4899", "#D946EF"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.connectBtn}
          >
            <Text style={styles.connectBtnText}>Connect</Text>
          </LinearGradient>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.iconActionBtn, pressed && styles.pressed96]}>
          <Ionicons name="chatbubble-ellipses-outline" size={16} color="#FFF" />
        </Pressable>
        <Pressable style={({ pressed }) => [styles.iconActionBtn, pressed && styles.pressed96]}>
          <Ionicons name="person-add-outline" size={16} color="#FFF" />
        </Pressable>
      </View>
    </View>
  );
}

// ─── Work Group Card ─────────────────────────────────────────────────────────

function WorkGroupCard({ group }: { group: WorkGroup }) {
  return (
    <View style={styles.workGroupCard}>
      <LinearGradient
        colors={["rgba(236,72,153,0.18)", "rgba(255,255,255,0.04)", "rgba(52,211,153,0.12)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: 24 }]}
      />
      <View style={styles.workGroupIconBg}>
        {group.icon === "crown" ? (
          <MaterialCommunityIcons name="crown" size={22} color="#F9A8D4" />
        ) : (
          <Ionicons name={group.icon as IoniconName} size={22} color="#F9A8D4" />
        )}
      </View>
      <Text style={styles.workGroupTitle}>{group.title}</Text>
      <Text style={styles.workGroupMembers}>{group.members} members</Text>
      <Text style={styles.workGroupOnline}>{group.online}</Text>
      <Pressable style={({ pressed }) => [styles.joinBtn, pressed && styles.pressed96]}>
        <Text style={styles.joinBtnText}>Join</Text>
      </Pressable>
    </View>
  );
}

// ─── Opportunities Section (LIVE) ────────────────────────────────────────────

function OpportunitiesSection() {
  const router = useRouter();
  const [filter, setFilter] = useState<OpportunityFilter>("For You");
  const [items, setItems] = useState<Opportunity[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  // Re-render every 30s so the relative "Updated Xm ago" stays accurate
  // even when no fetch has fired.
  const [, setTick] = useState(0);

  const apiBase = useMemo(() => {
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    return domain ? `https://${domain}` : "";
  }, []);

  /** Fetcher accepts an AbortSignal so stale responses (from a prior
   *  in-flight call or after unmount) are ignored. Errors no longer wipe
   *  out previously-loaded opportunities — we keep the last good snapshot
   *  visible and only surface the error if we have nothing to show. */
  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!apiBase) {
        setError("API not configured");
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${apiBase}/api/opportunities`, { signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: OpportunitiesResponse = await res.json();
        if (signal?.aborted) return;
        setItems(data.opportunities);
        setUpdatedAt(data.updatedAt);
        setError(null);
      } catch (e) {
        if ((e as { name?: string })?.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [apiBase],
  );

  // Initial load + 10-min refresh loop. Each load uses its own AbortController
  // so a slow request gets cancelled if a newer one (or unmount) arrives.
  useEffect(() => {
    let currentCtrl: AbortController | null = null;

    const run = () => {
      currentCtrl?.abort();
      currentCtrl = new AbortController();
      void load(currentCtrl.signal);
    };

    run();
    const id = setInterval(run, REFRESH_INTERVAL_MS);

    return () => {
      clearInterval(id);
      currentCtrl?.abort();
    };
  }, [load]);

  // Keep the "Updated Xm ago" label fresh.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30 * 1000);
    return () => clearInterval(id);
  }, []);

  const filtered = useMemo(
    () => items.filter((o) => matchesFilter(o, filter)),
    [items, filter],
  );

  const toggleSave = useCallback((id: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const onApplyInvalid = useCallback(() => {
    Alert.alert(
      "Apply",
      "Apply link coming soon. This opportunity is not connected yet.",
    );
  }, []);

  const onShare = useCallback(async (o: Opportunity) => {
    try {
      await Share.share({
        message: `${o.title} @ ${o.company} (${o.location})\n${o.applyUrl}`,
      });
    } catch {
      /* user cancelled */
    }
  }, []);

  const onJoinGroup = useCallback(
    (o: Opportunity) => {
      if (!o.groupChatId) return;
      // Reuse the existing chat route — group chats use the same screen with
      // a `group-` prefix so the chat screen can recognize them.
      router.push(`/chat/${o.groupChatId}` as never);
    },
    [router],
  );

  return (
    <>
      <View style={[styles.sectionHeader, { marginTop: 24 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
          <Text style={styles.sectionHeaderTitle}>Opportunities</Text>
          <View style={styles.updatedPill}>
            <View style={styles.updatedDot} />
            <Text style={styles.updatedText}>{formatRelative(updatedAt)}</Text>
          </View>
        </View>
        <Text style={styles.sectionHeaderAction}>Post one</Text>
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingRight: 16 }}
        style={{ marginTop: 12 }}
      >
        {OPPORTUNITY_FILTERS.map((f) => {
          const active = f === filter;
          return (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              style={({ pressed }) => [
                styles.filterChip,
                active && styles.filterChipActive,
                pressed && styles.pressed96,
              ]}
            >
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                {f}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Body */}
      <View style={{ marginTop: 12, gap: 12 }}>
        {loading ? (
          <View style={styles.opportunityEmpty}>
            <ActivityIndicator color="#F472B6" />
            <Text style={styles.opportunityEmptyText}>Loading opportunities…</Text>
          </View>
        ) : error && items.length === 0 ? (
          <View style={styles.opportunityEmpty}>
            <Ionicons name="cloud-offline-outline" size={20} color="#A1A1AA" />
            <Text style={styles.opportunityEmptyText}>Couldn't load: {error}</Text>
            <Pressable
              onPress={() => {
                setLoading(true);
                void load();
              }}
              style={({ pressed }) => [styles.retryBtn, pressed && styles.pressed96]}
            >
              <Text style={styles.retryBtnText}>Retry</Text>
            </Pressable>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.opportunityEmpty}>
            <Text style={styles.opportunityEmptyText}>
              No opportunities in “{filter}” yet.
            </Text>
          </View>
        ) : (
          filtered.map((o) => (
            <OpportunityCard
              key={o.id}
              opportunity={o}
              saved={savedIds.has(o.id)}
              onApplyInvalid={onApplyInvalid}
              onSave={() => toggleSave(o.id)}
              onShare={() => onShare(o)}
              onJoinGroup={() => onJoinGroup(o)}
            />
          ))
        )}
      </View>
    </>
  );
}

// ─── Opportunity Card ────────────────────────────────────────────────────────

function OpportunityCard({
  opportunity,
  saved,
  onApplyInvalid,
  onSave,
  onShare,
  onJoinGroup,
}: {
  opportunity: Opportunity;
  saved: boolean;
  onApplyInvalid: () => void;
  onSave: () => void;
  onShare: () => void;
  onJoinGroup: () => void;
}) {
  const validUrl = validateApplyUrl(opportunity.applyUrl);
  return (
    <View style={styles.opportunityCard}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="briefcase" size={18} color="#F9A8D4" />
            <Text style={styles.opportunityTitle} numberOfLines={1}>
              {opportunity.title}
            </Text>
          </View>
          <Text style={styles.opportunityCompany}>{opportunity.company}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
            <Ionicons name="time-outline" size={12} color="#71717A" />
            <Text style={styles.opportunityMeta}>
              {opportunity.location} \u00b7 {opportunity.type}
              {opportunity.isRemote ? " \u00b7 Remote" : ""}
            </Text>
          </View>

          {/* Source chip + tag chips */}
          <View style={[styles.skillRow, { marginTop: 8 }]}>
            <View style={[styles.skillChip, styles.sourceChip]}>
              <Text style={[styles.skillText, { color: "#F9A8D4" }]}>{opportunity.source}</Text>
            </View>
            {opportunity.tags.slice(0, 3).map((t) => (
              <View key={t} style={styles.skillChip}>
                <Text style={styles.skillText}>{t}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.newPill}>
          <Text style={styles.newPillText}>New</Text>
        </View>
      </View>

      <View style={styles.opportunityActionRow}>
        <ApplyButton url={validUrl} onInvalid={onApplyInvalid} />
        <Pressable
          onPress={onSave}
          style={({ pressed }) => [
            styles.iconActionBtn,
            saved && { borderColor: "rgba(244,114,182,0.5)", backgroundColor: "rgba(236,72,153,0.12)" },
            pressed && styles.pressed96,
          ]}
        >
          <Ionicons
            name={saved ? "bookmark" : "bookmark-outline"}
            size={16}
            color={saved ? "#F9A8D4" : "#FFF"}
          />
        </Pressable>
        <Pressable
          onPress={onShare}
          style={({ pressed }) => [styles.iconActionBtn, pressed && styles.pressed96]}
        >
          <Ionicons name="share-outline" size={16} color="#FFF" />
        </Pressable>
        {opportunity.groupChatId ? (
          <Pressable
            onPress={onJoinGroup}
            style={({ pressed }) => [styles.iconActionBtn, pressed && styles.pressed96]}
          >
            <Ionicons name="chatbubble-ellipses" size={16} color="#6EE7B7" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// ─── Viral row + Build Circle CTA ────────────────────────────────────────────

function ViralRow() {
  const items: { label: string; value: string; icon: IoniconName; tint: string }[] = [
    { label: "Open Door", value: "92", icon: "key", tint: "#F472B6" },
    { label: "Warm Intro", value: "12", icon: "flash", tint: "#FDE68A" },
    { label: "Group Streak", value: "7d", icon: "flame", tint: "#FB923C" },
    { label: "Active Now", value: "3", icon: "pulse", tint: "#34D399" },
  ];
  return (
    <View style={[styles.statsRow, { marginTop: 12 }]}>
      {items.map((it) => (
        <View key={it.label} style={styles.statCard}>
          <Ionicons name={it.icon} size={16} color={it.tint} style={{ alignSelf: "center" }} />
          <Text style={styles.statValue}>{it.value}</Text>
          <Text style={styles.statLabel}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}

function BuildCircleCTA() {
  return (
    <Pressable style={({ pressed }) => [{ marginTop: 20 }, pressed && styles.pressed96]}>
      <LinearGradient
        colors={["#EC4899", "#D946EF", "#34D399"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.ctaGradient}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.ctaTitle}>Build your circle</Text>
          <Text style={styles.ctaSubtitle}>Invite 3 friends \u2192 unlock Warm Intros</Text>
        </View>
        <View style={styles.ctaArrow}>
          <Ionicons name="arrow-forward" size={18} color="#000" />
        </View>
      </LinearGradient>
    </Pressable>
  );
}

// ─── Section header ──────────────────────────────────────────────────────────

function SectionHeader({
  title,
  action,
  mt = 0,
}: {
  title: string;
  action?: string;
  mt?: number;
}) {
  return (
    <View style={[styles.sectionHeader, { marginTop: mt }]}>
      <Text style={styles.sectionHeaderTitle}>{title}</Text>
      {action ? <Text style={styles.sectionHeaderAction}>{action}</Text> : null}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#020003",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  blobPink: {
    position: "absolute",
    top: -120,
    left: "20%",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(236,72,153,0.15)",
  },
  blobEmerald: {
    position: "absolute",
    top: 220,
    right: -120,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(52,211,153,0.10)",
  },

  // Header
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  headerTitle: {
    color: "#FFF",
    fontSize: 30,
    fontFamily: "Sora_800ExtraBold",
    fontWeight: "900",
    letterSpacing: -1.2,
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    fontWeight: "600",
  },
  livePill: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "rgba(52,211,153,0.30)",
    backgroundColor: "rgba(52,211,153,0.10)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#34D399",
    shadowColor: "#34D399",
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  liveText: {
    color: "#6EE7B7",
    fontSize: 11,
    fontWeight: "800",
  },
  headerIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.05)",
    position: "relative",
  },
  headerBellDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#F472B6",
    shadowColor: "#EC4899",
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },

  // ── Search overlay ─────────────────────────────────────────────────────
  searchOverlayRoot: {
    flex: 1,
    backgroundColor: "#000",
  },
  searchHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 60 : 24,
    paddingBottom: 12,
  },
  searchHeaderTitle: {
    color: "#FFF",
    fontSize: 18,
    fontFamily: "Sora_800ExtraBold",
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  searchInputWrap: {
    marginHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(244,114,182,0.25)",
    backgroundColor: "rgba(0,0,0,0.55)",
    height: 48,
  },
  searchInput: {
    flex: 1,
    color: "#FFF",
    fontSize: 13,
    fontWeight: "600",
    paddingHorizontal: 12,
    height: 48,
    outlineStyle: "none" as unknown as undefined,
  },
  searchChipsRow: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  searchChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  searchChipActive: {
    borderColor: "transparent",
    backgroundColor: "#EC4899",
    shadowColor: "#EC4899",
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  searchChipText: {
    color: "#A1A1AA",
    fontSize: 11,
    fontWeight: "900",
  },
  searchChipTextActive: {
    color: "#FFF",
  },
  searchResultsList: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 12,
  },
  searchHintCard: {
    marginTop: 32,
    alignItems: "center",
    padding: 28,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    gap: 8,
  },
  searchHintTitle: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 4,
  },
  searchHintSub: {
    color: "#A1A1AA",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  searchEmptyCard: {
    marginTop: 24,
    alignItems: "center",
    padding: 28,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(244,114,182,0.20)",
    backgroundColor: "rgba(236,72,153,0.10)",
    gap: 8,
  },
  searchEmptyTitle: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "900",
  },
  searchEmptySub: {
    color: "#A1A1AA",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  searchEmptyBtn: {
    marginTop: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#EC4899",
  },
  searchEmptyBtnText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "900",
  },
  searchResultCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  searchKindPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(236,72,153,0.15)",
  },
  searchKindPillText: {
    color: "#F9A8D4",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  searchResultTitle: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "900",
    marginTop: 8,
  },
  searchResultSub: {
    color: "#A1A1AA",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  searchResultTagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  searchResultTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  searchResultTagText: {
    color: "#D4D4D8",
    fontSize: 9,
    fontWeight: "700",
  },
  searchResultOpenBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#EC4899",
  },
  searchResultOpenText: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "900",
  },

  // Stats / actions row (4-up grid)
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 20,
  },
  statCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  statValue: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 6,
    fontFamily: "Sora_800ExtraBold",
  },
  statLabel: {
    color: "#A1A1AA",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
    textAlign: "center",
  },
  actionLabel: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "800",
    marginTop: 8,
    textAlign: "center",
    lineHeight: 12,
  },

  // Section header
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionHeaderTitle: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "900",
    fontFamily: "Sora_800ExtraBold",
  },
  sectionHeaderAction: {
    color: "#F472B6",
    fontSize: 12,
    fontWeight: "900",
  },

  // "Updated just now" pill
  updatedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(52,211,153,0.30)",
    backgroundColor: "rgba(52,211,153,0.08)",
  },
  updatedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#34D399",
  },
  updatedText: {
    color: "#6EE7B7",
    fontSize: 9,
    fontWeight: "800",
  },

  // Opportunity filter chips
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  filterChipActive: {
    borderColor: "rgba(244,114,182,0.55)",
    backgroundColor: "rgba(236,72,153,0.18)",
    shadowColor: "#EC4899",
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  filterChipText: {
    color: "#D4D4D8",
    fontSize: 11,
    fontWeight: "800",
  },
  filterChipTextActive: {
    color: "#FFF",
  },

  // Person card
  personCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.06)",
    padding: 12,
  },
  personPhoto: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: "#1F1F23",
  },
  personName: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "900",
    flexShrink: 1,
  },
  personRole: {
    color: "#D4D4D8",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  personOrg: {
    color: "#71717A",
    fontSize: 12,
  },
  personLocation: {
    color: "#A1A1AA",
    fontSize: 11,
  },
  openToPill: {
    borderWidth: 1,
    borderColor: "rgba(244,114,182,0.30)",
    backgroundColor: "rgba(236,72,153,0.10)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  openToText: {
    color: "#F9A8D4",
    fontSize: 10,
    fontWeight: "800",
  },
  skillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 12,
  },
  skillChip: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(0,0,0,0.30)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  sourceChip: {
    borderColor: "rgba(244,114,182,0.35)",
    backgroundColor: "rgba(236,72,153,0.10)",
  },
  skillText: {
    color: "#D4D4D8",
    fontSize: 10,
    fontWeight: "700",
  },
  personActionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
    alignItems: "center",
  },
  connectBtn: {
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: "center",
    shadowColor: "#EC4899",
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  connectBtnText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "900",
  },
  iconActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },

  // Work group horizontal cards
  hScrollContent: {
    paddingRight: 16,
    gap: 12,
  },
  workGroupCard: {
    width: 160,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(244,114,182,0.25)",
    padding: 14,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  workGroupIconBg: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#EC4899",
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  workGroupTitle: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "900",
    marginTop: 12,
    lineHeight: 16,
  },
  workGroupMembers: {
    color: "#A1A1AA",
    fontSize: 11,
    marginTop: 4,
  },
  workGroupOnline: {
    color: "#6EE7B7",
    fontSize: 11,
    marginTop: 1,
  },
  joinBtn: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: "rgba(244,114,182,0.50)",
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: "center",
  },
  joinBtnText: {
    color: "#F9A8D4",
    fontSize: 11,
    fontWeight: "900",
  },

  // Opportunity card
  opportunityCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.06)",
    padding: 14,
  },
  opportunityTitle: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "900",
    flexShrink: 1,
  },
  opportunityCompany: {
    color: "#D4D4D8",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  opportunityMeta: {
    color: "#71717A",
    fontSize: 11,
  },
  newPill: {
    backgroundColor: "rgba(52,211,153,0.10)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  newPillText: {
    color: "#6EE7B7",
    fontSize: 11,
    fontWeight: "900",
  },
  opportunityActionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
    alignItems: "center",
  },
  applyBtn: {
    flex: 1,
    backgroundColor: "#34D399",
    paddingVertical: 9,
    borderRadius: 999,
    alignItems: "center",
  },
  applyBtnText: {
    color: "#000",
    fontSize: 12,
    fontWeight: "900",
  },
  opportunityEmpty: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 24,
    alignItems: "center",
    gap: 10,
  },
  opportunityEmptyText: {
    color: "#A1A1AA",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  retryBtn: {
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(244,114,182,0.5)",
    backgroundColor: "rgba(236,72,153,0.12)",
  },
  retryBtnText: {
    color: "#F9A8D4",
    fontSize: 11,
    fontWeight: "900",
  },

  // CTA
  ctaGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 24,
    shadowColor: "#EC4899",
    shadowOpacity: 0.4,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
  },
  ctaTitle: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "900",
    fontFamily: "Sora_800ExtraBold",
  },
  ctaSubtitle: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  ctaArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
  },

  // Press states
  pressed96: { transform: [{ scale: 0.96 }] },
  pressed93: { transform: [{ scale: 0.93 }] },
});
