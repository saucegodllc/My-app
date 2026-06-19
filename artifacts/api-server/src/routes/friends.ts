import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { getAuth } from "@clerk/express";
import { and, eq } from "drizzle-orm";
import { Router } from "express";
import { db as appDb, blocksTable } from "@workspace/db";
import { sendConnectThreadPush, type ConnectPushKind } from "../lib/connectPushNotifications";
import { generateFriendIcebreakers, type FriendIcebreakerContext } from "../lib/friendsIcebreakers";
import { getPushToken } from "./notifications";
import { buildMatchThreadResponse, ensureMatchThread, type MatchOriginAction } from "../lib/matchThreads";
import { shouldUseLocalDbFallback } from "../launchGuards";

type FriendUser = {
  id: string;
  name: string;
  city: string;
  neighborhood: string;
  age?: number;
  photoUrl?: string;
  interests: string[];
  activityStyle: string[];
  energy: string;
  activeTonight?: boolean;
  accessibility: string[];
  safety: string[];
  familyFriendly: boolean;
  lgbtqFriendly: boolean;
  mutualConnections: string[];
};

type FriendPost = {
  id: string;
  userId: string;
  text: string;
  tag: string;
  imageUrl?: string;
  createdAt: string;
};

type ConnectionRequest = {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: "pending" | "accepted" | "ignored" | "canceled";
  message?: string;
  storyId?: string;
  planId?: string;
  kind?: "friend" | "story_reply" | "plan_invite" | "plan_join" | "group_invite";
  createdAt: string;
};

type Plan = {
  id: string;
  creatorUserId?: string;
  creatorId?: string;
  title: string;
  type: string;
  time?: string;
  timeLabel?: string;
  scheduledAt?: string;
  location?: string;
  visibility?: "friends_nearby";
  sourceType?: "map" | "event" | "custom";
  sourceId?: string;
  sourceName?: string;
  sourceImageUrl?: string;
  latitude?: number;
  longitude?: number;
  invitedUserIds?: string[];
  chatId?: string;
  createdAt: string;
};

type Chat = {
  id: string;
  type?: "double_date" | "opportunity" | "plan" | "dating_match" | "friend_direct" | "friend_plan";
  participantIds?: string[];
  title?: string;
  planId?: string;
  createdAt: string;
  isGroup?: boolean;
  groupPromotedAt?: string;
};

type Message = {
  id: string;
  chatId: string;
  senderId?: string;
  senderUserId: string;
  text: string;
  createdAt: string;
  system?: boolean;
};

type UserBehavior = {
  userId: string;
  searches: string[];
  likedTags: string[];
  clickedTags: string[];
  interactedUserIds: string[];
};

type FriendStory = {
  id: string;
  userId: string;
  type: "status" | "photo" | "plan_invite";
  text?: string;
  imageUrl?: string;
  planType?: string;
  planId?: string;
  expiresAt: string;
  createdAt: string;
};

type PlanJoinRequest = {
  id: string;
  planId: string;
  fromUserId: string;
  creatorId: string;
  status: "pending" | "accepted" | "declined" | "canceled";
  createdAt: string;
};

type FriendReaction = {
  id: string;
  fromUserId: string;
  toUserId: string;
  type: "friend_like" | "best_friend";
  status: "pending" | "matched" | "passed";
  createdAt: string;
  respondedAt?: string;
};

type FriendActionUsage = {
  id: string;
  userId: string;
  action: "friend_swipe" | "best_friend" | "friend_plan";
  dateKey: string;
  count: number;
  updatedAt: string;
};

type FriendInvite = {
  id: string;
  token: string;
  inviterUserId: string;
  createdAt: string;
  acceptedByUserId?: string;
  acceptedAt?: string;
};

type FriendReport = {
  id: string;
  userId: string;
  reportedUserId: string;
  reason?: string;
  context?: string;
  createdAt: string;
};

// ── ConnectSphere Inbox v2 types ─────────────────────────────────────────────

type CsReactionType = "spark" | "like" | "shot_reaction" | "plan_like" | "vibe_reaction";
type CsReactionStatus = "pending" | "liked_back" | "ignored" | "expired" | "converted_to_match";
type CsReactionSourceType = "profile" | "shot" | "plan";

type CsReaction = {
  id: string;
  senderId: string;
  receiverId: string;
  type: CsReactionType;
  sourceType: CsReactionSourceType;
  sourceId?: string;
  status: CsReactionStatus;
  isBlurredForReceiver: boolean;
  createdAt: string;
  convertedConversationId?: string;
  // Denormalized sender info for fast rendering
  senderName?: string;
  senderPhotoUrl?: string;
  senderAge?: number;
  senderNeighborhood?: string;
};

type CsRequestType = "plan_request" | "shot_request" | "chat_request" | "connect_request";
type CsRequestStatus = "pending" | "accepted" | "declined" | "expired" | "converted_to_chat";
type CsRequestSourceType = "shot" | "plan" | "profile";

type CsRequest = {
  id: string;
  senderId: string;
  receiverId: string;
  type: CsRequestType;
  sourceType: CsRequestSourceType;
  sourceId?: string;
  message?: string;
  status: CsRequestStatus;
  createdAt: string;
  acceptedAt?: string;
  convertedConversationId?: string;
  // Denormalized
  senderName?: string;
  senderPhotoUrl?: string;
  senderAge?: number;
  senderNeighborhood?: string;
  planTitle?: string;
};

type CsConversationType = "direct" | "plan" | "match" | "group";
type CsConversationCategory = "primary" | "archived";

type CsConversation = {
  id: string;
  participantIds: string[];
  type: CsConversationType;
  category: CsConversationCategory;
  status: "active" | "archived";
  sourceReactionId?: string;
  sourceRequestId?: string;
  hasMessages: boolean;
  createdAt: string;
  lastMessageAt?: string;
  lastMessageText?: string | null;
  lastMessageSenderId?: string;
  // Denormalized peer info (from the perspective of each participant, resolved at query time)
  peerId?: string;
  peerName?: string;
  peerPhotoUrl?: string;
};

type FriendsDb = {
  users: FriendUser[];
  friendPosts: FriendPost[];
  postComments: Array<{ id: string; postId: string; userId: string; text: string; createdAt: string }>;
  postLikes: Array<{ id: string; postId: string; userId: string; createdAt: string }>;
  connectionRequests: ConnectionRequest[];
  connections: Array<{ id: string; userAId: string; userBId: string; userIds?: [string, string]; chatId?: string; status?: string; createdAt: string }>;
  plans: Plan[];
  planMembers: Array<{ id: string; planId: string; userId: string; role: string }>;
  chats: Chat[];
  chatMembers: Array<{ id: string; chatId: string; userId: string }>;
  messages: Message[];
  userBehavior: UserBehavior[];
  friendStories?: FriendStory[];
  friendStoryReactions?: Array<{ id: string; storyId: string; userId: string; reaction: string; createdAt: string }>;
  planJoinRequests?: PlanJoinRequest[];
  userReports?: FriendReport[];
  datingMatches?: Array<{ id: string; userAId: string; userBId: string; createdAt: string; shotId?: string }>;
  doubleDatePairs?: Array<{ id: string; userIds: [string, string]; createdBy: string; status: "active" | "paused"; vibeTags: string[]; createdAt: string }>;
  doubleDateLikes?: Array<{ id: string; fromPairId: string; toPairId: string; type: "like" | "spark" | "shot"; createdAt: string }>;
  doubleDatePasses?: Array<{ id: string; fromPairId: string; toPairId: string; createdAt: string }>;
  doubleDateMatches?: Array<{ id: string; pairIds: [string, string]; userIds: [string, string, string, string]; chatId: string; createdAt: string }>;
  blockedUsers?: Array<{ id: string; userId: string; blockedUserId: string; createdAt: string }>;
  planShareLinks?: Array<{
    id: string;
    planId: string;
    token: string;
    createdByUserId: string;
    createdAt: string;
    revokedAt?: string;
  }>;
  planShareLinkRedemptions?: Array<{
    id: string;
    token: string;
    planId: string;
    userId: string;
    createdAt: string;
  }>;
  friendReactions?: FriendReaction[];
  friendActionUsage?: FriendActionUsage[];
  friendInvites?: FriendInvite[];
  // Inbox v2
  csReactions?: CsReaction[];
  csRequests?: CsRequest[];
  csConversations?: CsConversation[];
};

const router = Router();

async function ensureCanonicalBlock(blockerUserId: string, blockedUserId: string) {
  const [existing] = await appDb
    .select()
    .from(blocksTable)
    .where(and(eq(blocksTable.blockerUserId, blockerUserId), eq(blocksTable.blockedUserId, blockedUserId)))
    .limit(1);
  if (existing) return existing;

  const [created] = await appDb
    .insert(blocksTable)
    .values({
      id: randomUUID(),
      blockerUserId,
      blockedUserId,
    })
    .returning();
  return created;
}
const workspaceRoot = process.cwd().endsWith(join("artifacts", "api-server"))
  ? join(process.cwd(), "..", "..")
  : process.cwd();
const dbPath = join(workspaceRoot, "artifacts", "api-server", "db.json");

const seedUsers: FriendUser[] = [
  {
    id: "user-maya",
    name: "Maya Johnson",
    city: "Miami",
    neighborhood: "Brickell",
    interests: ["coffee", "design", "brunch", "walks"],
    activityStyle: ["low-pressure", "after-work", "small-group"],
    energy: "Exploring Miami",
    accessibility: ["accessible seating", "low-noise"],
    safety: ["public places", "group-friendly"],
    familyFriendly: false,
    lgbtqFriendly: true,
    mutualConnections: ["Ari", "Dev"],
  },
  {
    id: "user-omar",
    name: "Omar Ellis",
    city: "Miami",
    neighborhood: "Wynwood",
    interests: ["gym", "food", "music", "nightlife"],
    activityStyle: ["active", "evening", "group"],
    energy: "Looking for Plans",
    accessibility: ["step-free venues"],
    safety: ["public places"],
    familyFriendly: false,
    lgbtqFriendly: true,
    mutualConnections: ["Maya"],
  },
  {
    id: "user-nina",
    name: "Nina Patel",
    city: "Miami",
    neighborhood: "Coral Gables",
    interests: ["family plans", "parks", "learning", "food"],
    activityStyle: ["daytime", "calm", "planned"],
    energy: "Chill Mode",
    accessibility: ["accessible seating", "low-noise", "shade"],
    safety: ["family-friendly", "public places"],
    familyFriendly: true,
    lgbtqFriendly: true,
    mutualConnections: [],
  },
];

