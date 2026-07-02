/**
 * Community Thread Screen
 * ─────────────────────────────────────────────────────────────────────────────
 * Route: /communities/thread/:postId
 *
 * Features:
 *   ✓ Original post pinned at top (full content, all stats)
 *   ✓ OP badge on replies from the original poster
 *   ✓ Threaded replies (2-level: root + nested)
 *   ✓ Optimistic reply submission (optimistic insert → confirm from server)
 *   ✓ Optimistic like/unlike on both post and replies
 *   ✓ Avatar tap → ProfilePeekSheet (View Profile | Shoot Your Shot)
 *   ✓ Reply-to-reply: tap "Reply" on any reply → prefills @handle in composer
 *   ✓ Keyboard-aware reply composer (sticky bottom, KeyboardAvoidingView)
 *   ✓ Pull-to-refresh for new replies
 *   ✓ Haptics throughout
 *
 * Navigation:
 *   ← back to community feed (router.back())
 *   → user profile: /user/:userId
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
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

import { BRAND, NEUTRAL, RADIUS, SPACE, TYPE } from "@/constants/tokens";
import { openProfile } from "@/lib/routes";
import {
  CommunityPost,
  CommunityReply,
  PostAuthor,
  createReply,
  formatCount,
  getPost,
  getReplies,
  relativeTime,
  togglePostLike,
  toggleReplyLike,
} from "@/services/communitiesApi";

// ── Design tokens ─────────────────────────────────────────────────────────────
const BG     = NEUTRAL.bg;
const CARD   = NEUTRAL.card;
const CARD2  = NEUTRAL.card2;
const BORDER = "rgba(255,255,255,0.08)";
const MUTED  = NEUTRAL.textMuted;

// ── Avatar helpers ────────────────────────────────────────────────────────────
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
interface PeekProps {
  author: PostAuthor | null;
  visible: boolean;
  onClose: () => void;
}

function ProfilePeekSheet({ author, visible, onClose }: PeekProps) {
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
          <View style={ss.peekHandle} />
          <View style={ss.peekTop}>
            <View style={[ss.peekAvatar, { backgroundColor: bg }]}>
              <Text style={ss.peekAvatarText}>{ini}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={ss.peekName}>{author.name}, {author.age}</Text>
              <Text style={ss.peekMeta}>{author.neighborhood} · Miami</Text>
            </View>
          </View>
          {author.sharedCommunities.length > 0 && (
            <View style={ss.peekSharedRow}>
              <Ionicons name="planet-outline" size={13} color={MUTED} />
              <Text style={ss.peekShared}>
                Also in: {author.sharedCommunities.slice(0, 3).join(", ")}
              </Text>
            </View>
          )}
          <View style={ss.peekButtons}>
            <TouchableOpacity
              style={ss.peekBtnSecondary}
              onPress={() => {
                onClose();
                setTimeout(() => router.push({ pathname: "/user/[userId]", params: { userId: author.id } } as any), 150);
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
                setTimeout(() => router.push({ pathname: "/user/[userId]", params: { userId: author.id } } as any), 150);
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

// ── Reply item ────────────────────────────────────────────────────────────────
interface ReplyItemProps {
  reply: CommunityReply;
  isNested: boolean;
  onLike: (id: string, wasLiked: boolean) => void;
  onReplyTo: (handle: string, id: string) => void;
  onAvatarPress: (author: PostAuthor) => void;
}

function ReplyItem({ reply, isNested, onLike, onReplyTo, onAvatarPress }: ReplyItemProps) {
  const bg = avatarBg(reply.author.name);
  const ini = initials(reply.author.name);

  return (
    <View style={[ss.replyRow, isNested && ss.replyNested]}>
      {/* Thread line for nested */}
      {isNested && <View style={ss.threadLine} />}

      {/* Avatar */}
      <TouchableOpacity
        style={[ss.replyAvatar, { backgroundColor: bg }, isNested && { width: 28, height: 28 }]}
        onPress={() => onAvatarPress(reply.author)}
        activeOpacity={0.75}
      >
        <Text style={[ss.replyAvatarText, isNested && { fontSize: 9 }]}>{ini}</Text>
      </TouchableOpacity>

      {/* Content */}
      <View style={{ flex: 1 }}>
        <View style={ss.replyMeta}>
          <TouchableOpacity onPress={() => onAvatarPress(reply.author)}>
            <Text style={ss.replyAuthor}>{reply.author.name}</Text>
          </TouchableOpacity>
          {reply.isOp && (
            <View style={ss.opBadge}>
              <Text style={ss.opLabel}>OP</Text>
            </View>
          )}
          <Text style={ss.replyTime}>{relativeTime(reply.createdAt)}</Text>
        </View>
        <Text style={ss.replyContent}>{reply.content}</Text>
        <View style={ss.replyActions}>
          <TouchableOpacity
            style={ss.replyAction}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onLike(reply.id, reply.isLikedByMe);
            }}
            activeOpacity={0.75}
          >
            <Ionicons
              name={reply.isLikedByMe ? "heart" : "heart-outline"}
              size={14}
              color={reply.isLikedByMe ? BRAND.pink : "rgba(255,255,255,0.35)"}
            />
            <Text style={[ss.replyActionCount, reply.isLikedByMe && { color: BRAND.pink }]}>
              {reply.likeCount}
            </Text>
          </TouchableOpacity>
          {!isNested && (
            <TouchableOpacity
              style={ss.replyAction}
              onPress={() => onReplyTo(reply.author.handle, reply.id)}
              activeOpacity={0.75}
            >
              <Text style={ss.replyActionLabel}>Reply</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

// ── Original post (header) ────────────────────────────────────────────────────
interface OriginalPostProps {
  post: CommunityPost;
  onLike: (id: string, wasLiked: boolean) => void;
  onAvatarPress: (author: PostAuthor) => void;
}

function OriginalPost({ post, onLike, onAvatarPress }: OriginalPostProps) {
  const bg = avatarBg(post.author.name);
  const ini = initials(post.author.name);
  return (
    <View style={ss.opPost}>
      <View style={ss.opPostHeader}>
        <TouchableOpacity
          style={[ss.opAvatar, { backgroundColor: bg }]}
          onPress={() => onAvatarPress(post.author)}
          activeOpacity={0.75}
        >
          <Text style={ss.opAvatarText}>{ini}</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={ss.opAuthorName}>{post.author.name}</Text>
          <Text style={ss.opAuthorMeta}>@{post.author.handle} · {relativeTime(post.createdAt)}</Text>
        </View>
      </View>
      <Text style={ss.opContent}>{post.content}</Text>
      {post.embedTicker && (
        <View style={ss.ticker}>
          <Text style={ss.tickerSymbol}>{post.embedTicker}</Text>
          <Text style={ss.tickerPrice}>${post.embedPrice?.toFixed(2)}</Text>
          <Text style={[ss.tickerChange, { color: (post.embedChange ?? 0) >= 0 ? BRAND.green : BRAND.red }]}>
            {(post.embedChange ?? 0) >= 0 ? "+" : ""}{post.embedChange?.toFixed(2)}%
          </Text>
        </View>
      )}
      <View style={ss.opStats}>
        <TouchableOpacity
          style={ss.opStatBtn}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onLike(post.id, post.isLikedByMe);
          }}
          activeOpacity={0.75}
        >
          <Ionicons
            name={post.isLikedByMe ? "heart" : "heart-outline"}
            size={19}
            color={post.isLikedByMe ? BRAND.pink : "rgba(255,255,255,0.4)"}
          />
          <Text style={[ss.opStatCount, post.isLikedByMe && { color: BRAND.pink }]}>
            {formatCount(post.likeCount)}
          </Text>
        </TouchableOpacity>
        <View style={ss.opStatBtn}>
          <Ionicons name="chatbubble-outline" size={18} color={BRAND.purple} />
          <Text style={[ss.opStatCount, { color: BRAND.purple }]}>{formatCount(post.replyCount)}</Text>
        </View>
        <TouchableOpacity
          style={ss.opStatBtn}
          activeOpacity={0.75}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            void Share.share({
              message: `"${post.content}" — @${post.author.handle} on ConnectSphere`,
            }).catch(() => {});
          }}
        >
          <Ionicons name="share-outline" size={18} color="rgba(255,255,255,0.4)" />
        </TouchableOpacity>
      </View>
      <View style={ss.opDivider} />
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ThreadScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const pid = Array.isArray(postId) ? postId[0] : postId ?? "";
  const insets = useSafeAreaInsets();

  const [post, setPost] = useState<CommunityPost | null>(null);
  const [replies, setReplies] = useState<CommunityReply[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyingTo, setReplyingTo] = useState<{ handle: string; id: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [peek, setPeek] = useState<{ visible: boolean; author: PostAuthor | null }>({
    visible: false,
    author: null,
  });

  const openAuthorProfile = useCallback((author: PostAuthor) => {
    openProfile(author.id, "spaces-thread", {
      name: author.name,
      photoUrl: author.photoUrl ?? undefined,
      age: author.age,
      neighborhood: author.neighborhood,
    });
  }, []);

  const inputRef = useRef<TextInput>(null);
  const listRef = useRef<FlatList>(null);

  // ── Load ──
  const load = useCallback(async () => {
    try {
      const [fetchedPost, fetchedReplies] = await Promise.all([
        getPost(pid),
        getReplies(pid),
      ]);
      setPost(fetchedPost);
      setReplies(fetchedReplies);
    } catch {
      // Graceful degradation
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [pid]);

  useEffect(() => { void load(); }, [load]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    void load();
  };

  // ── Optimistic post like ──
  const handlePostLike = useCallback(async (postId: string, wasLiked: boolean) => {
    setPost((p) =>
      p ? { ...p, isLikedByMe: !wasLiked, likeCount: wasLiked ? p.likeCount - 1 : p.likeCount + 1 } : p,
    );
    try {
      await togglePostLike(postId, !wasLiked);
    } catch {
      setPost((p) =>
        p ? { ...p, isLikedByMe: wasLiked, likeCount: wasLiked ? p.likeCount + 1 : p.likeCount - 1 } : p,
      );
    }
  }, []);

  // ── Optimistic reply like ──
  const handleReplyLike = useCallback(async (replyId: string, wasLiked: boolean) => {
    setReplies((prev) =>
      prev.map((r) =>
        r.id === replyId
          ? { ...r, isLikedByMe: !wasLiked, likeCount: wasLiked ? r.likeCount - 1 : r.likeCount + 1 }
          : r,
      ),
    );
    try {
      await toggleReplyLike(replyId, !wasLiked);
    } catch {
      setReplies((prev) =>
        prev.map((r) =>
          r.id === replyId
            ? { ...r, isLikedByMe: wasLiked, likeCount: wasLiked ? r.likeCount + 1 : r.likeCount - 1 }
            : r,
        ),
      );
    }
  }, []);

  // ── Reply to reply ──
  const handleReplyTo = useCallback((handle: string, id: string) => {
    setReplyingTo({ handle, id });
    setReplyText(`@${handle} `);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  // ── Submit reply ──
  const handleSubmitReply = useCallback(async () => {
    if (!replyText.trim() || !post || isSubmitting) return;
    setIsSubmitting(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const optimisticReply: CommunityReply = {
      id: `optimistic_${Date.now()}`,
      postId: post.id,
      parentReplyId: replyingTo?.id ?? null,
      author: {
        id: "me",
        name: "You",
        handle: "me",
        photoUrl: null,
        age: 0,
        neighborhood: "Miami",
        sharedCommunities: [],
      },
      content: replyText.trim(),
      likeCount: 0,
      isLikedByMe: false,
      isOp: false,
      createdAt: new Date().toISOString(),
    };

    setReplies((prev) => [...prev, optimisticReply]);
    setPost((p) => p ? { ...p, replyCount: p.replyCount + 1 } : p);
    setReplyText("");
    setReplyingTo(null);
    // Scroll to bottom
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const confirmedReply = await createReply({
        postId: post.id,
        parentReplyId: replyingTo?.id,
        content: optimisticReply.content,
      });
      // Replace optimistic with confirmed
      setReplies((prev) =>
        prev.map((r) => (r.id === optimisticReply.id ? confirmedReply : r)),
      );
    } catch {
      // Remove optimistic on failure
      setReplies((prev) => prev.filter((r) => r.id !== optimisticReply.id));
      setPost((p) => p ? { ...p, replyCount: p.replyCount - 1 } : p);
    } finally {
      setIsSubmitting(false);
    }
  }, [replyText, post, replyingTo, isSubmitting]);

  // ── Build flat list items ──
  // Nested replies are shown directly under their parent (2-level threading)
  type ListItem =
    | { type: "reply"; reply: CommunityReply; nested: boolean }
    | { type: "header" };

  const listItems = useMemo<ListItem[]>(() => {
    const rootReplies = replies.filter((r) => !r.parentReplyId);
    const childMap = new Map<string, CommunityReply[]>();
    replies
      .filter((r) => r.parentReplyId)
      .forEach((r) => {
        const children = childMap.get(r.parentReplyId!) ?? [];
        children.push(r);
        childMap.set(r.parentReplyId!, children);
      });

    const items: ListItem[] = [{ type: "header" }];
    for (const root of rootReplies) {
      items.push({ type: "reply", reply: root, nested: false });
      const children = childMap.get(root.id) ?? [];
      for (const child of children) {
        items.push({ type: "reply", reply: child, nested: true });
      }
    }
    return items;
  }, [replies]);

  // ── Render ──
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: BG }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* ── Nav header ── */}
      <View style={[ss.navHeader, { paddingTop: insets.top + SPACE.sm }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={ss.backBtn}
        >
          <Ionicons name="arrow-back" size={22} color={NEUTRAL.text} />
        </TouchableOpacity>
        <Text style={ss.navTitle}>Thread</Text>
      </View>

      {/* ── Content ── */}
      {isLoading ? (
        <View style={ss.loadingState}>
          <ActivityIndicator size="large" color={BRAND.purple} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={listItems}
          keyExtractor={(item, idx) =>
            item.type === "header" ? "header" : item.reply.id + idx
          }
          renderItem={({ item }) => {
            if (item.type === "header") {
              return post ? (
                <OriginalPost
                  post={post}
                  onLike={handlePostLike}
                  onAvatarPress={openAuthorProfile}
                />
              ) : null;
            }
            return (
              <ReplyItem
                reply={item.reply}
                isNested={item.nested}
                onLike={handleReplyLike}
                onReplyTo={handleReplyTo}
                onAvatarPress={openAuthorProfile}
              />
            );
          }}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={BRAND.purple}
            />
          }
          ListEmptyComponent={
            !isLoading ? (
              <View style={ss.emptyReplies}>
                <Ionicons name="chatbubble-outline" size={36} color="rgba(255,255,255,0.12)" />
                <Text style={ss.emptyTitle}>No replies yet</Text>
                <Text style={ss.emptySub}>Start the conversation</Text>
              </View>
            ) : null
          }
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ── Sticky reply composer ── */}
      <View
        style={[
          ss.composer,
          { paddingBottom: insets.bottom + SPACE.sm },
        ]}
      >
        {replyingTo && (
          <View style={ss.replyingToBanner}>
            <Text style={ss.replyingToText}>Replying to @{replyingTo.handle}</Text>
            <TouchableOpacity
              onPress={() => { setReplyingTo(null); setReplyText(""); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={14} color={MUTED} />
            </TouchableOpacity>
          </View>
        )}
        <View style={ss.composerRow}>
          <TextInput
            ref={inputRef}
            style={ss.composerInput}
            placeholder="Add a reply..."
            placeholderTextColor="rgba(255,255,255,0.2)"
            value={replyText}
            onChangeText={setReplyText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[ss.sendBtn, { opacity: replyText.trim().length > 0 ? 1 : 0.35 }]}
            onPress={handleSubmitReply}
            disabled={!replyText.trim() || isSubmitting}
            activeOpacity={0.75}
          >
            {isSubmitting
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="arrow-up" size={18} color="#fff" />
            }
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Profile peek ── */}
      <ProfilePeekSheet
        author={peek.author}
        visible={peek.visible}
        onClose={() => setPeek({ visible: false, author: null })}
      />
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const ss = StyleSheet.create({
  navHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    paddingHorizontal: SPACE.xl,
    paddingBottom: SPACE.md,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: BG,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.pill,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  navTitle: {
    ...TYPE.title,
    color: NEUTRAL.text,
  },
  loadingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  // ── Original post ──
  opPost: {
    padding: SPACE.xl,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  opPostHeader: {
    flexDirection: "row",
    gap: SPACE.md,
    marginBottom: SPACE.md,
  },
  opAvatar: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  opAvatarText: {
    ...TYPE.label,
    color: "#fff",
    fontFamily: "Inter_700Bold",
  },
  opAuthorName: {
    ...TYPE.bodySemi,
    color: NEUTRAL.text,
  },
  opAuthorMeta: {
    ...TYPE.caption,
    color: MUTED,
    marginTop: 1,
  },
  opContent: {
    ...TYPE.body,
    color: "rgba(255,255,255,0.88)",
    lineHeight: 24,
    marginBottom: SPACE.lg,
  },
  ticker: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    backgroundColor: CARD2,
    borderRadius: RADIUS.md,
    padding: SPACE.md,
    marginBottom: SPACE.lg,
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
  opStats: {
    flexDirection: "row",
    gap: SPACE.xl,
    alignItems: "center",
  },
  opStatBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  opStatCount: {
    ...TYPE.body,
    color: "rgba(255,255,255,0.45)",
  },
  opDivider: {
    height: 1,
    backgroundColor: BORDER,
    marginTop: SPACE.lg,
  },
  // ── Replies ──
  replyRow: {
    flexDirection: "row",
    gap: SPACE.md,
    paddingHorizontal: SPACE.xl,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  replyNested: {
    paddingLeft: SPACE.xl + 38 + SPACE.md, // align under parent body
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  threadLine: {
    position: "absolute",
    left: SPACE.xl + 14,
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  replyAvatar: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  replyAvatarText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  replyMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  replyAuthor: {
    ...TYPE.label,
    color: NEUTRAL.text,
  },
  opBadge: {
    backgroundColor: "rgba(168,85,247,0.2)",
    borderRadius: RADIUS.xs,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  opLabel: {
    ...TYPE.micro,
    color: BRAND.purple,
  },
  replyTime: {
    ...TYPE.caption,
    color: MUTED,
  },
  replyContent: {
    ...TYPE.body,
    color: "rgba(255,255,255,0.78)",
    lineHeight: 21,
    marginTop: 4,
    marginBottom: 8,
  },
  replyActions: {
    flexDirection: "row",
    gap: SPACE.lg,
    alignItems: "center",
  },
  replyAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  replyActionCount: {
    ...TYPE.caption,
    color: "rgba(255,255,255,0.35)",
  },
  replyActionLabel: {
    ...TYPE.caption,
    color: "rgba(255,255,255,0.35)",
    fontFamily: "Inter_500Medium",
  },
  // ── Empty ──
  emptyReplies: {
    alignItems: "center",
    paddingVertical: SPACE["4xl"],
    gap: SPACE.sm,
  },
  emptyTitle: {
    ...TYPE.title,
    color: "rgba(255,255,255,0.35)",
    marginTop: SPACE.md,
  },
  emptySub: {
    ...TYPE.body,
    color: "rgba(255,255,255,0.2)",
  },
  // ── Composer ──
  composer: {
    backgroundColor: CARD,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingHorizontal: SPACE.xl,
    paddingTop: SPACE.md,
  },
  replyingToBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACE.sm,
  },
  replyingToText: {
    ...TYPE.caption,
    color: MUTED,
  },
  composerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: SPACE.sm,
  },
  composerInput: {
    flex: 1,
    ...TYPE.body,
    color: NEUTRAL.text,
    backgroundColor: CARD2,
    borderRadius: RADIUS.xl,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.md,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: BORDER,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.pill,
    backgroundColor: BRAND.purple,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  // ── Profile peek ──
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
});
