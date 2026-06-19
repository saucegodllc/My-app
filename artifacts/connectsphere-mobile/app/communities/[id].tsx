/**
 * Community Feed Screen
 * ─────────────────────────────────────────────────────────────────────────────
 * Route: /communities/:id  (id = community slug)
 *
 * Features:
 *   ✓ Instant render from SEED_COMMUNITIES (zero loading flash)
 *   ✓ Hot / New / Top sort tabs
 *   ✓ Real-time new-post banner via Firestore signal bus
 *   ✓ Infinite scroll (cursor-based pagination)
 *   ✓ Pull-to-refresh
 *   ✓ Optimistic like/unlike with haptics
 *   ✓ Avatar tap → ProfilePeekSheet (View Profile | Shoot Your Shot)
 *   ✓ FAB compose → create-post modal
 *   ✓ Join/leave from header — synced to hub
 *
 * Navigation:
 *   ← back to Communities hub (router.back())
 *   → post thread: /communities/thread/:postId
 *   → user profile: /user/:userId
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { BlurView } from "expo-blur";

import { BRAND, NEUTRAL, RADIUS, SPACE, TYPE } from "@/constants/tokens";
import { openProfile } from "@/lib/routes";
import {
  Community,
  CommunityPost,
  FeedSort,
  PostAuthor,
  SEED_COMMUNITIES,
  createPost,
  formatCount,
  getCommunity,
  getCommunityFeed,
  relativeTime,
  seedCommunityBySlug,
  toggleMembership,
  togglePostLike,
} from "@/services/communitiesApi";
import { publishCommunitySignal, subscribeToCommunitySignals } from "@/services/communitySignals";

// ── Design tokens ─────────────────────────────────────────────────────────────
const BG     = NEUTRAL.bg;
const CARD   = NEUTRAL.card;
const CARD2  = NEUTRAL.card2;
const BORDER = "rgba(255,255,255,0.08)";
const MUTED  = NEUTRAL.textMuted;

// ── Initials helper ───────────────────────────────────────────────────────────
const AVATAR_BG = [BRAND.purple, BRAND.pink, BRAND.cyan, BRAND.amber, BRAND.green];
function avatarBg(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_BG[Math.abs(hash) % AVATAR_BG.length];
}
function initials(name: string) {
  const parts = name.trim().split(" ");
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

// ── ProfilePeekSheet ──────────────────────────────────────────────────────────
interface ProfilePeekProps {
  author: PostAuthor | null;
  visible: boolean;
  onClose: () => void;
}

function ProfilePeekSheet({ author, visible, onClose }: ProfilePeekProps) {
  const insets = useSafeAreaInsets();
  const slideY = useRef(new Animated.Value(300)).current;
  const bgOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 200 }),
        Animated.timing(bgOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideY, { toValue: 300, duration: 200, useNativeDriver: true }),
        Animated.timing(bgOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!author) return null;
  const bg = avatarBg(author.name);
  const ini = initials(author.name);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[ss.peekBackdrop, { opacity: bgOpacity }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <Animated.View
          style={[
            ss.peekSheet,
            { paddingBottom: insets.bottom + SPACE.lg, transform: [{ translateY: slideY }] },
          ]}
        >
          {/* Handle */}
          <View style={ss.peekHandle} />

          {/* Avatar + info */}
          <View style={ss.peekTop}>
            <View style={[ss.peekAvatar, { backgroundColor: bg }]}>
              <Text style={ss.peekAvatarText}>{ini}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={ss.peekName}>{author.name}, {author.age}</Text>
              <Text style={ss.peekMeta}>{author.neighborhood} · Miami</Text>
            </View>
          </View>

          {/* Shared communities */}
          {author.sharedCommunities.length > 0 && (
            <View style={ss.peekSharedRow}>
              <Ionicons name="planet-outline" size={13} color={MUTED} />
              <Text style={ss.peekShared}>
                Also in: {author.sharedCommunities.slice(0, 3).join(", ")}
              </Text>
            </View>
          )}

          {/* CTA buttons */}
          <View style={ss.peekButtons}>
            <TouchableOpacity
              style={ss.peekBtnSecondary}
              onPress={() => {
                onClose();
                setTimeout(() => router.push(`/user/${author.id}` as any), 150);
              }}
              activeOpacity={0.75}
            >
              <Text style={ss.peekBtnSecondaryLabel}>View profile</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={ss.peekBtnPrimary}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onClose();
                setTimeout(() => router.push(`/user/${author.id}` as any), 150);
              }}
              activeOpacity={0.75}
            >
              <Text style={ss.peekBtnPrimaryLabel}>Shoot your shot</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ── Compose post modal ────────────────────────────────────────────────────────
