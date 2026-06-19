/**
 * communitiesApi.ts
 * Client service for ConnectSphere Communities.
 *
 * Architecture:
 *   ✓ Postgres (via Express API) = source of truth for all post content
 *   ✓ Firestore = real-time "new post" bump signals only (no data stored there)
 *   ✓ SEED_COMMUNITIES = instant skeleton data so screens never blank-flash
 *
 * DB tables (server-side, Drizzle / Postgres):
 *   communities, community_members, community_posts,
 *   community_replies, community_post_likes, community_reply_likes
 *
 * API endpoints:
 *   GET    /api/communities                              list all (joined first)
 *   GET    /api/communities/:slug                        single community
 *   POST   /api/communities                              create community
 *   POST   /api/communities/:id/membership               join
 *   DELETE /api/communities/:id/membership               leave
 *   GET    /api/communities/:id/posts?sort=hot&cursor=   paginated feed
 *   POST   /api/communities/posts                        create post
 *   GET    /api/communities/posts/:id                    single post
 *   POST   /api/communities/posts/:id/like               like
 *   DELETE /api/communities/posts/:id/like               unlike
 *   GET    /api/communities/posts/:id/replies            replies
 *   POST   /api/communities/posts/:id/replies            create reply
 *   POST   /api/communities/replies/:id/like             like reply
 *   DELETE /api/communities/replies/:id/like             unlike reply
 */
import { customFetch } from "@workspace/api-client-react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Community {
  id: string;
  slug: string;
  name: string;
  description: string;
  iconName: string;          // Ionicons glyph name (e.g. "trending-up-outline")
  colorAccent: string;       // e.g. "#9b5cff"
  colorBg: string;           // darker bg tint, e.g. "#1e1240"
  colorBorder: string;       // border color, e.g. "#6b3ff7"
  memberCount: number;
  postCountToday: number;
  activeNow: number;         // real-time presence count (from Firestore)
  isJoined: boolean;
  createdBy: string | null;  // null = official seed community
  createdAt: string;
}

export interface PostAuthor {
  id: string;
  name: string;
  handle: string;
  photoUrl: string | null;
  age: number;
  neighborhood: string;
  sharedCommunities: string[]; // names of communities both users are in
}

export interface CommunityPost {
  id: string;
  communityId: string;
  author: PostAuthor;
  content: string;
  mediaUrl: string | null;
  likeCount: number;
  replyCount: number;
  isLikedByMe: boolean;
  isPinned: boolean;
  embedTicker?: string;   // e.g. "$NVDA" — if post mentions a ticker, show mini card
  embedPrice?: number;
  embedChange?: number;
  createdAt: string;
}

export interface CommunityReply {
  id: string;
  postId: string;
  parentReplyId: string | null;
  author: PostAuthor;
  content: string;
  likeCount: number;
  isLikedByMe: boolean;
  isOp: boolean;           // true if this author also authored the original post
  createdAt: string;
}

export type FeedSort = "hot" | "new" | "top";

export interface FeedPage {
  posts: CommunityPost[];
  nextCursor: string | null;
}

// ── Seed data (instant render — no loading flash) ─────────────────────────────