function emptyDb(): FriendsDb {
  return {
    users: seedUsers,
    friendPosts: [
      {
        id: "post-seed-coffee",
        userId: "user-maya",
        text: "Down for an iced latte and a walk by the water around 6.",
        tag: "Coffee",
        createdAt: new Date().toISOString(),
      },
      {
        id: "post-seed-gym",
        userId: "user-omar",
        text: "Looking for a gym-to-food crew this weekend.",
        tag: "Gym",
        createdAt: new Date().toISOString(),
      },
    ],
    postComments: [],
    postLikes: [],
    connectionRequests: [],
    plans: [],
    planMembers: [],
    chats: [],
    chatMembers: [],
    userBehavior: [],
    friendStories: [],
    friendStoryReactions: [],
    planJoinRequests: [],
    userReports: [],
    friendReactions: [],
    friendActionUsage: [],
    friendInvites: [],
    // ── Mock data for testing — pre-populated inbox ──────────────────────────
    connections: [
      { id: "conn-self-maya",    userAId: "user_self", userBId: "user-maya",    status: "connected", createdAt: new Date(Date.now() - 86400000 * 7).toISOString() },
      { id: "conn-self-omar",    userAId: "user_self", userBId: "user-omar",    status: "connected", createdAt: new Date(Date.now() - 86400000 * 5).toISOString() },
      { id: "conn-self-nina",    userAId: "user_self", userBId: "user-nina",    status: "connected", createdAt: new Date(Date.now() - 86400000 * 4).toISOString() },
      { id: "conn-self-sofia",   userAId: "user_self", userBId: "user-sofia",   status: "connected", createdAt: new Date(Date.now() - 86400000 * 3).toISOString() },
      { id: "conn-self-jade",    userAId: "user_self", userBId: "user-jade",    status: "connected", createdAt: new Date(Date.now() - 86400000 * 3).toISOString() },
      { id: "conn-self-camille", userAId: "user_self", userBId: "user-camille", status: "connected", createdAt: new Date(Date.now() - 86400000 * 2).toISOString() },
      { id: "conn-self-zara",    userAId: "user_self", userBId: "user-zara",    status: "connected", createdAt: new Date(Date.now() - 86400000 * 2).toISOString() },
      { id: "conn-self-amara",   userAId: "user_self", userBId: "user-amara",   status: "connected", createdAt: new Date(Date.now() - 86400000).toISOString() },
    ],
    csConversations: [
      {
        id: "conv-maya",
        participantIds: ["user_self", "user-maya"],
        type: "match",
        category: "primary",
        status: "active",
        hasMessages: true,
        createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
        lastMessageAt: new Date(Date.now() - 1800000).toISOString(),
        lastMessageText: "you better not ghost me lol",
        lastMessageSenderId: "user-maya",
        peerId: "user-maya",
        peerName: "Maya Johnson",
        peerPhotoUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80",
      },
      {
        id: "conv-omar",
        participantIds: ["user_self", "user-omar"],
        type: "match",
        category: "primary",
        status: "active",
        hasMessages: true,
        createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
        lastMessageAt: new Date(Date.now() - 3600000).toISOString(),
        lastMessageText: "Basement was 🔥🔥",
        lastMessageSenderId: "user-omar",
        peerId: "user-omar",
        peerName: "Omar Ellis",
        peerPhotoUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80",
      },
      {
        id: "conv-nina",
        participantIds: ["user_self", "user-nina"],
        type: "direct",
        category: "primary",
        status: "active",
        hasMessages: true,
        createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
        lastMessageAt: new Date(Date.now() - 5400000).toISOString(),
        lastMessageText: "Sunday works, let's do Cibo 🥂",
        lastMessageSenderId: "user-nina",
        peerId: "user-nina",
        peerName: "Nina Patel",
        peerPhotoUrl: "https://images.unsplash.com/photo-1521119989659-a83eee488004?auto=format&fit=crop&w=400&q=80",
      },
      {
        id: "conv-sofia",
        participantIds: ["user_self", "user-sofia"],
        type: "match",
        category: "primary",
        status: "active",
        hasMessages: true,
        createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
        lastMessageAt: new Date(Date.now() - 7200000).toISOString(),
        lastMessageText: "we definitely need to link for the next one 🏀",
        lastMessageSenderId: "user_self",
        peerId: "user-sofia",
        peerName: "Sofia Reyes",
        peerPhotoUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80",
      },
      {
        id: "conv-jade",
        participantIds: ["user_self", "user-jade"],
        type: "match",
        category: "primary",
        status: "active",
        hasMessages: true,
        createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
        lastMessageAt: new Date(Date.now() - 9000000).toISOString(),
        lastMessageText: "oat milk cortado and I'm yours 🎨",
        lastMessageSenderId: "user-jade",
        peerId: "user-jade",
        peerName: "Jade Williams",
        peerPhotoUrl: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=400&q=80",
      },
      {
        id: "conv-camille",
        participantIds: ["user_self", "user-camille"],
        type: "match",
        category: "primary",
        status: "active",
        hasMessages: true,
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        lastMessageAt: new Date(Date.now() - 10800000).toISOString(),
        lastMessageText: "don't have to ask me twice 🥂",
        lastMessageSenderId: "user-camille",
        peerId: "user-camille",
        peerName: "Camille Fontaine",
        peerPhotoUrl: "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?auto=format&fit=crop&w=400&q=80",
      },
      {
        id: "conv-zara",
        participantIds: ["user_self", "user-zara"],
        type: "match",
        category: "primary",
        status: "active",
        hasMessages: true,
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        lastMessageAt: new Date(Date.now() - 14400000).toISOString(),
        lastMessageText: "I always do 😌",
        lastMessageSenderId: "user-zara",
        peerId: "user-zara",
        peerName: "Zara Hassan",
        peerPhotoUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
      },
      {
        id: "conv-amara",
        participantIds: ["user_self", "user-amara"],
        type: "match",
        category: "primary",
        status: "active",
        hasMessages: true,
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        lastMessageAt: new Date(Date.now() - 18000000).toISOString(),
        lastMessageText: "was waiting for someone to ask me 💃",
        lastMessageSenderId: "user-amara",
        peerId: "user-amara",
        peerName: "Amara Diallo",
        peerPhotoUrl: "https://images.unsplash.com/photo-1526510747491-58f928ec870f?auto=format&fit=crop&w=400&q=80",
      },
    ],
    messages: [
      // conv-maya — rooftop date planning
      { id: "msg-maya-1", chatId: "conv-maya", senderId: "user_self",  senderUserId: "user_self",  text: "okay so hear me out — 1 Hotel rooftop at golden hour 👀", createdAt: new Date(Date.now() - 86400000 * 7 + 3600000).toISOString() },
      { id: "msg-maya-2", chatId: "conv-maya", senderId: "user-maya",  senderUserId: "user-maya",  text: "you really said no introduction just straight to the point lol", createdAt: new Date(Date.now() - 86400000 * 7 + 7200000).toISOString() },
      { id: "msg-maya-3", chatId: "conv-maya", senderId: "user_self",  senderUserId: "user_self",  text: "why waste time? you've been to Brickell rooftops right", createdAt: new Date(Date.now() - 86400000 * 6).toISOString() },
      { id: "msg-maya-4", chatId: "conv-maya", senderId: "user-maya",  senderUserId: "user-maya",  text: "1 Hotel every time no contest. the views hit different at dusk", createdAt: new Date(Date.now() - 86400000 * 5).toISOString() },
      { id: "msg-maya-5", chatId: "conv-maya", senderId: "user_self",  senderUserId: "user_self",  text: "Saturday then? like 6ish so we catch the sunset", createdAt: new Date(Date.now() - 86400000 * 2).toISOString() },
      { id: "msg-maya-6", chatId: "conv-maya", senderId: "user-maya",  senderUserId: "user-maya",  text: "I'm so down. wear something that doesn't embarrass me 😂", createdAt: new Date(Date.now() - 86400000 * 2 + 3600000).toISOString() },
      { id: "msg-maya-7", chatId: "conv-maya", senderId: "user-maya",  senderUserId: "user-maya",  text: "you better not ghost me lol", createdAt: new Date(Date.now() - 1800000).toISOString() },
      // conv-omar — Wynwood nightlife
      { id: "msg-omar-1", chatId: "conv-omar", senderId: "user_self",  senderUserId: "user_self",  text: "bro you eat at Wynwood Kitchen yet?", createdAt: new Date(Date.now() - 86400000 * 5 + 3600000).toISOString() },
      { id: "msg-omar-2", chatId: "conv-omar", senderId: "user-omar",  senderUserId: "user-omar",  text: "only like every other week lol the short rib tacos go crazy", createdAt: new Date(Date.now() - 86400000 * 5 + 7200000).toISOString() },
      { id: "msg-omar-3", chatId: "conv-omar", senderId: "user_self",  senderUserId: "user_self",  text: "we should link there then hit Ball & Chain after", createdAt: new Date(Date.now() - 86400000 * 4).toISOString() },
      { id: "msg-omar-4", chatId: "conv-omar", senderId: "user-omar",  senderUserId: "user-omar",  text: "that's literally my Saturday formula ngl", createdAt: new Date(Date.now() - 86400000 * 3).toISOString() },
      { id: "msg-omar-5", chatId: "conv-omar", senderId: "user_self",  senderUserId: "user_self",  text: "we ended at Basement last time. that crowd was on something else", createdAt: new Date(Date.now() - 86400000 * 2).toISOString() },
      { id: "msg-omar-6", chatId: "conv-omar", senderId: "user-omar",  senderUserId: "user-omar",  text: "lmaoo the DJ set at like 2am was unreal. needed that", createdAt: new Date(Date.now() - 86400000).toISOString() },
      { id: "msg-omar-7", chatId: "conv-omar", senderId: "user-omar",  senderUserId: "user-omar",  text: "Basement was 🔥🔥", createdAt: new Date(Date.now() - 3600000).toISOString() },
      // conv-nina — Coral Gables brunch
      { id: "msg-nina-1", chatId: "conv-nina", senderId: "user-nina",  senderUserId: "user-nina",  text: "you've done Coral Gables brunch spots before?", createdAt: new Date(Date.now() - 86400000 * 4 + 3600000).toISOString() },
      { id: "msg-nina-2", chatId: "conv-nina", senderId: "user_self",  senderUserId: "user_self",  text: "I keep hearing about Cibo but haven't been yet", createdAt: new Date(Date.now() - 86400000 * 4 + 7200000).toISOString() },
      { id: "msg-nina-3", chatId: "conv-nina", senderId: "user-nina",  senderUserId: "user-nina",  text: "Cibo is the move. patio seating, great mimosas, no rush vibe", createdAt: new Date(Date.now() - 86400000 * 3).toISOString() },
      { id: "msg-nina-4", chatId: "conv-nina", senderId: "user_self",  senderUserId: "user_self",  text: "okay I need to go. you free Sunday?", createdAt: new Date(Date.now() - 86400000 * 2).toISOString() },
      { id: "msg-nina-5", chatId: "conv-nina", senderId: "user-nina",  senderUserId: "user-nina",  text: "Sunday works! let's do like 11:30 before it gets packed", createdAt: new Date(Date.now() - 86400000).toISOString() },
      { id: "msg-nina-6", chatId: "conv-nina", senderId: "user-nina",  senderUserId: "user-nina",  text: "Sunday works, let's do Cibo 🥂", createdAt: new Date(Date.now() - 5400000).toISOString() },
      // conv-sofia — Heat game section 107
      { id: "msg-sofia-1", chatId: "conv-sofia", senderId: "user-sofia", senderUserId: "user-sofia", text: "wait did you go to the Heat game Tuesday?", createdAt: new Date(Date.now() - 86400000 * 3 + 3600000).toISOString() },
      { id: "msg-sofia-2", chatId: "conv-sofia", senderId: "user_self",  senderUserId: "user_self",  text: "Section 107 whole time. was that you like 4 rows up??", createdAt: new Date(Date.now() - 86400000 * 3 + 5400000).toISOString() },
      { id: "msg-sofia-3", chatId: "conv-sofia", senderId: "user-sofia", senderUserId: "user-sofia", text: "LMAO yes!! small world. that Butler comeback had everyone losing it", createdAt: new Date(Date.now() - 86400000 * 2).toISOString() },
      { id: "msg-sofia-4", chatId: "conv-sofia", senderId: "user_self",  senderUserId: "user_self",  text: "I literally screamed. whole section went crazy", createdAt: new Date(Date.now() - 86400000 * 2 + 1800000).toISOString() },
      { id: "msg-sofia-5", chatId: "conv-sofia", senderId: "user-sofia", senderUserId: "user-sofia", text: "next game is Thursday — you trying to go?", createdAt: new Date(Date.now() - 86400000).toISOString() },
      { id: "msg-sofia-6", chatId: "conv-sofia", senderId: "user_self",  senderUserId: "user_self",  text: "we definitely need to link for the next one 🏀", createdAt: new Date(Date.now() - 7200000).toISOString() },
      // conv-jade — Design District mural / coffee
      { id: "msg-jade-1", chatId: "conv-jade", senderId: "user_self",  senderUserId: "user_self",  text: "found the wildest mural on NW 2nd in the Design District yesterday", createdAt: new Date(Date.now() - 86400000 * 3 + 3600000).toISOString() },
      { id: "msg-jade-2", chatId: "conv-jade", senderId: "user-jade",  senderUserId: "user-jade",  text: "the Basquiat-inspired one?? I shot there two weekends ago", createdAt: new Date(Date.now() - 86400000 * 3 + 7200000).toISOString() },
      { id: "msg-jade-3", chatId: "conv-jade", senderId: "user_self",  senderUserId: "user_self",  text: "yes!! I want to do a whole shoot around there sometime", createdAt: new Date(Date.now() - 86400000 * 2).toISOString() },
      { id: "msg-jade-4", chatId: "conv-jade", senderId: "user-jade",  senderUserId: "user-jade",  text: "I'm literally always down for that. light hits crazy before noon", createdAt: new Date(Date.now() - 86400000 * 2 + 3600000).toISOString() },
      { id: "msg-jade-5", chatId: "conv-jade", senderId: "user_self",  senderUserId: "user_self",  text: "coffee first though. Threefold in Coral Gables?", createdAt: new Date(Date.now() - 86400000).toISOString() },
      { id: "msg-jade-6", chatId: "conv-jade", senderId: "user-jade",  senderUserId: "user-jade",  text: "great taste. Saturday morning?", createdAt: new Date(Date.now() - 86400000 + 3600000).toISOString() },
      { id: "msg-jade-7", chatId: "conv-jade", senderId: "user_self",  senderUserId: "user_self",  text: "say less. coffee then we explore", createdAt: new Date(Date.now() - 86400000 + 7200000).toISOString() },
      { id: "msg-jade-8", chatId: "conv-jade", senderId: "user-jade",  senderUserId: "user-jade",  text: "oat milk cortado and I'm yours 🎨", createdAt: new Date(Date.now() - 9000000).toISOString() },
      // conv-camille — Faena + SoBe scene
      { id: "msg-camille-1", chatId: "conv-camille", senderId: "user_self",   senderUserId: "user_self",   text: "were you at Faena Forum Saturday??", createdAt: new Date(Date.now() - 86400000 * 2 + 3600000).toISOString() },
      { id: "msg-camille-2", chatId: "conv-camille", senderId: "user-camille", senderUserId: "user-camille", text: "yes omg we literally missed each other. I got there at like 10", createdAt: new Date(Date.now() - 86400000 * 2 + 7200000).toISOString() },
      { id: "msg-camille-3", chatId: "conv-camille", senderId: "user_self",   senderUserId: "user_self",   text: "I left at 9:45 I'm so annoyed lmao", createdAt: new Date(Date.now() - 86400000 * 2 + 9000000).toISOString() },
      { id: "msg-camille-4", chatId: "conv-camille", senderId: "user-camille", senderUserId: "user-camille", text: "next time we coordinate. you know the SoBe scene well?", createdAt: new Date(Date.now() - 86400000).toISOString() },
      { id: "msg-camille-5", chatId: "conv-camille", senderId: "user_self",   senderUserId: "user_self",   text: "lived there two years. know every rooftop and every door guy lol", createdAt: new Date(Date.now() - 86400000 + 3600000).toISOString() },
      { id: "msg-camille-6", chatId: "conv-camille", senderId: "user-camille", senderUserId: "user-camille", text: "okay well take me on a tour then 🫡", createdAt: new Date(Date.now() - 86400000 + 7200000).toISOString() },
      { id: "msg-camille-7", chatId: "conv-camille", senderId: "user-camille", senderUserId: "user-camille", text: "don't have to ask me twice 🥂", createdAt: new Date(Date.now() - 10800000).toISOString() },
      // conv-zara — Pérez Art Museum / Threefold
      { id: "msg-zara-1", chatId: "conv-zara", senderId: "user-zara",  senderUserId: "user-zara",  text: "did you catch the Basquiat exhibit at PAMM before it closed?", createdAt: new Date(Date.now() - 86400000 * 2 + 3600000).toISOString() },
      { id: "msg-zara-2", chatId: "conv-zara", senderId: "user_self",  senderUserId: "user_self",  text: "went opening weekend. that piece in the back room stopped me cold", createdAt: new Date(Date.now() - 86400000 * 2 + 7200000).toISOString() },
      { id: "msg-zara-3", chatId: "conv-zara", senderId: "user-zara",  senderUserId: "user-zara",  text: "the Crown piece? that one hit me too. the whole room went quiet", createdAt: new Date(Date.now() - 86400000 * 2 + 10800000).toISOString() },
      { id: "msg-zara-4", chatId: "conv-zara", senderId: "user_self",  senderUserId: "user_self",  text: "exactly that one. we should do Threefold coffee before the next opening", createdAt: new Date(Date.now() - 86400000).toISOString() },
      { id: "msg-zara-5", chatId: "conv-zara", senderId: "user-zara",  senderUserId: "user-zara",  text: "yes. cortado, good art, minimal talking to boring people sounds perfect", createdAt: new Date(Date.now() - 86400000 + 3600000).toISOString() },
      { id: "msg-zara-6", chatId: "conv-zara", senderId: "user_self",  senderUserId: "user_self",  text: "you have taste. keep it that way 😌", createdAt: new Date(Date.now() - 86400000 + 7200000).toISOString() },
      { id: "msg-zara-7", chatId: "conv-zara", senderId: "user-zara",  senderUserId: "user-zara",  text: "I always do 😌", createdAt: new Date(Date.now() - 14400000).toISOString() },
      // conv-amara — Kizomba / E11EVEN Caribbean night
      { id: "msg-amara-1", chatId: "conv-amara", senderId: "user_self",  senderUserId: "user_self",  text: "you went to Kizomba Live at Ball & Chain last week?", createdAt: new Date(Date.now() - 86400000 + 3600000).toISOString() },
      { id: "msg-amara-2", chatId: "conv-amara", senderId: "user-amara", senderUserId: "user-amara", text: "every month without fail. you actually know about that event??", createdAt: new Date(Date.now() - 86400000 + 7200000).toISOString() },
      { id: "msg-amara-3", chatId: "conv-amara", senderId: "user_self",  senderUserId: "user_self",  text: "been going for like a year. the live percussion set is everything", createdAt: new Date(Date.now() - 86400000 + 10800000).toISOString() },
      { id: "msg-amara-4", chatId: "conv-amara", senderId: "user-amara", senderUserId: "user-amara", text: "okay respect. most people don't even know it exists lol", createdAt: new Date(Date.now() - 86400000 + 14400000).toISOString() },
      { id: "msg-amara-5", chatId: "conv-amara", senderId: "user_self",  senderUserId: "user_self",  text: "E11EVEN does Caribbean nights too — you been?", createdAt: new Date(Date.now() - 86400000 + 18000000).toISOString() },
      { id: "msg-amara-6", chatId: "conv-amara", senderId: "user-amara", senderUserId: "user-amara", text: "you should come to the next Kizomba. I can show you the proper footwork 😭", createdAt: new Date(Date.now() - 86400000 + 21600000).toISOString() },
      { id: "msg-amara-7", chatId: "conv-amara", senderId: "user-amara", senderUserId: "user-amara", text: "was waiting for someone to ask me 💃", createdAt: new Date(Date.now() - 18000000).toISOString() },
    ],
    csReactions: [
      {
        id: "react-1",
        senderId: "user-diego",
        receiverId: "user_self",
        type: "spark",
        sourceType: "profile",
        status: "pending",
        isBlurredForReceiver: false,
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        senderName: "Diego Ramos",
        senderPhotoUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80",
        senderAge: 28,
        senderNeighborhood: "Brickell",
      },
      {
        id: "react-2",
        senderId: "user-priya",
        receiverId: "user_self",
        type: "like",
        sourceType: "profile",
        status: "pending",
        isBlurredForReceiver: false,
        createdAt: new Date(Date.now() - 7200000).toISOString(),
        senderName: "Priya Shah",
        senderPhotoUrl: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=400&q=80",
        senderAge: 27,
        senderNeighborhood: "Bal Harbour",
      },
      {
        id: "react-3",
        senderId: "user-jade",
        receiverId: "user_self",
        type: "like",
        sourceType: "profile",
        status: "pending",
        isBlurredForReceiver: false,
        createdAt: new Date(Date.now() - 14400000).toISOString(),
        senderName: "Jade Williams",
        senderPhotoUrl: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=400&q=80",
        senderAge: 25,
        senderNeighborhood: "Edgewater",
      },
      {
        id: "react-4",
        senderId: "user-camille",
        receiverId: "user_self",
        type: "spark",
        sourceType: "profile",
        status: "pending",
        isBlurredForReceiver: false,
        createdAt: new Date(Date.now() - 21600000).toISOString(),
        senderName: "Camille Fontaine",
        senderPhotoUrl: "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?auto=format&fit=crop&w=400&q=80",
        senderAge: 24,
        senderNeighborhood: "South Beach",
      },
      {
        id: "react-5",
        senderId: "user-zara",
        receiverId: "user_self",
        type: "vibe_reaction",
        sourceType: "profile",
        status: "pending",
        isBlurredForReceiver: false,
        createdAt: new Date(Date.now() - 28800000).toISOString(),
        senderName: "Zara Hassan",
        senderPhotoUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
        senderAge: 25,
        senderNeighborhood: "Coral Gables",
      },
    ],
    csRequests: [
      {
        id: "req-1",
        senderId: "user-lucas",
        receiverId: "user_self",
        type: "shot_request",
        sourceType: "shot",
        message: "You seem like someone who actually shows up to plans. Let's link 🤙",
        status: "pending",
        createdAt: new Date(Date.now() - 5400000).toISOString(),
        senderName: "Lucas Bennett",
        senderPhotoUrl: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=400&q=80",
        senderAge: 30,
        senderNeighborhood: "Coconut Grove",
      },
      {
        id: "req-2",
        senderId: "user-marcus",
        receiverId: "user_self",
        type: "connect_request",
        sourceType: "profile",
        message: "Saw you're in Brickell too. Always looking for new people to move with 💯",
        status: "pending",
        createdAt: new Date(Date.now() - 10800000).toISOString(),
        senderName: "Marcus Cole",
        senderPhotoUrl: "https://images.unsplash.com/photo-1463453091185-61582044d556?auto=format&fit=crop&w=400&q=80",
        senderAge: 29,
        senderNeighborhood: "Wynwood",
      },
      {
        id: "req-3",
        senderId: "user-amara",
        receiverId: "user_self",
        type: "shot_request",
        sourceType: "shot",
        message: "Soca nights at E11EVEN? I heard you know how to have a good time 👀",
        status: "pending",
        createdAt: new Date(Date.now() - 18000000).toISOString(),
        senderName: "Amara Diallo",
        senderPhotoUrl: "https://images.unsplash.com/photo-1526510747491-58f928ec870f?auto=format&fit=crop&w=400&q=80",
        senderAge: 26,
        senderNeighborhood: "Little Haiti",
      },
    ],
  };
}