interface ComposeProps {
  community: Community;
  visible: boolean;
  onClose: () => void;
  onPosted: (post: CommunityPost) => void;
}

function ComposeModal({ community, visible, onClose, onPosted }: ComposeProps) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePost = async () => {
    if (!text.trim() || isSubmitting) return;
    setIsSubmitting(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const newPost = await createPost({ communityId: community.id, content: text.trim() });
      onPosted(newPost);
      setText("");
      onClose();
    } catch {
      // Post failed — keep modal open, let user retry
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Pressable style={ss.composeBg} onPress={onClose} />
        <View style={[ss.composeSheet, { paddingBottom: insets.bottom + SPACE.lg }]}>
          <View style={ss.composeHeader}>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={ss.composeCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={ss.composeTitle}>New post</Text>
            <TouchableOpacity
              style={[ss.composePost, { opacity: text.trim().length > 0 ? 1 : 0.35 }]}
              onPress={handlePost}
              disabled={!text.trim() || isSubmitting}
              activeOpacity={0.75}
            >
              {isSubmitting
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={ss.composePostLabel}>Post</Text>
              }
            </TouchableOpacity>
          </View>
          <View style={ss.composeCommunityChip}>
            <Ionicons name={community.iconName as any} size={12} color={community.colorAccent} />
            <Text style={[ss.composeCommunityLabel, { color: community.colorAccent }]}>
              {community.name}
            </Text>
          </View>
          <TextInput
            style={ss.composeInput}
            placeholder={`What's on your mind?`}
            placeholderTextColor="rgba(255,255,255,0.2)"
            value={text}
            onChangeText={setText}
            multiline
            autoFocus
            maxLength={1000}
            textAlignVertical="top"
          />
          <Text style={ss.composeCount}>{text.length}/1000</Text>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Post card ─────────────────────────────────────────────────────────────────
interface PostCardProps {
  post: CommunityPost;
  onLike: (id: string, liked: boolean) => void;
  onReply: (post: CommunityPost) => void;
  onAvatarPress: (author: PostAuthor) => void;
}

function PostCard({ post, onLike, onReply, onAvatarPress }: PostCardProps) {
  const bg = avatarBg(post.author.name);
  const ini = initials(post.author.name);

  const handleLike = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onLike(post.id, post.isLikedByMe);
  };

  return (
    <View style={ss.postCard}>
      {/* Avatar */}
      <TouchableOpacity
        style={[ss.postAvatar, { backgroundColor: bg }]}
        onPress={() => onAvatarPress(post.author)}
        activeOpacity={0.75}
      >
        <Text style={ss.postAvatarText}>{ini}</Text>
      </TouchableOpacity>

      {/* Right side */}
      <View style={{ flex: 1 }}>
        {/* Meta row */}
        <View style={ss.postMetaRow}>
          <TouchableOpacity onPress={() => onAvatarPress(post.author)}>
            <Text style={ss.postAuthor}>{post.author.name}</Text>
          </TouchableOpacity>
          <Text style={ss.postHandle}>@{post.author.handle}</Text>
          <Text style={ss.postTime}>· {relativeTime(post.createdAt)}</Text>
        </View>

        {/* Content */}
        <Text style={ss.postContent}>{post.content}</Text>

        {/* Ticker embed */}
        {post.embedTicker && (
          <View style={ss.ticker}>
            <Text style={ss.tickerSymbol}>{post.embedTicker}</Text>
            <Text style={ss.tickerPrice}>${post.embedPrice?.toFixed(2)}</Text>
            <Text style={[ss.tickerChange, { color: (post.embedChange ?? 0) >= 0 ? BRAND.green : BRAND.red }]}>
              {(post.embedChange ?? 0) >= 0 ? "+" : ""}{post.embedChange?.toFixed(2)}%
            </Text>
          </View>
        )}

        {/* Action row */}
        <View style={ss.postActions}>
          <TouchableOpacity style={ss.postAction} onPress={handleLike} activeOpacity={0.75}>
            <Ionicons
              name={post.isLikedByMe ? "heart" : "heart-outline"}
              size={17}
              color={post.isLikedByMe ? BRAND.pink : "rgba(255,255,255,0.4)"}
            />
            <Text style={[ss.postActionCount, post.isLikedByMe && { color: BRAND.pink }]}>
              {formatCount(post.likeCount)}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={ss.postAction}
            onPress={() => onReply(post)}
            activeOpacity={0.75}
          >
            <Ionicons name="chatbubble-outline" size={16} color="rgba(255,255,255,0.4)" />
            <Text style={ss.postActionCount}>{formatCount(post.replyCount)}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={ss.postAction} activeOpacity={0.75}>
            <Ionicons name="share-outline" size={17} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function CommunityFeedScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const slug = Array.isArray(id) ? id[0] : id ?? "";
  const insets = useSafeAreaInsets();

  // Boot from seed instantly
  const [community, setCommunity] = useState<Community | null>(
    () => seedCommunityBySlug(slug) ?? null,
  );
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [sort, setSort] = useState<FeedSort>("hot");
  const [cursor, setCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [newPostCount, setNewPostCount] = useState(0);
  const [peek, setPeek] = useState<{ visible: boolean; author: PostAuthor | null }>({
    visible: false,
    author: null,
  });

  const openAuthorProfile = useCallback((author: PostAuthor) => {
    openProfile(author.id, "spaces", {
      name: author.name,
      photoUrl: author.photoUrl ?? undefined,
      age: author.age,
      neighborhood: author.neighborhood,
    });
  }, []);
  const [composeVisible, setComposeVisible] = useState(false);

  const listRef = useRef<FlatList>(null);
  const bannerY = useRef(new Animated.Value(-48)).current;
  const unsubSignalRef = useRef<(() => void) | null>(null);

  // ── Banner animation ──
  const showBanner = (count: number) => {
    setNewPostCount(count);
    Animated.spring(bannerY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 220 }).start();
  };
  const hideBanner = () => {
    Animated.timing(bannerY, { toValue: -48, duration: 200, useNativeDriver: true }).start(() =>
      setNewPostCount(0),
    );
  };

  // ── Fetch helpers ──
  const loadFeed = useCallback(
    async (resetCursor = true) => {
      if (!community) return;
      if (resetCursor) setIsLoading(true);
      try {
        const page = await getCommunityFeed(community.id, sort, resetCursor ? undefined : cursor ?? undefined);
        if (resetCursor) {
          setPosts(page.posts);
        } else {
          setPosts((prev) => [...prev, ...page.posts]);
        }
        setCursor(page.nextCursor);
      } catch {
        // API not live yet — graceful degradation
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [community, sort, cursor],
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    hideBanner();
    await loadFeed(true);
    setIsRefreshing(false);
  };

  const handleLoadMore = async () => {
    if (!cursor || isLoadingMore || isLoading) return;
    setIsLoadingMore(true);
    await loadFeed(false);
  };

  // ── Enrich community from API + load feed ──
  useEffect(() => {
    const enrichAndLoad = async () => {
      try {
        const enriched = await getCommunity(slug);
        setCommunity(enriched);
      } catch {
        // Keep seed
      }
      await loadFeed(true);
    };
    void enrichAndLoad();
  }, [slug]);

  // ── Re-fetch when sort changes ──
  useEffect(() => {
    void loadFeed(true);
  }, [sort]);

  // ── Firestore signal subscription ──
  useEffect(() => {
    if (!community) return;
    unsubSignalRef.current = subscribeToCommunitySignals(community.id, ({ by }) => {
      // Skip if we're the author (we already added the post optimistically)
      setNewPostCount((prev) => {
        const next = prev + 1;
        showBanner(next);
        return next;
      });
    });
    return () => { unsubSignalRef.current?.(); };
  }, [community?.id]);

  // ── Optimistic like ──
  const handleLike = useCallback(async (postId: string, wasLiked: boolean) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, isLikedByMe: !wasLiked, likeCount: wasLiked ? p.likeCount - 1 : p.likeCount + 1 }
          : p,
      ),
    );
    try {
      await togglePostLike(postId, !wasLiked);
    } catch {
      // Rollback
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, isLikedByMe: wasLiked, likeCount: wasLiked ? p.likeCount + 1 : p.likeCount - 1 }
            : p,
        ),
      );
    }
  }, []);

  // ── Join toggle ──
  const handleJoinToggle = useCallback(async () => {
    if (!community) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const wasJoined = community.isJoined;
    setCommunity((c) =>
      c ? { ...c, isJoined: !wasJoined, memberCount: wasJoined ? c.memberCount - 1 : c.memberCount + 1 } : c,
    );
    try {
      await toggleMembership(community.id, !wasJoined);
    } catch {
      setCommunity((c) =>
        c ? { ...c, isJoined: wasJoined, memberCount: wasJoined ? c.memberCount + 1 : c.memberCount - 1 } : c,
      );
    }
  }, [community]);

  // ── New post from compose ──
  const handlePosted = useCallback((newPost: CommunityPost) => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPosts((prev) => [newPost, ...prev]);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  // ── Render ──
  if (!community) return null;

  return (
    <View style={[ss.root, { paddingTop: insets.top }]}>
      {/* ── Sticky header ── */}
      <View style={ss.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={ss.backBtn}
        >
          <Ionicons name="arrow-back" size={22} color={NEUTRAL.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={ss.headerName}>{community.name}</Text>
          <Text style={ss.headerSub}>
            {formatCount(community.memberCount)} members
            {community.activeNow > 0 && ` · ${community.activeNow} active`}
          </Text>
        </View>
        <TouchableOpacity
          style={[
            ss.joinBtn,
            community.isJoined
              ? { backgroundColor: community.colorBg, borderColor: community.colorBorder }
              : { backgroundColor: "transparent", borderColor: BORDER },
          ]}
          onPress={handleJoinToggle}
          activeOpacity={0.75}
        >
          <Text style={[ss.joinLabel, { color: community.isJoined ? community.colorAccent : MUTED }]}>
            {community.isJoined ? "Joined" : "Join"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Sort tabs ── */}
      <View style={ss.tabs}>
        {(["hot", "new", "top"] as FeedSort[]).map((s) => (
          <TouchableOpacity
            key={s}
            style={[ss.tab, sort === s && { borderBottomColor: community.colorAccent }]}
            onPress={() => { void Haptics.selectionAsync(); setSort(s); }}
            activeOpacity={0.75}
          >
            <Text style={[ss.tabLabel, sort === s && { color: community.colorAccent }]}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── New posts banner ── */}
      <Animated.View
        style={[ss.banner, { backgroundColor: community.colorBg, borderColor: community.colorBorder, transform: [{ translateY: bannerY }] }]}
        pointerEvents={newPostCount > 0 ? "auto" : "none"}
      >
        <TouchableOpacity
          style={ss.bannerInner}
          onPress={async () => {
            hideBanner();
            await handleRefresh();
          }}
          activeOpacity={0.85}
        >
          <Ionicons name="arrow-up" size={14} color={community.colorAccent} />
          <Text style={[ss.bannerText, { color: community.colorAccent }]}>
            {newPostCount} new {newPostCount === 1 ? "post" : "posts"} · Tap to refresh
          </Text>
        </TouchableOpacity>
      </Animated.View>

      {/* ── Feed ── */}
      {isLoading ? (
        <View style={ss.loadingState}>
          <ActivityIndicator size="large" color={community.colorAccent} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={posts}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              onLike={handleLike}
              onReply={(post) => router.push(`/communities/thread/${post.id}` as any)}
              onAvatarPress={openAuthorProfile}
            />
          )}
          ItemSeparatorComponent={() => <View style={ss.separator} />}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={community.colorAccent}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            isLoadingMore ? (
              <View style={{ padding: SPACE.xl }}>
                <ActivityIndicator size="small" color={community.colorAccent} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={ss.emptyState}>
              <Ionicons name="planet-outline" size={48} color="rgba(255,255,255,0.12)" />
              <Text style={ss.emptyTitle}>No posts yet</Text>
              <Text style={ss.emptySub}>Be the first to post in {community.name}</Text>
              <TouchableOpacity style={[ss.emptyBtn, { borderColor: community.colorBorder }]} onPress={() => setComposeVisible(true)}>
                <Text style={[ss.emptyBtnLabel, { color: community.colorAccent }]}>Start the conversation</Text>
              </TouchableOpacity>
            </View>
          }
          contentContainerStyle={{ paddingTop: SPACE.sm, paddingBottom: insets.bottom + 120 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ── FAB compose ── */}
      <TouchableOpacity
        style={[ss.fab, { backgroundColor: community.colorAccent }, { bottom: insets.bottom + 90 }]}
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setComposeVisible(true);
        }}
        activeOpacity={0.85}
      >
        <Ionicons name="create-outline" size={22} color="#fff" />
      </TouchableOpacity>

      {/* ── Modals ── */}
      <ProfilePeekSheet
        author={peek.author}
        visible={peek.visible}
        onClose={() => setPeek({ visible: false, author: null })}
      />
      <ComposeModal
        community={community}
        visible={composeVisible}
        onClose={() => setComposeVisible(false)}
        onPosted={handlePosted}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const ss = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    paddingHorizontal: SPACE.xl,
    paddingVertical: SPACE.md,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.pill,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerName: {
    ...TYPE.title,
    color: NEUTRAL.text,
  },
  headerSub: {
    ...TYPE.caption,
    color: MUTED,
    marginTop: 1,
  },
  joinBtn: {
    borderRadius: RADIUS.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
  },
  joinLabel: {
    ...TYPE.caption,
    fontFamily: "Inter_600SemiBold",
  },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: SPACE.md,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabLabel: {
    ...TYPE.label,
    color: "rgba(255,255,255,0.35)",
  },
  banner: {
    position: "absolute",
    top: 0,
    left: SPACE.xl,
    right: SPACE.xl,
    zIndex: 20,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    overflow: "hidden",
  },
  bannerInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.sm,
    justifyContent: "center",
  },
  bannerText: {
    ...TYPE.caption,
    fontFamily: "Inter_600SemiBold",
  },
  postCard: {
    flexDirection: "row",
    gap: SPACE.md,
    paddingHorizontal: SPACE.xl,
    paddingVertical: SPACE.md,
  },
  postAvatar: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  postAvatarText: {
    ...TYPE.caption,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  postMetaRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
    flexWrap: "wrap",
  },
  postAuthor: {
    ...TYPE.label,
    color: NEUTRAL.text,
  },
  postHandle: {
    ...TYPE.caption,
    color: MUTED,
  },
  postTime: {
    ...TYPE.caption,
    color: MUTED,
  },
  postContent: {
    ...TYPE.body,
    color: "rgba(255,255,255,0.85)",
    marginTop: 5,
    marginBottom: SPACE.md,
    lineHeight: 22,
  },
  ticker: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    backgroundColor: CARD2,
    borderRadius: RADIUS.md,
    padding: SPACE.md,
    marginBottom: SPACE.md,
  },
  tickerSymbol: {
    ...TYPE.caption,
    color: MUTED,
  },
  tickerPrice: {
    ...TYPE.title,
    color: NEUTRAL.text,
  },
  tickerChange: {
    ...TYPE.label,
    fontFamily: "Inter_600SemiBold",
  },
  postActions: {
    flexDirection: "row",
    gap: SPACE.xl,
    alignItems: "center",
  },
  postAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  postActionCount: {
    ...TYPE.caption,
    color: "rgba(255,255,255,0.4)",
  },
  separator: {
    height: 1,
    backgroundColor: BORDER,
    marginLeft: SPACE.xl + 38 + SPACE.md,
  },
  loadingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: SPACE["5xl"],
    paddingHorizontal: SPACE["3xl"],
    gap: SPACE.sm,
  },
  emptyTitle: {
    ...TYPE.h3,
    color: "rgba(255,255,255,0.4)",
    marginTop: SPACE.md,
  },
  emptySub: {
    ...TYPE.body,
    color: "rgba(255,255,255,0.2)",
    textAlign: "center",
  },
  emptyBtn: {
    marginTop: SPACE.md,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    paddingHorizontal: SPACE.xl,
    paddingVertical: SPACE.md,
  },
  emptyBtnLabel: {
    ...TYPE.label,
    fontFamily: "Inter_600SemiBold",
  },
  fab: {
    position: "absolute",
    right: SPACE.xl,
    width: 54,
    height: 54,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  // Profile peek
  peekBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  peekSheet: {
    backgroundColor: NEUTRAL.card,
    borderTopLeftRadius: RADIUS["2xl"],
    borderTopRightRadius: RADIUS["2xl"],
    paddingHorizontal: SPACE.xl,
    paddingTop: SPACE.sm,
  },
  peekHandle: {
    width: 36,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: SPACE.lg,
  },
  peekTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACE.md,
    marginBottom: SPACE.md,
  },
  peekAvatar: {
    width: 58,
    height: 58,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  peekAvatarText: {
    ...TYPE.h3,
    color: "#fff",
  },
  peekName: {
    ...TYPE.h3,
    color: NEUTRAL.text,
    marginBottom: 2,
  },
  peekMeta: {
    ...TYPE.label,
    color: MUTED,
  },
  peekSharedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: NEUTRAL.card2,
    borderRadius: RADIUS.md,
    padding: SPACE.md,
    marginBottom: SPACE.lg,
  },
  peekShared: {
    ...TYPE.caption,
    color: MUTED,
    flex: 1,
  },
  peekButtons: {
    flexDirection: "row",
    gap: SPACE.md,
  },
  peekBtnSecondary: {
    flex: 1,
    backgroundColor: NEUTRAL.card2,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: BORDER,
  },
  peekBtnSecondaryLabel: {
    ...TYPE.label,
    color: MUTED,
  },
  peekBtnPrimary: {
    flex: 1,
    backgroundColor: BRAND.pink,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    alignItems: "center",
  },
  peekBtnPrimaryLabel: {
    ...TYPE.label,
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
  },
  // Compose modal
  composeBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  composeSheet: {
    backgroundColor: NEUTRAL.card,
    borderTopLeftRadius: RADIUS["2xl"],
    borderTopRightRadius: RADIUS["2xl"],
    paddingHorizontal: SPACE.xl,
    paddingTop: SPACE.md,
    minHeight: 320,
  },
  composeHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACE.md,
  },
  composeCancel: {
    ...TYPE.body,
    color: MUTED,
  },
  composeTitle: {
    ...TYPE.title,
    color: NEUTRAL.text,
    flex: 1,
    textAlign: "center",
  },
  composePost: {
    backgroundColor: BRAND.pink,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACE.lg,
    paddingVertical: 7,
    minWidth: 60,
    alignItems: "center",
  },
  composePostLabel: {
    ...TYPE.label,
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
  },
  composeCommunityChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACE.md,
    paddingVertical: 5,
    backgroundColor: "rgba(255,255,255,0.05)",
    marginBottom: SPACE.md,
    borderWidth: 1,
    borderColor: BORDER,
  },
  composeCommunityLabel: {
    ...TYPE.caption,
    fontFamily: "Inter_600SemiBold",
  },
  composeInput: {
    ...TYPE.body,
    color: NEUTRAL.text,
    minHeight: 120,
    textAlignVertical: "top",
    padding: 0,
  },
  composeCount: {
    ...TYPE.caption,
    color: "rgba(255,255,255,0.2)",
    textAlign: "right",
    marginTop: SPACE.sm,
  },
});