export const SEED_COMMUNITIES: Community[] = [
  {
    id: "c_trading",
    slug: "trading",
    name: "Trading Room",
    description: "Stocks, crypto & options talk",
    iconName: "trending-up-outline",
    colorAccent: "#9b5cff",
    colorBg: "#1e1240",
    colorBorder: "#6b3ff7",
    memberCount: 2341,
    postCountToday: 148,
    activeNow: 0,
    isJoined: false,
    createdBy: null,
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "c_beauty",
    slug: "beauty",
    name: "Beauty & Style",
    description: "Skincare, makeup & fashion inspo",
    iconName: "star-outline",
    colorAccent: "#FF2DA8",
    colorBg: "#1e0a1a",
    colorBorder: "#9c1a6e",
    memberCount: 1842,
    postCountToday: 93,
    activeNow: 0,
    isJoined: false,
    createdBy: null,
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "c_miami_eats",
    slug: "miami-eats",
    name: "Miami Eats",
    description: "Best spots, new openings & home cooks",
    iconName: "restaurant-outline",
    colorAccent: "#f97316",
    colorBg: "#1e1208",
    colorBorder: "#9a3d0c",
    memberCount: 4102,
    postCountToday: 221,
    activeNow: 0,
    isJoined: false,
    createdBy: null,
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "c_miami_scene",
    slug: "miami-scene",
    name: "Miami Scene",
    description: "Events, nightlife & local vibes",
    iconName: "location-outline",
    colorAccent: "#22D3EE",
    colorBg: "#081e20",
    colorBorder: "#0e7a8a",
    memberCount: 3218,
    postCountToday: 187,
    activeNow: 0,
    isJoined: false,
    createdBy: null,
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "c_show_talk",
    slug: "show-talk",
    name: "Show Talk",
    description: "TV, streaming & film reactions",
    iconName: "tv-outline",
    colorAccent: "#F59E0B",
    colorBg: "#1e1508",
    colorBorder: "#9a6f0c",
    memberCount: 2719,
    postCountToday: 165,
    activeNow: 0,
    isJoined: false,
    createdBy: null,
    createdAt: "2024-01-01T00:00:00Z",
  },
];

/** Look up a seed community by slug for instant screen boot. */
export function seedCommunityBySlug(slug: string): Community | undefined {
  return SEED_COMMUNITIES.find((c) => c.slug === slug);
}

/** Format member count for display: 2341 → "2.3k" */
export function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/** Relative time string: "12m", "2h", "1d" */
export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

// ── API calls ─────────────────────────────────────────────────────────────────

export async function listCommunities(): Promise<Community[]> {
  return customFetch<Community[]>("/api/communities");
}

export async function getCommunity(slug: string): Promise<Community> {
  return customFetch<Community>(`/api/communities/${encodeURIComponent(slug)}`);
}

export async function toggleMembership(
  communityId: string,
  join: boolean,
): Promise<void> {
  return customFetch(
    `/api/communities/${encodeURIComponent(communityId)}/membership`,
    { method: join ? "POST" : "DELETE" },
  );
}

export async function getCommunityFeed(
  communityId: string,
  sort: FeedSort = "hot",
  cursor?: string,
): Promise<FeedPage> {
  const params = new URLSearchParams({ sort });
  if (cursor) params.set("cursor", cursor);
  return customFetch<FeedPage>(
    `/api/communities/${encodeURIComponent(communityId)}/posts?${params}`,
  );
}

export async function getPost(postId: string): Promise<CommunityPost> {
  return customFetch<CommunityPost>(
    `/api/communities/posts/${encodeURIComponent(postId)}`,
  );
}

export async function getReplies(postId: string): Promise<CommunityReply[]> {
  return customFetch<CommunityReply[]>(
    `/api/communities/posts/${encodeURIComponent(postId)}/replies`,
  );
}

export async function createPost(payload: {
  communityId: string;
  content: string;
  mediaUrl?: string;
}): Promise<CommunityPost> {
  return customFetch<CommunityPost>("/api/communities/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function createReply(payload: {
  postId: string;
  parentReplyId?: string;
  content: string;
}): Promise<CommunityReply> {
  return customFetch<CommunityReply>(
    `/api/communities/posts/${encodeURIComponent(payload.postId)}/replies`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
}

export async function togglePostLike(
  postId: string,
  like: boolean,
): Promise<void> {
  return customFetch(
    `/api/communities/posts/${encodeURIComponent(postId)}/like`,
    { method: like ? "POST" : "DELETE" },
  );
}

export async function toggleReplyLike(
  replyId: string,
  like: boolean,
): Promise<void> {
  return customFetch(
    `/api/communities/replies/${encodeURIComponent(replyId)}/like`,
    { method: like ? "POST" : "DELETE" },
  );
}

export async function createCommunity(payload: {
  name: string;
  description: string;
  slug: string;
  iconName: string;
  colorAccent: string;
  colorBg: string;
  colorBorder: string;
}): Promise<Community> {
  return customFetch<Community>("/api/communities", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