function readDb(): FriendsDb {
  if (!existsSync(dbPath)) {
    const initial = emptyDb();
    writeDb(initial);
    return initial;
  }

  const parsed = JSON.parse(readFileSync(dbPath, "utf8")) as Partial<FriendsDb>;
  const base = emptyDb();
  return {
    ...base,
    ...parsed,
    users: parsed.users ?? base.users,
    friendPosts: parsed.friendPosts ?? [],
    postComments: parsed.postComments ?? [],
    postLikes: parsed.postLikes ?? [],
    connectionRequests: parsed.connectionRequests ?? [],
    plans: parsed.plans ?? [],
    planMembers: parsed.planMembers ?? [],
    chats: parsed.chats ?? [],
    chatMembers: parsed.chatMembers ?? [],
    userBehavior: parsed.userBehavior ?? [],
    friendStories: parsed.friendStories ?? [],
    friendStoryReactions: parsed.friendStoryReactions ?? [],
    planJoinRequests: parsed.planJoinRequests ?? [],
    userReports: parsed.userReports ?? [],
    datingMatches: parsed.datingMatches ?? [],
    doubleDatePairs: parsed.doubleDatePairs ?? [],
    doubleDateLikes: parsed.doubleDateLikes ?? [],
    doubleDatePasses: parsed.doubleDatePasses ?? [],
    doubleDateMatches: parsed.doubleDateMatches ?? [],
    blockedUsers: parsed.blockedUsers ?? [],
    planShareLinks: parsed.planShareLinks ?? [],
    planShareLinkRedemptions: parsed.planShareLinkRedemptions ?? [],
    friendReactions: parsed.friendReactions ?? [],
    friendActionUsage: parsed.friendActionUsage ?? [],
    friendInvites: parsed.friendInvites ?? [],
    // Seed inbox data if the user has no data yet (fresh install or reset)
    csReactions: (parsed.csReactions && parsed.csReactions.length > 0)
      ? parsed.csReactions
      : base.csReactions,
    csRequests: (parsed.csRequests && parsed.csRequests.length > 0)
      ? parsed.csRequests
      : base.csRequests,
    csConversations: (parsed.csConversations && parsed.csConversations.length > 0)
      ? parsed.csConversations
      : base.csConversations,
    messages: (parsed.messages && parsed.messages.length > 0)
      ? parsed.messages
      : base.messages,
    connections: (parsed.connections && parsed.connections.length > 0)
      ? parsed.connections
      : base.connections,
  };
}

function writeDb(db: FriendsDb) {
  mkdirSync(dirname(dbPath), { recursive: true });
  writeFileSync(dbPath, `${JSON.stringify(db, null, 2)}\n`);
}

function arrayOverlap(a: string[], b: string[]) {
  const normalized = new Set(a.map((item) => item.toLowerCase()));
  return b.filter((item) => normalized.has(item.toLowerCase()));
}

export function calculateCompatibility(viewer: FriendUser, candidate: FriendUser, behavior?: UserBehavior) {
  const sharedInterests = arrayOverlap(viewer.interests, candidate.interests);
  const sharedActivity = arrayOverlap(viewer.activityStyle, candidate.activityStyle);
  const sharedAccess = arrayOverlap(viewer.accessibility, candidate.accessibility);
  const sameNeighborhood = viewer.neighborhood === candidate.neighborhood;
  const safetyOverlap = arrayOverlap(viewer.safety, candidate.safety);
  const behaviorLift = behavior?.likedTags.some((tag) => candidate.interests.includes(tag.toLowerCase())) ? 12 : 0;

  const score =
    sharedInterests.length * 14 +
    sharedActivity.length * 10 +
    sharedAccess.length * 10 +
    safetyOverlap.length * 8 +
    candidate.mutualConnections.length * 7 +
    (sameNeighborhood ? 18 : 0) +
    (viewer.lgbtqFriendly && candidate.lgbtqFriendly ? 6 : 0) +
    (viewer.familyFriendly === candidate.familyFriendly ? 5 : 0) +
    behaviorLift;

  const signals = [
    sharedInterests.length ? "Similar interests" : "You'd probably get along",
    sharedActivity.length ? "Same energy" : "Easy plan style",
    sameNeighborhood ? `Also active around ${candidate.neighborhood}` : "Your kind of people",
    sharedAccess.length ? "Similar accessibility preferences" : "Plan-friendly",
  ];

  return { score, signals, sharedInterests, sharedActivity };
}

export function getPlanSuggestions(viewer: FriendUser, candidate: FriendUser) {
  const overlap = arrayOverlap(viewer.interests, candidate.interests);
  const quiet = candidate.accessibility.includes("low-noise") || viewer.accessibility.includes("low-noise");
  const active = candidate.activityStyle.includes("active") || viewer.activityStyle.includes("active");

  return [
    { type: "Coffee", reason: overlap.includes("coffee") ? "Coffee fits both of you." : "Easy first plan." },
    { type: "Gym", reason: active ? "Both show active energy." : "Good for a structured meetup." },
    { type: "Walk", reason: quiet ? "Low-noise and flexible." : "Simple neighborhood plan." },
    { type: "Brunch", reason: overlap.includes("food") ? "Both enjoy food plans." : "Weekend friendly." },
    { type: "Study", reason: quiet ? "Low-noise environment preferred." : "Useful shared focus time." },
  ];
}

export function getFriendActions(viewerId: string, candidateId: string, db: FriendsDb) {
  if (isBlocked(db, viewerId, candidateId)) {
    return {
      connect: "blocked",
      plan: "blocked",
    };
  }
  const request = db.connectionRequests.find(
    (item) =>
      ((item.fromUserId === viewerId && item.toUserId === candidateId) ||
        (item.fromUserId === candidateId && item.toUserId === viewerId)) &&
      item.status === "pending",
  );
  const connected = db.connections.some(
    (item) =>
      (item.userAId === viewerId && item.userBId === candidateId) ||
      (item.userAId === candidateId && item.userBId === viewerId),
  );

  return {
    connect: connected ? "message" : request ? "requested" : "connect",
    plan: connected ? "create" : "request-first",
  };
}

export function buildFriendsFeed(userId: string, db: FriendsDb) {
  const viewer = userProfile(db, userId);
  const behavior = db.userBehavior.find((item) => item.userId === userId);

  return db.friendPosts
    .filter((post) => post.userId === userId || !isBlocked(db, userId, post.userId))
    .map((post) => {
      const author = userProfile(db, post.userId);
      const compatibility = calculateCompatibility(viewer, author, behavior);
      return {
        ...post,
        author,
        compatibility,
        actions: getFriendActions(userId, author.id, db),
        planSuggestions: getPlanSuggestions(viewer, author),
      };
    })
    .sort((a, b) => b.compatibility.score - a.compatibility.score);
}

function authUserId(req: Parameters<typeof getAuth>[0], fallback?: string) {
  const { userId } = getAuth(req);
  if (userId) return userId;
  if (fallback) return fallback;
  if (shouldUseLocalDbFallback()) return "demo-user";
  throw Object.assign(new Error("Authentication required"), { status: 401 });
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function userProfile(db: FriendsDb, id: string) {
  const raw = db.users.find((user) => user.id === id);
  return {
    id,
    name: raw?.name ?? "Someone",
    city: raw?.city ?? "Miami",
    neighborhood: raw?.neighborhood ?? raw?.city ?? "Miami",
    age: raw?.age,
    photoUrl: raw?.photoUrl,
    interests: raw?.interests ?? [],
    activityStyle: raw?.activityStyle ?? [],
    energy: raw?.energy ?? "Ready for plans",
    activeTonight: raw?.activeTonight ?? false,
    accessibility: raw?.accessibility ?? [],
    safety: raw?.safety ?? [],
    familyFriendly: raw?.familyFriendly ?? false,
    lgbtqFriendly: raw?.lgbtqFriendly ?? true,
    mutualConnections: raw?.mutualConnections ?? [],
  };
}

function isBlocked(db: FriendsDb, userAId: string, userBId: string) {
  return (db.blockedUsers ?? []).some(
    (block) =>
      (block.userId === userAId && block.blockedUserId === userBId) ||
      (block.userId === userBId && block.blockedUserId === userAId),
  );
}

function areFriends(db: FriendsDb, userAId: string, userBId: string) {
  return db.connections.some((connection) => {
    const ids = connection.userIds ?? [connection.userAId, connection.userBId];
    return ids.includes(userAId) && ids.includes(userBId);
  });
}

function pendingRequestBetween(db: FriendsDb, userAId: string, userBId: string) {
  return db.connectionRequests.find(
    (request) =>
      request.status === "pending" &&
      ((request.fromUserId === userAId && request.toUserId === userBId) ||
        (request.fromUserId === userBId && request.toUserId === userAId)),
  );
}

function relationshipStatus(db: FriendsDb, viewerId: string, candidateId: string) {
  if (areFriends(db, viewerId, candidateId)) return "friends" as const;
  const pending = pendingRequestBetween(db, viewerId, candidateId);
  if (!pending) return "none" as const;
  return pending.fromUserId === viewerId ? ("requested" as const) : ("incoming" as const);
}

function dateKey(input = new Date()) {
  return input.toISOString().slice(0, 10);
}

function isPremiumUser(db: FriendsDb, userId: string, explicitValue?: unknown) {
  if (explicitValue === true || explicitValue === "true" || explicitValue === "1") return true;
  const user = db.users.find((item) => item.id === userId) as (FriendUser & { isPremium?: boolean; subscriptionTier?: string }) | undefined;
  return user?.isPremium === true || user?.subscriptionTier === "connect_sphere_plus";
}

function isUserPremium(db: FriendsDb, userId: string, explicitValue?: unknown) {
  return isPremiumUser(db, userId, explicitValue);
}

function incrementDailyUsage(db: FriendsDb, userId: string, action: FriendActionUsage["action"], limit: number, premium: boolean) {
  if (premium) return { allowed: true, remaining: Number.POSITIVE_INFINITY, count: 0 };
  const today = dateKey();
  const usage =
    (db.friendActionUsage ?? []).find((item) => item.userId === userId && item.action === action && item.dateKey === today) ??
    (() => {
      const created = { id: randomUUID(), userId, action, dateKey: today, count: 0, updatedAt: new Date().toISOString() };
      db.friendActionUsage = db.friendActionUsage ?? [];
      db.friendActionUsage.push(created);
      return created;
    })();
  if (usage.count >= limit) {
    return { allowed: false, remaining: 0, count: usage.count };
  }
  usage.count += 1;
  usage.updatedAt = new Date().toISOString();
  return { allowed: true, remaining: Math.max(0, limit - usage.count), count: usage.count };
}

function upsertFriendReaction(db: FriendsDb, fromUserId: string, toUserId: string, type: FriendReaction["type"]) {
  db.friendReactions = db.friendReactions ?? [];
  const existing = db.friendReactions.find(
    (item) => item.fromUserId === fromUserId && item.toUserId === toUserId && item.type === type && item.status === "pending",
  );
  if (existing) return { reaction: existing, reused: true };
  const reaction: FriendReaction = {
    id: randomUUID(),
    fromUserId,
    toUserId,
    type,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  db.friendReactions.push(reaction);
  return { reaction, reused: false };
}

function friendReactionSummary(db: FriendsDb, viewerId: string, reaction: FriendReaction, premium: boolean) {
  const displayText = reaction.type === "best_friend" ? "Someone marked you Best Friend" : "Someone wants to be friends";
  if (!premium) {
    return {
      id: reaction.id,
      type: reaction.type,
      createdAt: reaction.createdAt,
      locked: true,
      displayText,
      count: 1,
    };
  }
  const sender = userProfile(db, reaction.fromUserId);
  return {
    id: reaction.id,
    type: reaction.type,
    createdAt: reaction.createdAt,
    locked: false,
    displayText,
    senderProfile: {
      id: sender.id,
      userId: sender.id,
      name: sender.name,
      age: sender.age,
      photos: sender.photoUrl ? [sender.photoUrl] : [],
      datingGoal: sender.energy,
      intent: "friends",
      interests: sender.interests,
      bio: `${sender.energy} around ${sender.neighborhood}.`,
    },
    context:
      reaction.type === "best_friend"
        ? "They used their Best Friend badge on you."
        : `You both look like ${sender.activityStyle[0] ?? "easy plan"} friends.`,
  };
}

function ensureChatMember(db: FriendsDb, chatId: string, userId: string) {
  if (!db.chatMembers.some((member) => member.chatId === chatId && member.userId === userId)) {
    db.chatMembers.push({ id: randomUUID(), chatId, userId });
  }
}

function sendConnectPushToUser(
  userId: string,
  input: {
    kind: ConnectPushKind;
    chatId: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
  },
) {
  const token = getPushToken(userId);
  if (!token) return;
  void sendConnectThreadPush({ to: token, ...input }).catch(() => {});
}

// When chat membership crosses 3, flip the `isGroup` flag and post a one-time
// hype system message so the Connect tab can render a "group chat hype on"
// ribbon. Safe to call after every member add; runs at most once per chat.
function ensureGroupPromotion(db: FriendsDb, chatId: string) {
  const chat = db.chats.find((item) => item.id === chatId);
  if (!chat) return;
  const memberCount = db.chatMembers.filter((member) => member.chatId === chatId).length;
  if (memberCount < 3 || chat.isGroup) return;
  chat.isGroup = true;
  chat.groupPromotedAt = new Date().toISOString();
  db.messages.push({
    id: randomUUID(),
    chatId,
    senderUserId: "system",
    text: "🎉 group chat hype on",
    createdAt: chat.groupPromotedAt,
    system: true,
  });
}

function findDirectChat(db: FriendsDb, userAId: string, userBId: string) {
  return db.chats.find((chat) => {
    const participantIds =
      chat.participantIds ??
      db.chatMembers.filter((member) => member.chatId === chat.id).map((member) => member.userId);
    return chat.type === "friend_direct" && participantIds.length === 2 && participantIds.includes(userAId) && participantIds.includes(userBId);
  });
}

function ensureDirectChat(db: FriendsDb, userAId: string, userBId: string) {
  const existing = findDirectChat(db, userAId, userBId);
  if (existing) {
    ensureChatMember(db, existing.id, userAId);
    ensureChatMember(db, existing.id, userBId);
    existing.participantIds = unique([...(existing.participantIds ?? []), userAId, userBId]);
    return existing;
  }

  const chat: Chat = {
    id: randomUUID(),
    type: "friend_direct",
    participantIds: unique([userAId, userBId]),
    title: `${userProfile(db, userAId).name} + ${userProfile(db, userBId).name}`,
    createdAt: new Date().toISOString(),
  };
  db.chats.push(chat);
  ensureChatMember(db, chat.id, userAId);
  ensureChatMember(db, chat.id, userBId);
  return chat;
}

function ensureConnection(db: FriendsDb, userAId: string, userBId: string) {
  const chat = ensureDirectChat(db, userAId, userBId);
  const existing = db.connections.find((connection) => {
    const ids = connection.userIds ?? [connection.userAId, connection.userBId];
    return ids.includes(userAId) && ids.includes(userBId);
  });
  if (existing) {
    existing.chatId = chat.id;
    existing.userIds = [userAId, userBId];
    return { connection: existing, chat };
  }

  const connection = {
    id: randomUUID(),
    userAId,
    userBId,
    userIds: [userAId, userBId] as [string, string],
    chatId: chat.id,
    createdAt: new Date().toISOString(),
  };
  db.connections.push(connection);
  return { connection, chat };
}

async function ensureServerFriendConversation(
  userAId: string,
  userBId: string,
  viewerUserId: string,
  originAction: MatchOriginAction,
  sourceId?: string,
) {
  const { match } = await ensureMatchThread({
    userId1: userAId,
    userId2: userBId,
    intent: "friends",
    originAction,
    sourceId,
  });
  const thread = await buildMatchThreadResponse({
    match,
    viewerUserId,
    intent: "friends",
    originAction,
  });
  const createdAt = match.matchedAt instanceof Date ? match.matchedAt.toISOString() : String(match.matchedAt);
  const lastMessageAt = thread.lastMessage?.createdAt instanceof Date
    ? thread.lastMessage.createdAt.toISOString()
    : thread.lastMessage?.createdAt
      ? String(thread.lastMessage.createdAt)
      : undefined;

  return {
    match: thread,
    chat: { id: match.id, matchId: match.id },
    conversation: {
      id: match.id,
      participantIds: [userAId, userBId],
      type: "match" as const,
      category: "primary" as const,
      status: "active" as const,
      sourceRequestId: originAction === "friend_accept" ? sourceId : undefined,
      sourceReactionId: originAction === "bestie" ? sourceId : undefined,
      hasMessages: Boolean(thread.lastMessage),
      createdAt,
      lastMessageAt,
      lastMessageText: thread.lastMessage?.content ?? null,
      lastMessageSenderId: thread.lastMessage?.senderId,
      peerId: userAId === viewerUserId ? userBId : userAId,
    },
  };
}

function ensurePendingRequest(db: FriendsDb, fromUserId: string, toUserId: string, extras?: Partial<ConnectionRequest>) {
  if (isBlocked(db, fromUserId, toUserId)) return null;
  const existing = pendingRequestBetween(db, fromUserId, toUserId);
  if (existing) {
    if (extras?.message) existing.message = extras.message;
    if (extras?.storyId) existing.storyId = extras.storyId;
    if (extras?.planId) existing.planId = extras.planId;
    if (extras?.kind) existing.kind = extras.kind;
    return existing;
  }

  const request: ConnectionRequest = {
    id: randomUUID(),
    fromUserId,
    toUserId,
    status: "pending",
    kind: extras?.kind ?? "friend",
    message: extras?.message,
    storyId: extras?.storyId,
    planId: extras?.planId,
    createdAt: new Date().toISOString(),
  };
  db.connectionRequests.push(request);
  return request;
}

function statusBadgeFor(user: ReturnType<typeof userProfile>) {
  const energy = user.energy.toLowerCase();
  if (user.activeTonight || energy.includes("active")) return "Active Now";
  if (energy.includes("miami") || energy.includes("exploring")) return "New to Miami";
  return "Looking for Plans";
}

function peopleCard(db: FriendsDb, viewerId: string, candidateId: string) {
  const viewer = userProfile(db, viewerId);
  const candidate = userProfile(db, candidateId);
  const pending = pendingRequestBetween(db, viewerId, candidateId);
  const chat = areFriends(db, viewerId, candidateId) ? ensureDirectChat(db, viewerId, candidateId) : undefined;
  const sharedInterests = arrayOverlap(viewer.interests, candidate.interests);
  const compatibility = calculateCompatibility(viewer, candidate, db.userBehavior.find((item) => item.userId === viewerId));
  const planSuggestions = getPlanSuggestions(viewer, candidate);
  const suggestedPlan = planSuggestions[0];
  return {
    ...candidate,
    location: candidate.neighborhood || candidate.city,
    statusBadge: statusBadgeFor(candidate),
    relationshipStatus: relationshipStatus(db, viewerId, candidateId),
    requestId: pending?.id,
    chatId: chat?.id,
    sharedInterests,
    compatibility,
    planSuggestions,
    smartReason: compatibility.signals.slice(0, 2).join(" • "),
    suggestedPlanType: suggestedPlan?.type,
    suggestedPlanReason: suggestedPlan?.reason,
    blocked: isBlocked(db, viewerId, candidateId),
  };
}

function lastMessageForChat(db: FriendsDb, chatId: string) {
  return db.messages
    .filter((message) => message.chatId === chatId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
}

function addChatMessage(db: FriendsDb, chatId: string, senderUserId: string, text: string, system = false) {
  const message: Message = {
    id: randomUUID(),
    chatId,
    senderId: senderUserId,
    senderUserId,
    text,
    createdAt: new Date().toISOString(),
    system,
  };
  db.messages.push(message);
  return message;
}

function icebreakerContextFromBody(db: FriendsDb, body: Record<string, unknown>, userId: string): FriendIcebreakerContext {
  const kind = String(body.kind ?? "person") as FriendIcebreakerContext["kind"];
  const targetUserId = typeof body.targetUserId === "string" ? body.targetUserId : undefined;
  const storyId = typeof body.storyId === "string" ? body.storyId : undefined;
  const planId = typeof body.planId === "string" ? body.planId : undefined;
  const chatId = typeof body.chatId === "string" ? body.chatId : undefined;
  const target = targetUserId ? userProfile(db, targetUserId) : undefined;
  const story = storyId ? (db.friendStories ?? []).find((item) => item.id === storyId) : undefined;
  const storyUser = story ? userProfile(db, story.userId) : undefined;
  const plan = planId ? db.plans.find((item) => item.id === planId) : undefined;
  const chat = chatId ? db.chats.find((item) => item.id === chatId) : undefined;
  const otherChatUserId = chat?.participantIds?.find((id) => id !== userId);
  const otherChatUser = otherChatUserId ? userProfile(db, otherChatUserId) : undefined;
  const lastMessage = chatId ? lastMessageForChat(db, chatId)?.text : undefined;
  const person = target ?? storyUser ?? otherChatUser;
  return {
    kind,
    currentUserName: userProfile(db, userId).name,
    targetName: person?.name,
    interests: person?.interests,
    energy: person?.energy,
    location: person?.neighborhood ?? person?.city ?? plan?.location,
    storyText: story?.text,
    planTitle: plan?.title,
    planType: plan?.type,
    planLocation: plan?.sourceName ?? plan?.location,
    lastMessage,
  };
}

function createFriendPlanWithChat(
  db: FriendsDb,
  input: {
    creatorId: string;
    title: string;
    type: string;
    time?: string;
    timeLabel?: string;
    scheduledAt?: string;
    location?: string;
    visibility?: "friends_nearby";
    sourceType?: "map" | "event" | "custom";
    sourceId?: string;
    sourceName?: string;
    sourceImageUrl?: string;
    latitude?: number;
    longitude?: number;
    invitedUserIds?: string[];
  },
) {
  const createdAt = new Date().toISOString();
  const invitedUserIds = unique(input.invitedUserIds ?? []).filter((userId) => userId !== input.creatorId);
  const visibleInviteIds = invitedUserIds.filter((userId) => !isBlocked(db, input.creatorId, userId));
  const instantInviteIds = visibleInviteIds.filter((userId) => areFriends(db, input.creatorId, userId));
  const pendingInviteIds = visibleInviteIds.filter((userId) => !areFriends(db, input.creatorId, userId));
  const participantIds = unique([input.creatorId, ...instantInviteIds]);
  const plan: Plan = {
    id: randomUUID(),
    creatorId: input.creatorId,
    creatorUserId: input.creatorId,
    title: input.title || `${input.type} plan`,
    type: input.type || "Coffee",
    time: input.time,
    timeLabel: input.timeLabel ?? input.time,
    scheduledAt: input.scheduledAt,
    location: input.location,
    visibility: input.visibility ?? "friends_nearby",
    sourceType: input.sourceType ?? "custom",
    sourceId: input.sourceId,
    sourceName: input.sourceName,
    sourceImageUrl: input.sourceImageUrl,
    latitude: input.latitude,
    longitude: input.longitude,
    invitedUserIds: visibleInviteIds,
    createdAt,
  };
  const chat: Chat = {
    id: randomUUID(),
    type: "friend_plan",
    participantIds,
    title: plan.title,
    planId: plan.id,
    createdAt,
  };
  plan.chatId = chat.id;
  db.plans.push(plan);
  db.chats.push(chat);
  participantIds.forEach((userId) => {
    db.planMembers.push({ id: randomUUID(), planId: plan.id, userId, role: userId === input.creatorId ? "host" : "guest" });
    ensureChatMember(db, chat.id, userId);
  });
  ensureGroupPromotion(db, chat.id);
  const whenLabel = plan.timeLabel ?? plan.time ?? "soon";
  const sourceLabel = plan.sourceName ?? plan.location ?? plan.title;
  const sourceIcon =
    plan.sourceType === "event" ? "🎟" : plan.sourceType === "map" ? "📍" : "✨";
  const sourcePrefix =
    plan.sourceType === "event" ? "plan from" : plan.sourceType === "map" ? "plan at" : "plan";
  db.messages.push({
    id: randomUUID(),
    chatId: chat.id,
    senderUserId: input.creatorId,
    text: `${sourceIcon} ${sourcePrefix} ${sourceLabel} · ${whenLabel}`,
    createdAt,
    system: true,
  });
  pendingInviteIds.forEach((toUserId) => {
    ensurePendingRequest(db, input.creatorId, toUserId, {
      kind: "plan_invite",
      planId: plan.id,
      message: `Plan invite: ${plan.title}`,
    });
  });
  visibleInviteIds.forEach((toUserId) => {
    sendConnectPushToUser(toUserId, {
      kind: "plan_invite",
      chatId: instantInviteIds.includes(toUserId) ? chat.id : plan.id,
      title: plan.title,
      body: `${userProfile(db, input.creatorId).name} invited you to ${plan.title}`,
      data: {
        planId: plan.id,
        creatorId: input.creatorId,
        pending: !instantInviteIds.includes(toUserId),
      },
    });
  });
  return { plan, chat };
}

function ensureMockPeopleStories(db: FriendsDb, viewerId: string) {
  const now = Date.now();
  db.friendStories = (db.friendStories ?? []).filter((story) => new Date(story.expiresAt).getTime() > now);
  const hasPeopleStories = db.friendStories.some((story) => story.userId !== viewerId);
  if (hasPeopleStories) return;

  const candidates = db.users.filter((user) => user.id !== viewerId && !isBlocked(db, viewerId, user.id)).slice(0, 4);
  const storySet: Array<{
    type: FriendStory["type"];
    text: string;
    planType?: string;
    location?: string;
  }> = [
    { type: "status", text: "Coffee later? Looking for one or two people to join.", planType: "Coffee", location: "Brickell" },
    { type: "photo", text: "Out in Wynwood tonight. Who wants to come?", planType: "Night Out", location: "Wynwood" },
    { type: "plan_invite", text: "Who wants to join a plan tonight?", planType: "Dinner", location: "Miami" },
    { type: "status", text: "Gym at 6, then smoothies.", planType: "Gym", location: "Downtown Miami" },
  ];

  candidates.forEach((user, index) => {
    const config = storySet[index % storySet.length]!;
    let planId: string | undefined;
    if (config.type === "plan_invite") {
      const { plan } = createFriendPlanWithChat(db, {
        creatorId: user.id,
        title: `${config.planType ?? "Plan"} with ${user.name.split(" ")[0]}`,
        type: config.planType ?? "Plan",
        time: "Tonight at 8:00 PM",
        timeLabel: "Tonight at 8:00 PM",
        scheduledAt: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
        location: config.location,
        visibility: "friends_nearby",
        sourceType: "map",
        sourceName: config.location,
        sourceImageUrl: user.photoUrl,
        invitedUserIds: [],
      });
      planId = plan.id;
    }
    db.friendStories!.push({
      id: randomUUID(),
      userId: user.id,
      type: config.type,
      text: config.text,
      imageUrl: user.photoUrl,
      planType: config.planType,
      planId,
      createdAt: new Date(Date.now() - index * 9 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
  });
}

function planSummary(db: FriendsDb, plan: Plan) {
  const members = db.planMembers.filter((member) => member.planId === plan.id);
  const chatId = plan.chatId ?? db.chats.find((chat) => chat.planId === plan.id)?.id;
  return {
    ...plan,
    creatorId: plan.creatorId ?? plan.creatorUserId,
    chatId,
    creator: userProfile(db, plan.creatorId ?? plan.creatorUserId ?? ""),
    members: members.map((member) => ({ ...member, user: userProfile(db, member.userId) })),
    peopleGoing: members.length,
    lastMessage: chatId ? lastMessageForChat(db, chatId) : undefined,
  };
}

function planFeedCard(db: FriendsDb, plan: Plan, viewerId: string) {
  const creatorId = plan.creatorId ?? plan.creatorUserId ?? "";
  const joinRequest = (db.planJoinRequests ?? []).find(
    (request) => request.planId === plan.id && request.fromUserId === viewerId && request.status === "pending",
  );
  const isMember = db.planMembers.some((member) => member.planId === plan.id && member.userId === viewerId);
  return {
    ...planSummary(db, plan),
    isCreator: creatorId === viewerId,
    isMember,
    joinRequestStatus: joinRequest?.status ?? null,
    joinRequestId: joinRequest?.id,
  };
}

function joinPlanAsMember(db: FriendsDb, plan: Plan, userId: string) {
  const creatorId = plan.creatorId ?? plan.creatorUserId ?? "";
  let chat = db.chats.find((item) => item.id === plan.chatId || item.planId === plan.id);
  if (!chat) {
    chat = {
      id: randomUUID(),
      type: "friend_plan",
      participantIds: unique([creatorId, userId]),
      title: plan.title,
      planId: plan.id,
      createdAt: new Date().toISOString(),
    };
    plan.chatId = chat.id;
    db.chats.push(chat);
  }
  if (!db.planMembers.some((member) => member.planId === plan.id && member.userId === userId)) {
    db.planMembers.push({ id: randomUUID(), planId: plan.id, userId, role: "guest" });
  }
  chat.participantIds = unique([...(chat.participantIds ?? []), creatorId, userId]);
  ensureChatMember(db, chat.id, creatorId);
  ensureChatMember(db, chat.id, userId);
  ensureGroupPromotion(db, chat.id);
  return chat;
}

function requestSummary(db: FriendsDb, viewerId: string, request: ConnectionRequest) {
  const fromUser = userProfile(db, request.fromUserId);
  const toUser = userProfile(db, request.toUserId);
  const otherUser = request.fromUserId === viewerId ? toUser : fromUser;
  const viewer = userProfile(db, viewerId);
  const plan = request.planId ? db.plans.find((item) => item.id === request.planId) : undefined;
  return {
    requestType: "friend",
    ...request,
    direction: request.fromUserId === viewerId ? "outgoing" : "incoming",
    fromUser,
    toUser,
    plan: plan ? planSummary(db, plan) : null,
    sharedInterests: arrayOverlap(viewer.interests, otherUser.interests),
  };
}

function requestVisibleToViewer(db: FriendsDb, viewerId: string, request: ConnectionRequest) {
  const otherUserId = request.fromUserId === viewerId ? request.toUserId : request.fromUserId;
  return !isBlocked(db, viewerId, otherUserId);
}

function planJoinRequestVisibleToViewer(db: FriendsDb, viewerId: string, request: PlanJoinRequest) {
  const otherUserId = request.fromUserId === viewerId ? request.creatorId : request.fromUserId;
  return !isBlocked(db, viewerId, otherUserId);
}

function planJoinRequestSummary(db: FriendsDb, viewerId: string, request: PlanJoinRequest) {
  const plan = db.plans.find((item) => item.id === request.planId);
  return {
    requestType: "plan_join",
    id: request.id,
    fromUserId: request.fromUserId,
    toUserId: request.creatorId,
    status: request.status,
    kind: "plan_join",
    direction: request.fromUserId === viewerId ? "outgoing" : "incoming",
    createdAt: request.createdAt,
    fromUser: userProfile(db, request.fromUserId),
    toUser: userProfile(db, request.creatorId),
    plan: plan ? planSummary(db, plan) : null,
  };
}

router.get("/friends/people/:userId", (req, res) => {
  const db = readDb();
  const userId = req.params.userId;
  const query = String(req.query.q ?? "").trim().toLowerCase();
  const people = db.users
    .filter((user) => user.id !== userId)
    .filter((user) => !isBlocked(db, userId, user.id))
    .map((user) => peopleCard(db, userId, user.id))
    .filter((person) => {
      if (!query) return true;
      return [person.name, person.city, person.neighborhood, person.energy, ...(person.interests ?? [])]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    })
    .sort((a, b) => {
      const statusBoost = (status: string) => (status === "incoming" ? 300 : status === "friends" ? 120 : status === "none" ? 80 : 20);
      const activeBoost = (person: ReturnType<typeof peopleCard>) => (person.activeTonight ? 30 : 0);
      return statusBoost(b.relationshipStatus) + activeBoost(b) + b.compatibility.score - (statusBoost(a.relationshipStatus) + activeBoost(a) + a.compatibility.score);
    });
  writeDb(db);
  res.json({ people });
});

router.post("/friends/actions", async (req, res) => {
  const db = readDb();
  const userId = authUserId(req, req.body.userId);
  const targetUserId = String(req.body.targetUserId ?? "");
  const action = String(req.body.action ?? "");
  const premium = isPremiumUser(db, userId, req.body.isPremium);
  if (!targetUserId) return res.status(400).json({ error: "targetUserId is required" });
  if (userId === targetUserId) return res.status(400).json({ error: "Cannot act on yourself" });
  if (!["pass", "connect", "best_friend"].includes(action)) return res.status(400).json({ error: "action must be pass, connect, or best_friend" });
  if (isBlocked(db, userId, targetUserId)) return res.status(403).json({ error: "This connection is blocked" });

  const swipeUsage = incrementDailyUsage(db, userId, "friend_swipe", 5, premium);
  if (!swipeUsage.allowed) {
    writeDb(db);
    return res.status(402).json({
      premiumRequired: true,
      limitType: "friend_swipe",
      message: "ConnectSphere Plus unlocks unlimited friend swipes.",
    });
  }

  const behavior =
    db.userBehavior.find((item) => item.userId === userId) ??
    (() => {
      const created = { userId, searches: [], likedTags: [], clickedTags: [], interactedUserIds: [] };
      db.userBehavior.push(created);
      return created;
    })();
  behavior.interactedUserIds = unique([...(behavior.interactedUserIds ?? []), targetUserId]);

  if (action === "pass") {
    writeDb(db);
    return res.json({ ok: true, action, remaining: swipeUsage.remaining });
  }

  if (action === "connect") {
    if (areFriends(db, userId, targetUserId)) {
      ensureDirectChat(db, userId, targetUserId);
      const server = await ensureServerFriendConversation(userId, targetUserId, userId, "friend_accept");
      writeDb(db);
      return res.json({ ok: true, action, relationshipStatus: "friends", match: server.match, chat: server.chat, conversation: server.conversation, alreadyFriends: true, remaining: swipeUsage.remaining });
    }
    const reverse = pendingRequestBetween(db, userId, targetUserId);
    if (reverse && reverse.fromUserId === targetUserId && reverse.toUserId === userId) {
      reverse.status = "accepted";
      const { connection } = ensureConnection(db, userId, targetUserId);
      const server = await ensureServerFriendConversation(userId, targetUserId, userId, "friend_accept", reverse.id);
      writeDb(db);
      return res.json({ ok: true, action, relationshipStatus: "friends", connection, match: server.match, chat: server.chat, conversation: server.conversation, mutual: true, remaining: swipeUsage.remaining });
    }
    const request = ensurePendingRequest(db, userId, targetUserId, {
      kind: "friend",
      message: `${userProfile(db, userId).name} wants to be friends.`,
    });
    if (!request) return res.status(403).json({ error: "This connection is blocked" });
    writeDb(db);
    return res.status(201).json({ ok: true, action, relationshipStatus: relationshipStatus(db, userId, targetUserId), request, remaining: swipeUsage.remaining });
  }

  const bestFriendUsage = incrementDailyUsage(db, userId, "best_friend", 1, premium);
  if (!bestFriendUsage.allowed) {
    writeDb(db);
    return res.status(402).json({
      premiumRequired: true,
      limitType: "best_friend",
      message: "ConnectSphere Plus unlocks more Best Friend sends.",
    });
  }
  const { reaction, reused } = upsertFriendReaction(db, userId, targetUserId, "best_friend");
  writeDb(db);
  return res.status(reused ? 200 : 201).json({
    ok: true,
    action,
    reaction,
    reused,
    remaining: swipeUsage.remaining,
    bestFriendRemaining: bestFriendUsage.remaining,
  });
});

router.get("/friends/reactions/:userId", (req, res) => {
  const db = readDb();
  const userId = req.params.userId;
  const premium = isPremiumUser(db, userId, req.query.premium);
  const reactions = (db.friendReactions ?? [])
    .filter((reaction) => reaction.toUserId === userId && reaction.status === "pending")
    .filter((reaction) => !isBlocked(db, userId, reaction.fromUserId))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((reaction) => friendReactionSummary(db, userId, reaction, premium));
  res.json({ reactions, premium });
});

router.post("/friends/reactions/respond", async (req, res) => {
  const db = readDb();
  const userId = authUserId(req, req.body.userId);
  const reactionId = String(req.body.reactionId ?? "");
  const action = String(req.body.action ?? "");
  const premium = isPremiumUser(db, userId, req.body.isPremium);
  const reaction = (db.friendReactions ?? []).find((item) => item.id === reactionId && item.toUserId === userId);
  if (!reaction) return res.status(404).json({ error: "Reaction not found" });
  if (reaction.status !== "pending") return res.status(409).json({ error: "Reaction is no longer pending" });
  if (!["friend_back", "best_friend_back", "pass"].includes(action)) {
    return res.status(400).json({ error: "action must be friend_back, best_friend_back, or pass" });
  }
  if (action !== "pass" && !premium) {
    return res.status(402).json({
      premiumRequired: true,
      limitType: "reaction_reveal",
      message: "ConnectSphere Plus unlocks reaction viewing and replies.",
    });
  }
  reaction.respondedAt = new Date().toISOString();
  if (action === "pass") {
    reaction.status = "passed";
    writeDb(db);
    return res.json({ ok: true, reaction });
  }
  reaction.status = "matched";
  const { connection } = ensureConnection(db, reaction.fromUserId, reaction.toUserId);
  const server = await ensureServerFriendConversation(reaction.fromUserId, reaction.toUserId, userId, "bestie", reaction.id);
  writeDb(db);
  return res.json({ ok: true, matched: true, reaction, connection, match: server.match, chat: server.chat, conversation: server.conversation });
});

router.post("/friends/invites/create", (req, res) => {
  const db = readDb();
  const inviterUserId = authUserId(req, req.body.inviterUserId ?? req.body.userId);
  const existing = (db.friendInvites ?? []).find((invite) => invite.inviterUserId === inviterUserId && !invite.acceptedAt);
  const invite =
    existing ??
    (() => {
      const created = {
        id: randomUUID(),
        token: randomUUID().replace(/-/g, ""),
        inviterUserId,
        createdAt: new Date().toISOString(),
      };
      db.friendInvites = db.friendInvites ?? [];
      db.friendInvites.push(created);
      return created;
    })();
  writeDb(db);
  return res.status(existing ? 200 : 201).json({
    invite,
    token: invite.token,
    url: `connectsphere://onboarding?friendInviteToken=${invite.token}`,
  });
});

router.post("/friends/invites/accept", async (req, res) => {
  const db = readDb();
  const token = String(req.body.token ?? "");
  const userId = authUserId(req, req.body.userId);
  const invite = (db.friendInvites ?? []).find((item) => item.token === token);
  if (!invite) return res.status(404).json({ error: "Invite not found" });
  if (invite.inviterUserId === userId) return res.status(400).json({ error: "Cannot accept your own invite" });
  const { connection } = ensureConnection(db, invite.inviterUserId, userId);
  const server = await ensureServerFriendConversation(invite.inviterUserId, userId, userId, "invite", invite.id);
  invite.acceptedByUserId = userId;
  invite.acceptedAt = invite.acceptedAt ?? new Date().toISOString();
  writeDb(db);
  return res.json({ invite, connection, match: server.match, chat: server.chat, conversation: server.conversation });
});

router.post("/friends/request", async (req, res) => {
  const db = readDb();
  const fromUserId = authUserId(req, req.body.fromUserId);
  const toUserId = String(req.body.toUserId ?? "");
  if (!toUserId) return res.status(400).json({ error: "toUserId is required" });
  if (fromUserId === toUserId) return res.status(400).json({ error: "Cannot send a request to yourself" });
  if (isBlocked(db, fromUserId, toUserId)) return res.status(403).json({ error: "This connection is blocked" });
  if (areFriends(db, fromUserId, toUserId)) {
    ensureDirectChat(db, fromUserId, toUserId);
    const server = await ensureServerFriendConversation(fromUserId, toUserId, fromUserId, "friend_accept");
    writeDb(db);
    return res.json({ request: null, relationshipStatus: "friends", match: server.match, chat: server.chat, conversation: server.conversation, alreadyFriends: true });
  }

  // Mutual match: the other side already has a pending request to me. Auto-accept it.
  const existing = pendingRequestBetween(db, fromUserId, toUserId);
  if (existing && existing.fromUserId === toUserId && existing.toUserId === fromUserId) {
    existing.status = "accepted";
    const { connection } = ensureConnection(db, existing.fromUserId, existing.toUserId);
    const server = await ensureServerFriendConversation(existing.fromUserId, existing.toUserId, fromUserId, "friend_accept", existing.id);
    writeDb(db);
    return res.json({
      request: existing,
      relationshipStatus: "friends",
      connection,
      match: server.match,
      chat: server.chat,
      conversation: server.conversation,
      mutual: true,
    });
  }

  // Idempotent: if a same-direction pending request already exists, return 200.
  const reused = !!existing;
  const request = ensurePendingRequest(db, fromUserId, toUserId, {
    kind: req.body.kind ?? "friend",
    message: typeof req.body.message === "string" ? req.body.message : undefined,
    planId: typeof req.body.planId === "string" ? req.body.planId : undefined,
    storyId: typeof req.body.storyId === "string" ? req.body.storyId : undefined,
  });
  if (!request) return res.status(403).json({ error: "This connection is blocked" });
  writeDb(db);
  return res.status(reused ? 200 : 201).json({
    request,
    relationshipStatus: relationshipStatus(db, fromUserId, toUserId),
    reused,
  });
});

router.post("/friends/request/cancel", (req, res) => {
  const db = readDb();
  const requestId = String(req.body.requestId ?? "");
  const userId = authUserId(req, req.body.userId);
  const request = db.connectionRequests.find((item) => item.id === requestId);
  if (!request) return res.status(404).json({ error: "Request not found" });
  if (request.fromUserId !== userId) return res.status(403).json({ error: "Only the sender can cancel this request" });
  if (request.status !== "pending") return res.status(409).json({ error: "Request is no longer pending" });
  request.status = "canceled";
  writeDb(db);
  return res.json({ request });
});

router.post("/friends/request/respond", async (req, res) => {
  const db = readDb();
  const requestId = String(req.body.requestId ?? "");
  const action = String(req.body.action ?? "");
  const request = db.connectionRequests.find((item) => item.id === requestId);
  if (!request) return res.status(404).json({ error: "Request not found" });
  if (action === "ignore") {
    request.status = "ignored";
    writeDb(db);
    return res.json({ request });
  }
  if (action !== "accept") return res.status(400).json({ error: "action must be accept or ignore" });

  request.status = "accepted";
  const { connection } = ensureConnection(db, request.fromUserId, request.toUserId);
  const server = await ensureServerFriendConversation(request.fromUserId, request.toUserId, request.toUserId, "friend_accept", request.id);
  sendConnectPushToUser(request.fromUserId, {
    kind: "friend_accept",
    chatId: server.chat.id,
    title: "New friend accepted",
    body: `${userProfile(db, request.toUserId).name} accepted - say hi`,
    data: { requestId: request.id, accepterId: request.toUserId },
  });
  if (request.planId) {
    const plan = db.plans.find((item) => item.id === request.planId);
    if (plan) {
      const { chat: planChat } = { chat: db.chats.find((item) => item.id === plan.chatId || item.planId === plan.id) };
      if (!db.planMembers.some((member) => member.planId === plan.id && member.userId === request.toUserId)) {
        db.planMembers.push({ id: randomUUID(), planId: plan.id, userId: request.toUserId, role: "guest" });
      }
      if (planChat) {
        ensureChatMember(db, planChat.id, request.toUserId);
        ensureGroupPromotion(db, planChat.id);
        sendConnectPushToUser(request.fromUserId, {
          kind: "plan_join",
          chatId: planChat.id,
          title: plan.title,
          body: `${userProfile(db, request.toUserId).name} joined ${plan.title}`,
          data: { planId: plan.id, joinedUserId: request.toUserId, requestId: request.id },
        });
      }
    }
  }
  writeDb(db);
  return res.json({ request, connection, match: server.match, chat: server.chat, conversation: server.conversation });
});

router.get("/friends/requests/:userId", (req, res) => {
  const db = readDb();
  const userId = req.params.userId;
  const friendRequests = db.connectionRequests
    .filter((request) => request.status === "pending" && (request.toUserId === userId || request.fromUserId === userId))
    .filter((request) => requestVisibleToViewer(db, userId, request))
    .map((request) => requestSummary(db, userId, request));
  const planRequests = (db.planJoinRequests ?? [])
    .filter((request) => request.status === "pending" && (request.creatorId === userId || request.fromUserId === userId))
    .filter((request) => planJoinRequestVisibleToViewer(db, userId, request))
    .map((request) => planJoinRequestSummary(db, userId, request));
  const requests = [...planRequests, ...friendRequests].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json({ requests });
});

router.get("/friends/plans/:userId", (req, res) => {
  const db = readDb();
  const userId = req.params.userId;
  const plans = db.plans
    .filter((plan) => {
      const creatorId = plan.creatorId ?? plan.creatorUserId;
      if (creatorId && creatorId !== userId && isBlocked(db, userId, creatorId)) return false;
      return (
        creatorId === userId ||
        (plan.invitedUserIds ?? []).includes(userId) ||
        db.planMembers.some((member) => member.planId === plan.id && member.userId === userId)
      );
    })
    .map((plan) => planSummary(db, plan));
  res.json({ plans });
});

router.get("/friends/plans/feed/:userId", (req, res) => {
  const db = readDb();
  const userId = req.params.userId;
  const viewer = userProfile(db, userId);
  const plans = db.plans
    .filter((plan) => {
      const creatorId = plan.creatorId ?? plan.creatorUserId;
      if (!creatorId || creatorId === userId) return false;
      if (isBlocked(db, userId, creatorId)) return false;
      if (db.planMembers.some((member) => member.planId === plan.id && member.userId === userId)) return false;
      const creator = userProfile(db, creatorId);
      return plan.visibility === "friends_nearby" || areFriends(db, userId, creatorId) || creator.city === viewer.city;
    })
    .map((plan) => planFeedCard(db, plan, userId))
    .sort((a, b) => new Date(a.scheduledAt ?? a.createdAt).getTime() - new Date(b.scheduledAt ?? b.createdAt).getTime());
  res.json({ plans });
});

router.post("/friends/plans/create", (req, res) => {
  const db = readDb();
  const creatorId = authUserId(req, req.body.creatorId ?? req.body.creatorUserId);
  const invitedUserIds = unique([
    ...(Array.isArray(req.body.invitedUserIds) ? req.body.invitedUserIds.map(String) : []),
    typeof req.body.invitedUserId === "string" ? req.body.invitedUserId : "",
  ]);

  // Dedupe: if this creator already made a plan from the same source within the
  // last 6 hours, return the existing plan + chat instead of spawning a duplicate.
  const dedupeSourceType = String(req.body.sourceType ?? "");
  const dedupeSourceId = typeof req.body.sourceId === "string" ? req.body.sourceId : "";
  if (dedupeSourceId && (dedupeSourceType === "event" || dedupeSourceType === "map")) {
    const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;
    const existing = db.plans.find((plan) => {
      const planCreator = plan.creatorId ?? plan.creatorUserId;
      const createdAtMs = plan.createdAt ? new Date(plan.createdAt).getTime() : 0;
      return (
        planCreator === creatorId &&
        plan.sourceType === dedupeSourceType &&
        plan.sourceId === dedupeSourceId &&
        createdAtMs >= sixHoursAgo
      );
    });
    if (existing) {
      const existingChat = db.chats.find(
        (chat) => chat.id === existing.chatId || chat.planId === existing.id,
      );
      if (existingChat) {
        return res.status(200).json({ plan: planSummary(db, existing), chat: existingChat, deduped: true });
      }
    }
  }

  if (invitedUserIds.length > 0) {
    const planUsage = incrementDailyUsage(db, creatorId, "friend_plan", 1, false);
    if (!planUsage.allowed) {
      writeDb(db);
      return res.status(429).json({
        limitType: "friend_plan",
        message: "You get one direct friend plan request per day. Try again tomorrow.",
      });
    }
  }

  const result = createFriendPlanWithChat(db, {
    creatorId,
    title: String(req.body.title ?? "New plan"),
    type: String(req.body.type ?? "Coffee"),
    time: typeof req.body.time === "string" ? req.body.time : undefined,
    timeLabel: typeof req.body.timeLabel === "string" ? req.body.timeLabel : undefined,
    scheduledAt: typeof req.body.scheduledAt === "string" ? req.body.scheduledAt : undefined,
    location: typeof req.body.location === "string" ? req.body.location : undefined,
    visibility: "friends_nearby",
    sourceType: ["map", "event", "custom"].includes(String(req.body.sourceType)) ? req.body.sourceType : "custom",
    sourceId: typeof req.body.sourceId === "string" ? req.body.sourceId : undefined,
    sourceName: typeof req.body.sourceName === "string" ? req.body.sourceName : undefined,
    sourceImageUrl: typeof req.body.sourceImageUrl === "string" ? req.body.sourceImageUrl : undefined,
    latitude: typeof req.body.latitude === "number" ? req.body.latitude : undefined,
    longitude: typeof req.body.longitude === "number" ? req.body.longitude : undefined,
    invitedUserIds,
  });
  writeDb(db);
  return res.status(201).json(result);
});

// Mint a tokenized share link for a plan. Anyone with the link can RSVP (Phase 4).
router.post("/friends/plans/share-link", (req, res) => {
  const db = readDb();
  const userId = authUserId(req, req.body.userId);
  const planId = String(req.body.planId ?? "");
  const plan = db.plans.find((item) => item.id === planId);
  if (!plan) return res.status(404).json({ error: "Plan not found" });
  const creatorId = plan.creatorId ?? plan.creatorUserId ?? "";
  // Only the creator or an existing plan member can mint a share link.
  const isMember = db.planMembers.some((member) => member.planId === planId && member.userId === userId);
  if (creatorId !== userId && !isMember) {
    return res.status(403).json({ error: "Only plan members can share this plan" });
  }
  db.planShareLinks = db.planShareLinks ?? [];
  // Reuse an existing non-revoked link if the user already minted one.
  const existing = db.planShareLinks.find(
    (link) => link.planId === planId && link.createdByUserId === userId && !link.revokedAt,
  );
  const token = existing?.token ?? randomUUID();
  if (!existing) {
    db.planShareLinks.push({
      id: randomUUID(),
      planId,
      token,
      createdByUserId: userId,
      createdAt: new Date().toISOString(),
    });
  }
  writeDb(db);
  const baseUrl = process.env.SHARE_LINK_BASE_URL ?? "https://connectsphere.app";
  return res.status(existing ? 200 : 201).json({
    token,
    planId,
    url: `${baseUrl}/p/${token}`,
    reused: !!existing,
  });
});

// Redeem a share-link token to join a plan. Anyone signed in can hit this.
router.post("/friends/plans/rsvp-link", (req, res) => {
  const db = readDb();
  const userId = authUserId(req, req.body.userId);
  const token = String(req.body.token ?? "");
  if (!token) return res.status(400).json({ error: "token is required" });
  db.planShareLinks = db.planShareLinks ?? [];
  db.planShareLinkRedemptions = db.planShareLinkRedemptions ?? [];
  const link = db.planShareLinks.find((item) => item.token === token && !item.revokedAt);
  if (!link) return res.status(404).json({ error: "This invite link is no longer valid" });
  const plan = db.plans.find((item) => item.id === link.planId);
  if (!plan) return res.status(404).json({ error: "Plan not found" });
  const creatorId = plan.creatorId ?? plan.creatorUserId ?? "";
  if (creatorId && isBlocked(db, userId, creatorId)) {
    return res.status(403).json({ error: "This plan is blocked" });
  }
  const alreadyMember =
    creatorId === userId ||
    db.planMembers.some((member) => member.planId === plan.id && member.userId === userId);
  const chat =
    db.chats.find((item) => item.id === plan.chatId || item.planId === plan.id) ?? null;
  if (alreadyMember) {
    // Idempotent: log redemption but skip duplicate membership writes.
    db.planShareLinkRedemptions.push({
      id: randomUUID(),
      token,
      planId: plan.id,
      userId,
      createdAt: new Date().toISOString(),
    });
    writeDb(db);
    return res.json({
      plan: planSummary(db, plan),
      chat,
      joinedViaLink: true,
      isFirstJoinForThisUser: false,
      alreadyMember: true,
    });
  }
  db.planMembers.push({ id: randomUUID(), planId: plan.id, userId, role: "guest" });
  if (chat) {
    ensureChatMember(db, chat.id, userId);
    ensureGroupPromotion(db, chat.id);
  }
  // System message: who joined and via link.
  if (chat) {
    db.messages.push({
      id: randomUUID(),
      chatId: chat.id,
      senderUserId: userId,
      text: "🔗 joined via share link",
      createdAt: new Date().toISOString(),
      system: true,
    });
  }
  const isFirstRedemption = !db.planShareLinkRedemptions.some(
    (entry) => entry.userId === userId && entry.token === token,
  );
  db.planShareLinkRedemptions.push({
    id: randomUUID(),
    token,
    planId: plan.id,
    userId,
    createdAt: new Date().toISOString(),
  });
  if (chat && creatorId && creatorId !== userId) {
    sendConnectPushToUser(creatorId, {
      kind: "plan_join",
      chatId: chat.id,
      title: plan.title,
      body: `${userProfile(db, userId).name} joined ${plan.title}`,
      data: { planId: plan.id, joinedUserId: userId, shareToken: token },
    });
  }
  writeDb(db);
  return res.status(201).json({
    plan: planSummary(db, plan),
    chat,
    joinedViaLink: true,
    isFirstJoinForThisUser: isFirstRedemption,
  });
});

// Revoke a share link so further taps return 404.
router.post("/friends/plans/share-link/revoke", (req, res) => {
  const db = readDb();
  const userId = authUserId(req, req.body.userId);
  const token = String(req.body.token ?? "");
  db.planShareLinks = db.planShareLinks ?? [];
  const link = db.planShareLinks.find((item) => item.token === token);
  if (!link) return res.status(404).json({ error: "Link not found" });
  const plan = db.plans.find((item) => item.id === link.planId);
  const creatorId = plan?.creatorId ?? plan?.creatorUserId ?? "";
  // Only the link's creator OR the plan's host may revoke.
  if (link.createdByUserId !== userId && creatorId !== userId) {
    return res.status(403).json({ error: "Only the link creator or plan host may revoke" });
  }
  link.revokedAt = new Date().toISOString();
  writeDb(db);
  return res.json({ token, revokedAt: link.revokedAt });
});

router.post("/friends/plans/join", (req, res) => {
  const db = readDb();
  const userId = authUserId(req, req.body.userId);
  const planId = String(req.body.planId ?? "");
  const plan = db.plans.find((item) => item.id === planId);
  if (!plan) return res.status(404).json({ error: "Plan not found" });
  const creatorId = plan.creatorId ?? plan.creatorUserId ?? "";
  if (creatorId && isBlocked(db, userId, creatorId)) return res.status(403).json({ error: "This plan is blocked" });
  if (creatorId === userId || db.planMembers.some((member) => member.planId === planId && member.userId === userId)) {
    const chat = db.chats.find((item) => item.id === plan.chatId || item.planId === plan.id) ?? joinPlanAsMember(db, plan, userId);
    if (creatorId && creatorId !== userId) {
      sendConnectPushToUser(creatorId, {
        kind: "plan_join",
        chatId: chat.id,
        title: plan.title,
        body: `${userProfile(db, userId).name} joined ${plan.title}`,
        data: { planId: plan.id, joinedUserId: userId },
      });
    }
    writeDb(db);
    return res.json({ plan: planSummary(db, plan), chat, request: null, status: "joined" });
  }
  db.planJoinRequests = db.planJoinRequests ?? [];
  const existing = db.planJoinRequests.find((request) => request.planId === planId && request.fromUserId === userId && request.status === "pending");
  const request = existing ?? {
    id: randomUUID(),
    planId,
    fromUserId: userId,
    creatorId,
    status: "pending" as const,
    createdAt: new Date().toISOString(),
  };
  if (!existing) db.planJoinRequests.push(request);
  if (!existing && creatorId) {
    const chat = db.chats.find((item) => item.id === plan.chatId || item.planId === plan.id);
    if (chat) {
      sendConnectPushToUser(creatorId, {
        kind: "plan_join",
        chatId: chat.id,
        title: plan.title,
        body: `${userProfile(db, userId).name} asked to join ${plan.title}`,
        data: { planId: plan.id, requestId: request.id, joinedUserId: userId },
      });
    }
  }
  writeDb(db);
  return res.status(existing ? 200 : 201).json({ plan: planSummary(db, plan), request, status: "pending" });
});

router.post("/friends/plans/request-join", (req, res) => {
  const db = readDb();
  const userId = authUserId(req, req.body.userId);
  const planId = String(req.body.planId ?? "");
  const plan = db.plans.find((item) => item.id === planId);
  if (!plan) return res.status(404).json({ error: "Plan not found" });
  const creatorId = plan.creatorId ?? plan.creatorUserId ?? "";
  if (creatorId && isBlocked(db, userId, creatorId)) return res.status(403).json({ error: "This plan is blocked" });
  if (creatorId === userId || db.planMembers.some((member) => member.planId === planId && member.userId === userId)) {
    const chat = db.chats.find((item) => item.id === plan.chatId || item.planId === plan.id) ?? joinPlanAsMember(db, plan, userId);
    if (creatorId && creatorId !== userId) {
      sendConnectPushToUser(creatorId, {
        kind: "plan_join",
        chatId: chat.id,
        title: plan.title,
        body: `${userProfile(db, userId).name} joined ${plan.title}`,
        data: { planId: plan.id, joinedUserId: userId },
      });
    }
    writeDb(db);
    return res.json({ plan: planSummary(db, plan), chat, request: null, status: "joined" });
  }
  db.planJoinRequests = db.planJoinRequests ?? [];
  const existing = db.planJoinRequests.find((request) => request.planId === planId && request.fromUserId === userId && request.status === "pending");
  const request = existing ?? {
    id: randomUUID(),
    planId,
    fromUserId: userId,
    creatorId,
    status: "pending" as const,
    createdAt: new Date().toISOString(),
  };
  if (!existing) db.planJoinRequests.push(request);
  if (!existing && creatorId) {
    const chat = db.chats.find((item) => item.id === plan.chatId || item.planId === plan.id);
    if (chat) {
      sendConnectPushToUser(creatorId, {
        kind: "plan_join",
        chatId: chat.id,
        title: plan.title,
        body: `${userProfile(db, userId).name} asked to join ${plan.title}`,
        data: { planId: plan.id, requestId: request.id, joinedUserId: userId },
      });
    }
  }
  writeDb(db);
  return res.status(existing ? 200 : 201).json({ plan: planSummary(db, plan), request, status: "pending" });
});

router.post("/friends/plans/cancel-join", (req, res) => {
  const db = readDb();
  const requestId = String(req.body.requestId ?? "");
  const userId = authUserId(req, req.body.userId);
  const request = (db.planJoinRequests ?? []).find((item) => item.id === requestId);
  if (!request) return res.status(404).json({ error: "Plan request not found" });
  if (request.fromUserId !== userId) return res.status(403).json({ error: "Only the requester can cancel this join request" });
  if (request.status !== "pending") return res.status(409).json({ error: "Plan request is no longer pending" });
  request.status = "canceled";
  const plan = db.plans.find((item) => item.id === request.planId);
  writeDb(db);
  return res.json({ request, plan: plan ? planSummary(db, plan) : null });
});

router.post("/friends/plans/respond-join", (req, res) => {
  const db = readDb();
  const requestId = String(req.body.requestId ?? "");
  const creatorId = authUserId(req, req.body.creatorId);
  const action = String(req.body.action ?? "");
  const request = (db.planJoinRequests ?? []).find((item) => item.id === requestId);
  if (!request) return res.status(404).json({ error: "Plan request not found" });
  if (request.creatorId !== creatorId) return res.status(403).json({ error: "Only the creator can respond" });
  const plan = db.plans.find((item) => item.id === request.planId);
  if (!plan) return res.status(404).json({ error: "Plan not found" });
  if (action === "decline") {
    request.status = "declined";
    writeDb(db);
    return res.json({ request, plan: planSummary(db, plan) });
  }
  if (action !== "accept") return res.status(400).json({ error: "action must be accept or decline" });
  request.status = "accepted";
  const chat = joinPlanAsMember(db, plan, request.fromUserId);
  db.messages.push({
    id: randomUUID(),
    chatId: chat.id,
    senderId: "system",
    senderUserId: "system",
    text: `${userProfile(db, request.fromUserId).name} joined the plan.`,
    createdAt: new Date().toISOString(),
    system: true,
  });
  sendConnectPushToUser(request.fromUserId, {
    kind: "plan_join",
    chatId: chat.id,
    title: plan.title,
    body: `You're in ${plan.title} - chat opened`,
    data: { planId: plan.id, requestId: request.id, creatorId },
  });
  writeDb(db);
  return res.json({ request, plan: planSummary(db, plan), chat });
});

router.get("/friends/stories/:userId", (req, res) => {
  const db = readDb();
  const viewerId = req.params.userId;
  ensureMockPeopleStories(db, viewerId);
  const stories = (db.friendStories ?? [])
    .filter((story) => story.userId === viewerId || !isBlocked(db, viewerId, story.userId))
    .map((story) => ({
      ...story,
      user: userProfile(db, story.userId),
      relationshipStatus: story.userId === viewerId ? "self" : relationshipStatus(db, viewerId, story.userId),
      reactions: (db.friendStoryReactions ?? []).filter((reaction) => reaction.storyId === story.id),
      isOwn: story.userId === viewerId,
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  writeDb(db);
  res.json({ stories });
});

router.post("/friends/stories/create", (req, res) => {
  const db = readDb();
  const userId = authUserId(req, req.body.userId);
  const type = ["status", "photo", "plan_invite"].includes(String(req.body.type)) ? String(req.body.type) : "status";
  const createdAt = new Date().toISOString();
  let planId: string | undefined;
  if (type === "plan_invite") {
    const { plan } = createFriendPlanWithChat(db, {
      creatorId: userId,
      title: String(req.body.text ?? `${req.body.planType ?? "Plan"} invite`),
      type: String(req.body.planType ?? "Coffee"),
      time: typeof req.body.time === "string" ? req.body.time : undefined,
      timeLabel: typeof req.body.timeLabel === "string" ? req.body.timeLabel : undefined,
      scheduledAt: typeof req.body.scheduledAt === "string" ? req.body.scheduledAt : undefined,
      location: typeof req.body.location === "string" ? req.body.location : undefined,
      visibility: "friends_nearby",
      sourceType: "custom",
      invitedUserIds: [],
    });
    planId = plan.id;
  }
  const story: FriendStory = {
    id: randomUUID(),
    userId,
    type: type as FriendStory["type"],
    text: typeof req.body.text === "string" ? req.body.text : undefined,
    imageUrl: typeof req.body.imageUrl === "string" ? req.body.imageUrl : undefined,
    planType: typeof req.body.planType === "string" ? req.body.planType : undefined,
    planId,
    createdAt,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
  db.friendStories = db.friendStories ?? [];
  db.friendStories.unshift(story);
  writeDb(db);
  res.status(201).json({ story });
});

router.post("/friends/stories/react", (req, res) => {
  const db = readDb();
  const userId = authUserId(req, req.body.userId);
  const storyId = String(req.body.storyId ?? "");
  const story = (db.friendStories ?? []).find((item) => item.id === storyId);
  if (!story) return res.status(404).json({ error: "Story not found" });
  if (isBlocked(db, userId, story.userId)) return res.status(403).json({ error: "This story is blocked" });
  const reaction = {
    id: randomUUID(),
    storyId,
    userId,
    reaction: String(req.body.reaction ?? "spark"),
    createdAt: new Date().toISOString(),
  };
  db.friendStoryReactions = db.friendStoryReactions ?? [];
  db.friendStoryReactions.push(reaction);
  writeDb(db);
  return res.status(201).json({ reaction });
});

router.post("/friends/stories/reply", (req, res) => {
  const db = readDb();
  const userId = authUserId(req, req.body.userId);
  const storyId = String(req.body.storyId ?? "");
  const text = String(req.body.text ?? "Loved your story.");
  const story = (db.friendStories ?? []).find((item) => item.id === storyId);
  if (!story) return res.status(404).json({ error: "Story not found" });
  if (areFriends(db, userId, story.userId)) {
    const chat = ensureDirectChat(db, userId, story.userId);
    const message: Message = {
      id: randomUUID(),
      chatId: chat.id,
      senderId: userId,
      senderUserId: userId,
      text,
      createdAt: new Date().toISOString(),
    };
    db.messages.push(message);
    writeDb(db);
    return res.status(201).json({ mode: "chat", chat, message });
  }

  const request = ensurePendingRequest(db, userId, story.userId, { kind: "story_reply", message: text, storyId });
  if (!request) return res.status(403).json({ error: "This connection is blocked" });
  writeDb(db);
  return res.status(201).json({ mode: "request", request });
});

router.post("/friends/icebreakers/generate", async (req, res) => {
  const db = readDb();
  const userId = authUserId(req, req.body.userId);
  const context = icebreakerContextFromBody(db, req.body, userId);
  const suggestions = await generateFriendIcebreakers(context);
  return res.json({ suggestions });
});

router.post("/friends/icebreakers/send", (req, res) => {
  const db = readDb();
  const userId = authUserId(req, req.body.userId);
  const text = String(req.body.text ?? "").trim();
  if (!text) return res.status(400).json({ error: "text is required" });

  const kind = String(req.body.kind ?? "person");
  const targetUserId = typeof req.body.targetUserId === "string" ? req.body.targetUserId : "";
  const storyId = typeof req.body.storyId === "string" ? req.body.storyId : "";
  const planId = typeof req.body.planId === "string" ? req.body.planId : "";
  const chatId = typeof req.body.chatId === "string" ? req.body.chatId : "";
  const requestId = typeof req.body.requestId === "string" ? req.body.requestId : "";

  if (kind === "chat" && chatId) {
    const chat = db.chats.find((item) => item.id === chatId);
    if (!chat) return res.status(404).json({ error: "Chat not found" });
    ensureChatMember(db, chatId, userId);
    const message = addChatMessage(db, chatId, userId, text);
    writeDb(db);
    return res.status(201).json({ mode: "chat", chat, message });
  }

  if (kind === "request" && requestId) {
    const request = db.connectionRequests.find((item) => item.id === requestId);
    if (!request) return res.status(404).json({ error: "Request not found" });
    if (request.toUserId !== userId && request.fromUserId !== userId) return res.status(403).json({ error: "Request is not yours" });
    request.status = "accepted";
    const { connection, chat } = ensureConnection(db, request.fromUserId, request.toUserId);
    const message = addChatMessage(db, chat.id, userId, text);
    writeDb(db);
    return res.status(201).json({ mode: "chat", request, connection, chat, message });
  }

  if (kind === "story" && storyId) {
    const story = (db.friendStories ?? []).find((item) => item.id === storyId);
    if (!story) return res.status(404).json({ error: "Story not found" });
    if (areFriends(db, userId, story.userId)) {
      const chat = ensureDirectChat(db, userId, story.userId);
      const message = addChatMessage(db, chat.id, userId, text);
      writeDb(db);
      return res.status(201).json({ mode: "chat", chat, message });
    }
    const request = ensurePendingRequest(db, userId, story.userId, { kind: "story_reply", message: text, storyId });
    if (!request) return res.status(403).json({ error: "This connection is blocked" });
    writeDb(db);
    return res.status(201).json({ mode: "request", request });
  }

  if (kind === "plan" && planId) {
    const plan = db.plans.find((item) => item.id === planId);
    if (!plan) return res.status(404).json({ error: "Plan not found" });
    const creatorId = plan.creatorId ?? plan.creatorUserId ?? "";
    const isMember = db.planMembers.some((member) => member.planId === plan.id && member.userId === userId);
    if (isMember || creatorId === userId || areFriends(db, userId, creatorId)) {
      const chat = db.chats.find((item) => item.id === plan.chatId || item.planId === plan.id) ?? joinPlanAsMember(db, plan, userId);
      const message = addChatMessage(db, chat.id, userId, text);
      writeDb(db);
      return res.status(201).json({ mode: "plan", plan: planSummary(db, plan), chat, message });
    }
    db.planJoinRequests = db.planJoinRequests ?? [];
    const existing = db.planJoinRequests.find((item) => item.planId === planId && item.fromUserId === userId && item.status === "pending");
    const request =
      existing ??
      {
        id: randomUUID(),
        planId,
        fromUserId: userId,
        creatorId,
        status: "pending" as const,
        createdAt: new Date().toISOString(),
      };
    if (!existing) db.planJoinRequests.push(request);
    writeDb(db);
    return res.status(existing ? 200 : 201).json({ mode: "request", request, plan: planSummary(db, plan) });
  }

  if (!targetUserId) return res.status(400).json({ error: "targetUserId is required" });
  if (isBlocked(db, userId, targetUserId)) return res.status(403).json({ error: "This connection is blocked" });
  if (areFriends(db, userId, targetUserId)) {
    const chat = ensureDirectChat(db, userId, targetUserId);
    const message = addChatMessage(db, chat.id, userId, text);
    writeDb(db);
    return res.status(201).json({ mode: "chat", chat, message });
  }
  const request = ensurePendingRequest(db, userId, targetUserId, { kind: "friend", message: text });
  if (!request) return res.status(403).json({ error: "This connection is blocked" });
  writeDb(db);
  return res.status(201).json({ mode: "request", request });
});

router.delete("/friends/stories/:storyId", (req, res) => {
  const db = readDb();
  const storyId = req.params.storyId;
  db.friendStories = (db.friendStories ?? []).filter((story) => story.id !== storyId);
  db.friendStoryReactions = (db.friendStoryReactions ?? []).filter((reaction) => reaction.storyId !== storyId);
  writeDb(db);
  res.json({ success: true });
});

router.post("/friends/block", async (req, res) => {
  const db = readDb();
  const userId = authUserId(req, req.body.userId);
  const blockedUserId = String(req.body.blockedUserId ?? "");
  if (!blockedUserId) return res.status(400).json({ error: "blockedUserId is required" });
  if (blockedUserId === userId) return res.status(400).json({ error: "You cannot block yourself" });

  db.blockedUsers = db.blockedUsers ?? [];
  let block = db.blockedUsers.find((item) => item.userId === userId && item.blockedUserId === blockedUserId);
  if (!block) {
    block = { id: randomUUID(), userId, blockedUserId, createdAt: new Date().toISOString() };
    db.blockedUsers.push(block);
  }

  db.connectionRequests.forEach((request) => {
    if (
      request.status === "pending" &&
      ((request.fromUserId === userId && request.toUserId === blockedUserId) ||
        (request.fromUserId === blockedUserId && request.toUserId === userId))
    ) {
      request.status = "canceled";
    }
  });
  (db.planJoinRequests ?? []).forEach((request) => {
    if (
      request.status === "pending" &&
      ((request.fromUserId === userId && request.creatorId === blockedUserId) ||
        (request.fromUserId === blockedUserId && request.creatorId === userId))
    ) {
      request.status = "canceled";
    }
  });
  db.connections = db.connections.filter((connection) => {
    const ids = connection.userIds ?? [connection.userAId, connection.userBId];
    return !(ids.includes(userId) && ids.includes(blockedUserId));
  });

  const canonicalBlock = await ensureCanonicalBlock(userId, blockedUserId);
  writeDb(db);
  return res.json({ block: canonicalBlock });
});

router.post("/friends/report", (req, res) => {
  const db = readDb();
  const userId = authUserId(req, req.body.userId);
  const reportedUserId = String(req.body.reportedUserId ?? "");
  if (!reportedUserId) return res.status(400).json({ error: "reportedUserId is required" });
  const report: FriendReport = {
    id: randomUUID(),
    userId,
    reportedUserId,
    reason: typeof req.body.reason === "string" ? req.body.reason : undefined,
    context: typeof req.body.context === "string" ? req.body.context : undefined,
    createdAt: new Date().toISOString(),
  };
  db.userReports = db.userReports ?? [];
  db.userReports.push(report);
  writeDb(db);
  return res.status(201).json({ report });
});

router.get("/friends/feed/:userId", (req, res) => {
  const db = readDb();
  const userId = req.params.userId;
  res.json({ feed: buildFriendsFeed(userId, db), users: db.users });
});

router.post("/friends/posts/create", (req, res) => {
  const db = readDb();
  const userId = authUserId(req, req.body.userId);
  const post: FriendPost = {
    id: randomUUID(),
    userId,
    text: String(req.body.text ?? ""),
    tag: String(req.body.tag ?? "Coffee"),
    imageUrl: typeof req.body.imageUrl === "string" ? req.body.imageUrl : undefined,
    createdAt: new Date().toISOString(),
  };
  db.friendPosts.unshift(post);
  writeDb(db);
  res.status(201).json({ post });
});

router.post("/friends/posts/like", (req, res) => {
  const db = readDb();
  const userId = authUserId(req, req.body.userId);
  const postId = String(req.body.postId ?? "");
  const existing = db.postLikes.find((like) => like.postId === postId && like.userId === userId);
  if (!existing) db.postLikes.push({ id: randomUUID(), postId, userId, createdAt: new Date().toISOString() });
  writeDb(db);
  res.json({ liked: true });
});

router.post("/friends/comments/create", (req, res) => {
  const db = readDb();
  const comment = {
    id: randomUUID(),
    postId: String(req.body.postId ?? ""),
    userId: authUserId(req, req.body.userId),
    text: String(req.body.text ?? ""),
    createdAt: new Date().toISOString(),
  };
  db.postComments.push(comment);
  writeDb(db);
  res.status(201).json({ comment });
});

router.post("/friends/connect/request", (req, res) => {
  const db = readDb();
  const fromUserId = authUserId(req, req.body.fromUserId);
  const toUserId = String(req.body.toUserId ?? "");
  if (isBlocked(db, fromUserId, toUserId)) return res.status(403).json({ error: "This connection is blocked" });
  const existing = pendingRequestBetween(db, fromUserId, toUserId);
  const request = ensurePendingRequest(db, fromUserId, toUserId);
  if (!request) return res.status(403).json({ error: "This connection is blocked" });
  writeDb(db);
  return res.status(existing ? 200 : 201).json({ request });
});

router.post("/friends/connect/accept", async (req, res) => {
  const db = readDb();
  const requestId = String(req.body.requestId ?? "");
  const request = db.connectionRequests.find((item) => item.id === requestId);
  if (!request) return res.status(404).json({ error: "Request not found" });
  request.status = "accepted";
  const { connection } = ensureConnection(db, request.fromUserId, request.toUserId);
  const server = await ensureServerFriendConversation(request.fromUserId, request.toUserId, request.toUserId, "friend_accept", request.id);
  sendConnectPushToUser(request.fromUserId, {
    kind: "friend_accept",
    chatId: server.chat.id,
    title: "New friend accepted",
    body: `${userProfile(db, request.toUserId).name} accepted - say hi`,
    data: { requestId: request.id, accepterId: request.toUserId },
  });
  writeDb(db);
  return res.json({ request, connection, match: server.match, chat: server.chat, conversation: server.conversation });
});

router.post("/friends/connect/ignore", (req, res) => {
  const db = readDb();
  const requestId = String(req.body.requestId ?? "");
  const request = db.connectionRequests.find((item) => item.id === requestId);
  if (!request) return res.status(404).json({ error: "Request not found" });
  request.status = "ignored";
  writeDb(db);
  return res.json({ request });
});

router.get("/connect/:userId", (req, res) => {
  const db = readDb();
  const userId = req.params.userId;
  const pairInfo = (pairId: string) => {
    const pair = db.doubleDatePairs?.find((item) => item.id === pairId);
    if (!pair) return null;
    return {
      ...pair,
      users: pair.userIds.map((id) => userProfile(db, id)),
      names: pair.userIds.map((id) => userProfile(db, id).name),
    };
  };
  const requests = db.connectionRequests
    .filter((request) => request.toUserId === userId && request.status === "pending")
    .filter((request) => requestVisibleToViewer(db, userId, request))
    .map((request) => requestSummary(db, userId, request));
  const connections = db.connections
    .filter((connection) => {
      const ids = connection.userIds ?? [connection.userAId, connection.userBId];
      const otherUserId = ids.find((id) => id !== userId) ?? "";
      return ids.includes(userId) && !isBlocked(db, userId, otherUserId);
    })
    .map((connection) => {
      const ids = connection.userIds ?? [connection.userAId, connection.userBId];
      const otherUserId = ids.find((id) => id !== userId) ?? ids[0];
      const chat = connection.chatId ? db.chats.find((item) => item.id === connection.chatId) : ensureDirectChat(db, ids[0], ids[1]);
      if (chat && connection.chatId !== chat.id) connection.chatId = chat.id;
      return {
        ...connection,
        userIds: ids,
        otherUser: userProfile(db, otherUserId),
        chatId: chat?.id ?? connection.chatId,
        chat,
        lastMessage: chat ? lastMessageForChat(db, chat.id) : undefined,
      };
    });
  const connectionChatIds = new Set(connections.map((connection) => connection.chatId).filter(Boolean));
  const userChats = db.chats.filter(
    (chat) => connectionChatIds.has(chat.id) || db.chatMembers.some((member) => member.chatId === chat.id && member.userId === userId),
  );
  const friendPlans = db.plans
    .filter((plan) => {
      const creatorId = plan.creatorId ?? plan.creatorUserId ?? "";
      return db.planMembers.some((member) => member.planId === plan.id && member.userId === userId) && !isBlocked(db, userId, creatorId);
    })
    .map((plan) => planSummary(db, plan));
  const doubleDateMatches = (db.doubleDateMatches ?? [])
    .filter((match) => match.userIds.includes(userId))
    .map((match) => ({
      ...match,
      pairs: match.pairIds.map(pairInfo).filter(Boolean),
      users: match.userIds.map((id) => userProfile(db, id)),
      chatId: match.chatId,
      lastMessage: lastMessageForChat(db, match.chatId),
    }));
  const chats = userChats.map((chat) => ({
    ...chat,
    members: db.chatMembers.filter((member) => member.chatId === chat.id),
    participants: db.chatMembers.filter((member) => member.chatId === chat.id).map((member) => userProfile(db, member.userId)),
    lastMessage: lastMessageForChat(db, chat.id),
  }));

  writeDb(db);
  res.json({
    requests: [
      ...requests,
      ...(db.planJoinRequests ?? [])
        .filter((request) => request.creatorId === userId && request.status === "pending")
        .filter((request) => planJoinRequestVisibleToViewer(db, userId, request))
        .map((request) => planJoinRequestSummary(db, userId, request)),
    ],
    connections,
    friends: connections,
    datingMatches: (db.datingMatches ?? []).filter((match) => match.userAId === userId || match.userBId === userId),
    friendPlans,
    plans: friendPlans,
    opportunityChats: [],
    doubleDateMatches,
    chats,
    activePlans: friendPlans,
  });
});

router.get("/chats/:chatId", (req, res) => {
  const db = readDb();
  const chatId = req.params.chatId;
  const chat = db.chats.find((item) => item.id === chatId);
  const members = db.chatMembers.filter((member) => member.chatId === chatId);
  const participants = members.map((member) => db.users.find((user) => user.id === member.userId) ?? { id: member.userId, name: "Someone" });
  res.json({
    chat,
    members,
    participants,
    messages: db.messages.filter((message) => message.chatId === chatId),
    quickActions:
      chat?.type === "double_date"
        ? ["Drinks", "Dinner", "Event Tonight", "Pick a Spot"]
        : chat?.type === "friend_direct" || chat?.type === "friend_plan" || chat?.type === "plan"
          ? ["AI opener", "Make a plan", "Pick a spot", "Invite more"]
          : [],
  });
});

router.post("/messages/send", (req, res) => {
  const db = readDb();
  const message: Message = {
    id: randomUUID(),
    chatId: String(req.body.chatId ?? ""),
    senderId: authUserId(req, req.body.senderUserId),
    senderUserId: authUserId(req, req.body.senderUserId),
    text: String(req.body.text ?? ""),
    createdAt: new Date().toISOString(),
  };
  db.messages.push(message);
  writeDb(db);
  res.status(201).json({ message });
});

// ═══════════════════════════════════════════════════════════════════════════
// INBOX v2 — Reactions · Requests · Primary
// ═══════════════════════════════════════════════════════════════════════════

function resolveUserPreview(db: FriendsDb, userId: string): { name: string; photoUrl?: string; age?: number; neighborhood?: string } {
  const u = db.users.find((x) => x.id === userId);
  return { name: u?.name ?? "Someone", photoUrl: u?.photoUrl, age: u?.age, neighborhood: u?.neighborhood };
}

function ensureCsConversation(
  db: FriendsDb,
  participantIds: string[],
  opts: { type?: CsConversationType; sourceReactionId?: string; sourceRequestId?: string; planTitle?: string }
): CsConversation {
  // Prevent duplicate conversations between same pair
  const sorted = [...participantIds].sort();
  const existing = (db.csConversations ?? []).find((c) => {
    const cs = [...(c.participantIds ?? [])].sort();
    return cs.length === sorted.length && cs.every((id, i) => id === sorted[i]) && c.status === "active";
  });
  if (existing) return existing;

  const conv: CsConversation = {
    id: randomUUID(),
    participantIds,
    type: opts.type ?? "direct",
    category: "primary",
    status: "active",
    sourceReactionId: opts.sourceReactionId,
    sourceRequestId: opts.sourceRequestId,
    hasMessages: false,
    createdAt: new Date().toISOString(),
  };
  if (!db.csConversations) db.csConversations = [];
  db.csConversations.push(conv);
  return conv;
}

// ── POST /inbox/reactions/send ────────────────────────────────────────────
router.post("/inbox/reactions/send", (req, res) => {
  const db = readDb();
  const { senderId, receiverId, type, sourceType, sourceId } = req.body as {
    senderId: string;
    receiverId: string;
    type: CsReactionType;
    sourceType?: CsReactionSourceType;
    sourceId?: string;
  };
  if (!senderId || !receiverId || !type) return res.status(400).json({ error: "senderId, receiverId, type required" });

  // Idempotency: no duplicate pending reactions of same type between same pair
  const dup = (db.csReactions ?? []).find(
    (r) => r.senderId === senderId && r.receiverId === receiverId && r.type === type && r.status === "pending"
  );
  if (dup) return res.json({ ok: true, reaction: dup, duplicate: true });

  const senderPreview = resolveUserPreview(db, senderId);
  const reaction: CsReaction = {
    id: randomUUID(),
    senderId,
    receiverId,
    type,
    sourceType: sourceType ?? "profile",
    sourceId,
    status: "pending",
    isBlurredForReceiver: true,
    createdAt: new Date().toISOString(),
    senderName: senderPreview.name,
    senderPhotoUrl: senderPreview.photoUrl,
    senderAge: senderPreview.age,
    senderNeighborhood: senderPreview.neighborhood,
  };
  if (!db.csReactions) db.csReactions = [];
  db.csReactions.push(reaction);
  writeDb(db);
  return res.status(201).json({ ok: true, reaction });
});

// ── POST /inbox/reactions/like-back/:reactionId ───────────────────────────
router.post("/inbox/reactions/like-back/:reactionId", async (req, res) => {
  const db = readDb();
  const { reactionId } = req.params;
  const reaction = (db.csReactions ?? []).find((r) => r.id === reactionId);
  if (!reaction) return res.status(404).json({ error: "Reaction not found" });
  if (reaction.status !== "pending") return res.status(409).json({ error: `Reaction already ${reaction.status}` });

  ensureCsConversation(db, [reaction.senderId, reaction.receiverId], {
    type: "match",
    sourceReactionId: reaction.id,
  });
  const server = await ensureServerFriendConversation(reaction.senderId, reaction.receiverId, reaction.receiverId, "bestie", reaction.id);
  reaction.status = "converted_to_match";
  reaction.convertedConversationId = server.chat.id;
  reaction.isBlurredForReceiver = false;
  writeDb(db);
  return res.json({ ok: true, reaction, match: server.match, chat: server.chat, conversation: server.conversation });
});

// ── POST /inbox/reactions/ignore/:reactionId ──────────────────────────────
router.post("/inbox/reactions/ignore/:reactionId", (req, res) => {
  const db = readDb();
  const { reactionId } = req.params;
  const reaction = (db.csReactions ?? []).find((r) => r.id === reactionId);
  if (!reaction) return res.status(404).json({ error: "Reaction not found" });
  reaction.status = "ignored";
  writeDb(db);
  return res.json({ ok: true, reaction });
});

// ── POST /inbox/requests/send ─────────────────────────────────────────────
router.post("/inbox/requests/send", (req, res) => {
  const db = readDb();
  const { senderId, receiverId, type, sourceType, sourceId, message, planTitle } = req.body as {
    senderId: string;
    receiverId: string;
    type: CsRequestType;
    sourceType?: CsRequestSourceType;
    sourceId?: string;
    message?: string;
    planTitle?: string;
  };
  if (!senderId || !receiverId || !type) return res.status(400).json({ error: "senderId, receiverId, type required" });

  // Idempotency: prevent duplicate pending requests of same type
  const dup = (db.csRequests ?? []).find(
    (r) => r.senderId === senderId && r.receiverId === receiverId && r.type === type && r.status === "pending"
  );
  if (dup) return res.json({ ok: true, request: dup, duplicate: true });

  const senderPreview = resolveUserPreview(db, senderId);
  const request: CsRequest = {
    id: randomUUID(),
    senderId,
    receiverId,
    type,
    sourceType: sourceType ?? "profile",
    sourceId,
    message,
    status: "pending",
    createdAt: new Date().toISOString(),
    senderName: senderPreview.name,
    senderPhotoUrl: senderPreview.photoUrl,
    senderAge: senderPreview.age,
    senderNeighborhood: senderPreview.neighborhood,
    planTitle,
  };
  if (!db.csRequests) db.csRequests = [];
  db.csRequests.push(request);
  writeDb(db);
  return res.status(201).json({ ok: true, request });
});

// ── POST /inbox/requests/accept/:requestId ────────────────────────────────
router.post("/inbox/requests/accept/:requestId", async (req, res) => {
  const db = readDb();
  const { requestId } = req.params;
  const request = (db.csRequests ?? []).find((r) => r.id === requestId);
  if (!request) return res.status(404).json({ error: "Request not found" });
  if (request.status !== "pending") return res.status(409).json({ error: `Request already ${request.status}` });

  const convType: CsConversationType = request.type === "plan_request" ? "plan" : "direct";
  ensureCsConversation(db, [request.senderId, request.receiverId], {
    type: convType,
    sourceRequestId: request.id,
  });
  const server = await ensureServerFriendConversation(request.senderId, request.receiverId, request.receiverId, request.type === "plan_request" ? "invite" : "friend_accept", request.id);
  request.status = "accepted";
  request.acceptedAt = new Date().toISOString();
  request.convertedConversationId = server.chat.id;
  writeDb(db);
  return res.json({ ok: true, request, match: server.match, chat: server.chat, conversation: server.conversation });
});

// ── POST /inbox/requests/decline/:requestId ───────────────────────────────
router.post("/inbox/requests/decline/:requestId", (req, res) => {
  const db = readDb();
  const { requestId } = req.params;
  const request = (db.csRequests ?? []).find((r) => r.id === requestId);
  if (!request) return res.status(404).json({ error: "Request not found" });
  request.status = "declined";
  writeDb(db);
  return res.json({ ok: true, request });
});

// ── GET /inbox/primary/:userId ────────────────────────────────────────────
router.get("/inbox/primary/:userId", (req, res) => {
  const db = readDb();
  const { userId } = req.params;
  const isPremium = isUserPremium(db, userId);

  // Cs conversations where user is participant and category = primary
  const myConvs = (db.csConversations ?? [])
    .filter((c) => c.participantIds.includes(userId) && c.category === "primary" && c.status === "active")
    .sort((a, b) => {
      const ta = a.lastMessageAt ?? a.createdAt;
      const tb = b.lastMessageAt ?? b.createdAt;
      return new Date(tb).getTime() - new Date(ta).getTime();
    })
    .map((conv) => {
      const peerId = conv.participantIds.find((id) => id !== userId) ?? conv.participantIds[0] ?? "";
      const peer = resolveUserPreview(db, peerId);
      // Find latest message in csMessages
      const msgs = db.messages.filter((m) => m.chatId === conv.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const lastMsg = msgs[0];
      return {
        ...conv,
        peerId,
        peerName: peer.name,
        peerPhotoUrl: peer.photoUrl,
        lastMessageText: lastMsg?.text ?? conv.lastMessageText ?? null,
        lastMessageAt: lastMsg?.createdAt ?? conv.lastMessageAt ?? conv.createdAt,
        lastMessageIsMe: lastMsg?.senderUserId === userId,
        hasMessages: msgs.length > 0,
      };
    });

  return res.json({ ok: true, conversations: myConvs, isPremium });
});

// ── GET /inbox/requests/:userId ───────────────────────────────────────────
router.get("/inbox/requests/:userId", (req, res) => {
  const db = readDb();
  const { userId } = req.params;

  const pending = (db.csRequests ?? [])
    .filter((r) => r.receiverId === userId && r.status === "pending")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Also pull legacy connectionRequests and planJoinRequests as normalized shape
  const legacyFriend = (db.connectionRequests ?? [])
    .filter((r) => r.toUserId === userId && r.status === "pending")
    .map((r): CsRequest => {
      const preview = resolveUserPreview(db, r.fromUserId);
      return {
        id: r.id,
        senderId: r.fromUserId,
        receiverId: r.toUserId,
        type: (r.kind === "plan_join" ? "plan_request" : "connect_request") as CsRequestType,
        sourceType: r.storyId ? "shot" : r.planId ? "plan" : "profile",
        sourceId: r.planId ?? r.storyId,
        message: r.message,
        status: "pending",
        createdAt: r.createdAt,
        senderName: preview.name,
        senderPhotoUrl: preview.photoUrl,
        senderAge: preview.age,
        senderNeighborhood: preview.neighborhood,
      };
    });

  const planJoin = (db.planJoinRequests ?? [])
    .filter((r) => {
      const plan = db.plans.find((p) => p.id === r.planId);
      return (plan?.creatorUserId ?? plan?.creatorId) === userId && r.status === "pending";
    })
    .map((r): CsRequest => {
      const preview = resolveUserPreview(db, r.fromUserId);
      const plan = db.plans.find((p) => p.id === r.planId);
      return {
        id: r.id,
        senderId: r.fromUserId,
        receiverId: userId,
        type: "plan_request",
        sourceType: "plan",
        sourceId: r.planId,
        status: "pending",
        createdAt: r.createdAt,
        senderName: preview.name,
        senderPhotoUrl: preview.photoUrl,
        senderAge: preview.age,
        senderNeighborhood: preview.neighborhood,
        planTitle: plan?.title,
      };
    });

  const all = [...pending, ...legacyFriend, ...planJoin].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return res.json({ ok: true, requests: all, count: all.length });
});

// ── GET /inbox/reactions/:userId ──────────────────────────────────────────
router.get("/inbox/reactions/:userId", (req, res) => {
  const db = readDb();
  const { userId } = req.params;
  const isPremium = isUserPremium(db, userId);

  const pending = (db.csReactions ?? [])
    .filter((r) => r.receiverId === userId && r.status === "pending")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((r) => ({
      ...r,
      // Free users only see first name + blur; premium sees full
      senderName: isPremium ? r.senderName : (r.senderName?.split(" ")[0] ?? "Someone"),
      senderPhotoUrl: isPremium ? r.senderPhotoUrl : undefined,
      isBlurredForReceiver: !isPremium,
    }));

  // Also bridge legacy friendReactions
  const legacy = (db.friendReactions ?? [])
    .filter((r) => r.toUserId === userId && r.status === "pending")
    .map((r) => {
      const preview = resolveUserPreview(db, r.fromUserId);
      return {
        id: r.id,
        senderId: r.fromUserId,
        receiverId: r.toUserId,
        type: r.type === "best_friend" ? "spark" : ("like" as CsReactionType),
        sourceType: "profile" as CsReactionSourceType,
        status: "pending" as CsReactionStatus,
        isBlurredForReceiver: !isPremium,
        createdAt: r.createdAt,
        senderName: isPremium ? preview.name : (preview.name.split(" ")[0] ?? "Someone"),
        senderPhotoUrl: isPremium ? preview.photoUrl : undefined,
        senderAge: preview.age,
        senderNeighborhood: preview.neighborhood,
      };
    });

  const all = [...pending, ...legacy]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const counts = {
    spark: all.filter((r) => r.type === "spark").length,
    like: all.filter((r) => r.type === "like").length,
    shot_reaction: all.filter((r) => r.type === "shot_reaction").length,
    plan_like: all.filter((r) => r.type === "plan_like").length,
    vibe_reaction: all.filter((r) => r.type === "vibe_reaction").length,
    total: all.length,
  };

  return res.json({ ok: true, reactions: all, counts, isPremium });
});

// POST /inbox/messages/send
router.post("/inbox/messages/send", (req, res) => {
  const db = readDb();
  const { conversationId, senderId, text } = req.body as { conversationId: string; senderId: string; text: string };
  if (!conversationId || !senderId || !text?.trim()) return res.status(400).json({ error: "conversationId, senderId, text required" });

  const conv = (db.csConversations ?? []).find((c) => c.id === conversationId);
  if (!conv) return res.status(404).json({ error: "Conversation not found" });
  if (!conv.participantIds.includes(senderId)) return res.status(403).json({ error: "Not a participant" });

  const msg: Message = {
    id: randomUUID(), chatId: conversationId,
    senderId, senderUserId: senderId, text: text.trim(),
    createdAt: new Date().toISOString(),
  };
  db.messages.push(msg);
  conv.hasMessages = true;
  conv.lastMessageAt = msg.createdAt;
  conv.lastMessageText = msg.text;
  conv.lastMessageSenderId = senderId;
  writeDb(db);
  return res.status(201).json({ ok: true, message: msg });
});

// GET /inbox/messages/:conversationId
router.get("/inbox/messages/:conversationId", (req, res) => {
  const db = readDb();
  const chatId = req.params.conversationId;
  const userId = req.query.userId as string | undefined;
  const conv = (db.csConversations ?? []).find((c) => c.id === chatId);
  if (!conv) return res.status(404).json({ error: "Conversation not found" });
  if (userId && !conv.participantIds.includes(userId)) return res.status(403).json({ error: "Not a participant" });
  const msgs = db.messages
    .filter((m) => m.chatId === chatId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return res.json({ ok: true, messages: msgs, conversation: conv });
});

// ── POST /inbox/reactions/withdraw ───────────────────────────────────────────
// Rewind: undo a sent reaction before the other person acts.
// Safe to fire-and-forget — silently succeeds if already matched.
router.post("/inbox/reactions/withdraw", (req, res) => {
  const db = readDb();
  const { senderId, receiverId, type } = req.body as {
    senderId: string;
    receiverId: string;
    type: "like" | "spark";
  };
  if (!senderId || !receiverId || !type) return res.status(400).json({ error: "senderId, receiverId, type required" });

  const reaction = (db.csReactions ?? []).find(
    (r) => r.senderId === senderId && r.receiverId === receiverId && r.type === type && r.status === "pending"
  );
  if (!reaction) {
    // Already matched or never existed — not an error, just report not withdrawn
    return res.json({ ok: true, withdrawn: false });
  }

  reaction.status = "expired";
  writeDb(db);
  return res.json({ ok: true, withdrawn: true });
});

export default router;
