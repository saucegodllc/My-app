/**
 * ConnectSphere — Comprehensive Mock Data Suite
 *
 * Use this for:
 *   • Dev / Expo Go local testing
 *   • TestFlight build demo mode
 *   • App Store screenshot captures
 *   • Storybook / isolated component tests
 *
 * Toggle demo mode:  EXPO_PUBLIC_DEMO_MODE=true
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MockUser {
  id: string;
  displayName: string;
  firstName: string;
  age: number;
  occupation: string;
  neighborhood: string;
  bio: string;
  prompts: { question: string; answer: string }[];
  photoUrl: string;          // unsplash stable URL (no auth required)
  photos: string[];
  verified: boolean;
  isPremium: boolean;
  distanceMi: number;
  compatScore: number;       // 0–100
  interests: string[];
  lastActive: string;        // ISO
}

export interface MockMatch {
  id: string;
  userId: string;
  matchedAt: string;
  lastMessage?: MockMessage;
  unread: number;
  isMomentRequest?: boolean;
}

export interface MockMessage {
  id: string;
  matchId: string;
  senderId: string;
  text: string;
  sentAt: string;
  read: boolean;
  mediaUrl?: string;
}

export interface MockEvent {
  id: string;
  title: string;
  hostName: string;
  hostPhotoUrl: string;
  location: string;
  neighborhood: string;
  dateTime: string;
  coverUrl: string;
  category: "nightlife" | "fitness" | "art" | "food" | "music" | "social" | "outdoor";
  attendeeCount: number;
  maxCapacity: number | null;
  priceLabel: string;
  description: string;
  tags: string[];
  isRSVPd: boolean;
}

export interface MockCommunity {
  id: string;
  name: string;
  description: string;
  neighborhood: string;
  memberCount: number;
  coverUrl: string;
  iconEmoji: string;
  category: "fitness" | "art" | "food" | "music" | "social" | "professional" | "outdoor";
  isJoined: boolean;
  recentActivity: string;
  pinned?: boolean;
}

export interface MockMoment {
  id: string;
  userId: string;
  userDisplayName: string;
  userPhotoUrl: string;
  text: string;
  location: string;
  neighborhood: string;
  mediaUrl?: string;
  mediaType?: "photo" | "video";
  createdAt: string;         // ISO
  expiresAt: string;         // ISO — 24h after createdAt
  totalViews: number;
  echoCount: number;
  isEchoed: boolean;
  isOwn: boolean;
  viewerCount: number;
}

export interface MockMomentRequest {
  id: string;
  momentId: string;
  fromUserId: string;
  fromDisplayName: string;
  fromPhotoUrl: string;
  momentPreviewText: string;
  sentAt: string;
  status: "pending" | "accepted" | "declined";
}

// ─── Photo helpers (stable Unsplash URLs, no key required) ───────────────────

const P = (seed: string) =>
  `https://api.dicebear.com/7.x/adventurer/svg?seed=${seed}&backgroundColor=ffadad,ffd6a5,fdffb6,caffbf,9bf6ff,a0c4ff,bdb2ff,ffc6ff`;

// For realistic headshots we use unavatar.io (Twitter CDN proxy — no auth)
// or picsum (random but stable per seed)
const FACE = (n: number) => `https://picsum.photos/seed/cs${n}/400/500`;
const COVER = (n: number) => `https://picsum.photos/seed/ev${n}/800/400`;

// ─── 22 Miami Mock Users ──────────────────────────────────────────────────────

export const MOCK_USERS: MockUser[] = [
  {
    id: "u_kayla",
    displayName: "Kayla R.",
    firstName: "Kayla",
    age: 26,
    occupation: "Yoga instructor & wellness coach",
    neighborhood: "Key Biscayne",
    bio: "Living my best life between sunrise beach runs and reformer classes. Love discovering hidden Miami gems and turning strangers into friends.",
    prompts: [
      { question: "My simple pleasures", answer: "Cold brew, ocean breeze, no agenda Sunday" },
      { question: "I know the best spot in Miami for...", answer: "Sunrise yoga where you can see dolphins 🐬" },
    ],
    photoUrl: FACE(1),
    photos: [FACE(1), FACE(11), FACE(21)],
    verified: true,
    isPremium: false,
    distanceMi: 1.2,
    compatScore: 94,
    interests: ["yoga", "wellness", "beach", "coffee", "hiking"],
    lastActive: new Date(Date.now() - 22 * 60_000).toISOString(),
  },
  {
    id: "u_maya",
    displayName: "Maya T.",
    firstName: "Maya",
    age: 28,
    occupation: "UX designer @ fintech startup",
    neighborhood: "Wynwood",
    bio: "Obsessed with good design, spicy food, and rooftop conversations that go too late. Wynwood is my backyard and I have opinions about every mural.",
    prompts: [
      { question: "The way to win me over is", answer: "Know the difference between Shepard Fairey and Banksy 🎨" },
      { question: "My Friday night looks like", answer: "Gallery opening → hole-in-the-wall ramen → some rooftop I heard about on Instagram" },
    ],
    photoUrl: FACE(2),
    photos: [FACE(2), FACE(12), FACE(22)],
    verified: true,
    isPremium: true,
    distanceMi: 0.4,
    compatScore: 91,
    interests: ["design", "art", "food", "rooftop", "coffee", "streetart"],
    lastActive: new Date(Date.now() - 8 * 60_000).toISOString(),
  },
  {
    id: "u_jess",
    displayName: "Jess M.",
    firstName: "Jess",
    age: 24,
    occupation: "Spin instructor + personal trainer",
    neighborhood: "Brickell",
    bio: "5am club member (by choice, send help). If you can keep up on a bike or a trail I'm already impressed. Ask me about my current obsession: cold plunge.",
    prompts: [
      { question: "I geek out on", answer: "Zone 2 training, sleep optimization, and why everyone should own a foam roller" },
      { question: "Best travel story", answer: "Rented a scooter in Bali, got lost, found the best temple. Would do it again." },
    ],
    photoUrl: FACE(3),
    photos: [FACE(3), FACE(13), FACE(23)],
    verified: false,
    isPremium: false,
    distanceMi: 2.1,
    compatScore: 87,
    interests: ["fitness", "cycling", "nutrition", "travel", "wellness"],
    lastActive: new Date(Date.now() - 3.5 * 3_600_000).toISOString(),
  },
  {
    id: "u_alicia",
    displayName: "Alicia V.",
    firstName: "Alicia",
    age: 30,
    occupation: "Immigration attorney",
    neighborhood: "Coral Gables",
    bio: "Born and raised in Miami. Bilingual (English/Spanish, obviously). Weekend farmer's market devotee. I take my café con leche very seriously.",
    prompts: [
      { question: "A non-negotiable for me is", answer: "Sunday morning at the Coconut Grove farmers market, no exceptions" },
      { question: "I know the best spot in Miami for...", answer: "Authentic Cuban food that isn't on any 'best of' list" },
    ],
    photoUrl: FACE(4),
    photos: [FACE(4), FACE(14), FACE(24)],
    verified: true,
    isPremium: false,
    distanceMi: 4.7,
    compatScore: 83,
    interests: ["food", "law", "travel", "culture", "coffee"],
    lastActive: new Date(Date.now() - 5 * 3_600_000).toISOString(),
  },
  {
    id: "u_sofia",
    displayName: "Sofia L.",
    firstName: "Sofia",
    age: 27,
    occupation: "Fashion photographer",
    neighborhood: "Design District",
    bio: "I see the world in golden hour. Freelance photographer splitting time between Miami and NYC. If you want to walk the Design District for 3 hours looking at nothing, we'll get along.",
    prompts: [
      { question: "My love language is", answer: "Showing up to your thing, even if I don't know anyone there" },
      { question: "What I order at the bar", answer: "Whatever the bartender is proud of. Always." },
    ],
    photoUrl: FACE(5),
    photos: [FACE(5), FACE(15), FACE(25)],
    verified: true,
    isPremium: true,
    distanceMi: 0.9,
    compatScore: 96,
    interests: ["photography", "fashion", "art", "music", "travel"],
    lastActive: new Date(Date.now() - 45 * 60_000).toISOString(),
  },
  {
    id: "u_daniela",
    displayName: "Daniela C.",
    firstName: "Daniela",
    age: 25,
    occupation: "Marine biologist (UM grad)",
    neighborhood: "Coconut Grove",
    bio: "I study coral reefs by day and kayak Biscayne Bay for fun. Probably the only person at the bar who can identify 40 fish species. That's my personality trait now.",
    prompts: [
      { question: "I'm looking for", answer: "Someone who's genuinely curious about the world. Not sure it matters which world." },
      { question: "Most spontaneous thing I've done", answer: "Signed up for a free diving course after seeing a reel. Got certified. Changed my life." },
    ],
    photoUrl: FACE(6),
    photos: [FACE(6), FACE(16), FACE(26)],
    verified: false,
    isPremium: false,
    distanceMi: 3.3,
    compatScore: 88,
    interests: ["ocean", "science", "kayaking", "diving", "nature"],
    lastActive: new Date(Date.now() - 2 * 3_600_000).toISOString(),
  },
  {
    id: "u_rachel",
    displayName: "Rachel P.",
    firstName: "Rachel",
    age: 29,
    occupation: "Executive chef (Brickell restaurant group)",
    neighborhood: "Little Havana",
    bio: "I cook for 200 people a night and then go home and cook for myself too. Food is language. I'm fluent in Cuban, Haitian, and 'random fusion that somehow works.'",
    prompts: [
      { question: "The key to my heart", answer: "Eat something I made and tell me exactly what you taste" },
      { question: "I'm weirdly good at", answer: "Turning a farmers market haul into a 3-course dinner in 45 minutes" },
    ],
    photoUrl: FACE(7),
    photos: [FACE(7), FACE(17), FACE(27)],
    verified: true,
    isPremium: false,
    distanceMi: 2.8,
    compatScore: 79,
    interests: ["cooking", "food", "culture", "music", "travel"],
    lastActive: new Date(Date.now() - 1 * 3_600_000).toISOString(),
  },
  // Male users
  {
    id: "u_marcus",
    displayName: "Marcus W.",
    firstName: "Marcus",
    age: 31,
    occupation: "VC associate (early-stage tech)",
    neighborhood: "Brickell",
    bio: "Miami transplant from Atlanta, 4 years in. Still haven't found a good BBQ spot but I'm not mad about it. Startups by day, salsa classes I'm terrible at by night.",
    prompts: [
      { question: "My hot take", answer: "Miami has better work-life balance than NYC and San Francisco will never admit it" },
      { question: "I'm learning", answer: "Salsa dancing. Badly. Bravely." },
    ],
    photoUrl: FACE(8),
    photos: [FACE(8), FACE(18), FACE(28)],
    verified: true,
    isPremium: true,
    distanceMi: 1.8,
    compatScore: 85,
    interests: ["startups", "investing", "salsa", "food", "travel"],
    lastActive: new Date(Date.now() - 30 * 60_000).toISOString(),
  },
  {
    id: "u_andre",
    displayName: "Andre M.",
    firstName: "Andre",
    age: 27,
    occupation: "Music producer & DJ",
    neighborhood: "Overtown",
    bio: "Born in Overtown, making music that sounds like Miami feels. I play everywhere from warehouses to hotel rooftops. Appreciate anyone who can name 3 local artists.",
    prompts: [
      { question: "On weekends I'm", answer: "In the studio until 4am or watching the sun rise over the bay. Both count as rest." },
      { question: "My perfect Sunday", answer: "Record store browsing → cook something slow → evening walk through the neighborhood" },
    ],
    photoUrl: FACE(9),
    photos: [FACE(9), FACE(19), FACE(29)],
    verified: false,
    isPremium: false,
    distanceMi: 1.4,
    compatScore: 90,
    interests: ["music", "djing", "production", "culture", "art"],
    lastActive: new Date(Date.now() - 15 * 60_000).toISOString(),
  },
  {
    id: "u_carlos",
    displayName: "Carlos E.",
    firstName: "Carlos",
    age: 33,
    occupation: "Architect (urban design firm)",
    neighborhood: "Edgewater",
    bio: "I think a lot about how cities shape people and vice versa. Miami is the best urban experiment in America right now and I'm here for it. Also I kite surf.",
    prompts: [
      { question: "Controversial opinion", answer: "Miami's architecture is underrated. Fight me (nicely, over coffee)." },
      { question: "I know the best spot in Miami for...", answer: "Watching a thunderstorm from the water. There's a specific spot." },
    ],
    photoUrl: FACE(10),
    photos: [FACE(10), FACE(20), FACE(30)],
    verified: true,
    isPremium: false,
    distanceMi: 0.7,
    compatScore: 93,
    interests: ["architecture", "design", "kitesurfing", "urbanism", "coffee"],
    lastActive: new Date(Date.now() - 2.5 * 3_600_000).toISOString(),
  },
];

// ─── Mock Matches ─────────────────────────────────────────────────────────────

const now = new Date();
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
const minsAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const hrsAgo  = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

export const MOCK_MATCHES: MockMatch[] = [
  {
    id: "match_sofia",
    userId: "u_sofia",
    matchedAt: minsAgo(42),
    unread: 2,
    lastMessage: {
      id: "msg_s1",
      matchId: "match_sofia",
      senderId: "u_sofia",
      text: "ok wait you actually went to the Rubell? what did you think of the new Hirst room??",
      sentAt: minsAgo(5),
      read: false,
    },
  },
  {
    id: "match_maya",
    userId: "u_maya",
    matchedAt: hrsAgo(3),
    unread: 1,
    lastMessage: {
      id: "msg_m1",
      matchId: "match_maya",
      senderId: "u_maya",
      text: "that ramen spot I posted in my Moment — you should try it before it blows up",
      sentAt: hrsAgo(1),
      read: false,
    },
  },
  {
    id: "match_kayla",
    userId: "u_kayla",
    matchedAt: daysAgo(1),
    unread: 0,
    lastMessage: {
      id: "msg_k1",
      matchId: "match_kayla",
      senderId: "u_kayla",
      text: "Sunday 7am Crandon? I'll bring the cold brew ☕",
      sentAt: daysAgo(1),
      read: true,
    },
  },
  {
    id: "match_marcus",
    userId: "u_marcus",
    matchedAt: daysAgo(2),
    unread: 0,
    lastMessage: {
      id: "msg_ma1",
      matchId: "match_marcus",
      senderId: "u_marcus",
      text: "hahaha ok that BBQ take was fair. Ill show you the best I've found though",
      sentAt: daysAgo(2),
      read: true,
    },
  },
  {
    id: "match_daniela",
    userId: "u_daniela",
    matchedAt: daysAgo(4),
    unread: 0,
    lastMessage: {
      id: "msg_d1",
      matchId: "match_daniela",
      senderId: "u_daniela",
      text: "I'm going to make you care about coral reefs before this is over",
      sentAt: daysAgo(3),
      read: true,
    },
  },
];

// ─── Mock Conversations ───────────────────────────────────────────────────────

export const MOCK_CONVERSATIONS: Record<string, MockMessage[]> = {
  match_sofia: [
    { id: "msg_s0a", matchId: "match_sofia", senderId: "me", text: "I saw your Moment from the Design District — that mural on NW 2nd is insane", sentAt: minsAgo(38), read: true },
    { id: "msg_s0b", matchId: "match_sofia", senderId: "u_sofia", text: "RIGHT? I've shot it like 6 times and it still surprises me. are you into the art scene here?", sentAt: minsAgo(32), read: true },
    { id: "msg_s0c", matchId: "match_sofia", senderId: "me", text: "yeah — went to Rubell last week for the first time. completely underrated museum honestly", sentAt: minsAgo(20), read: true },
    { id: "msg_s1", matchId: "match_sofia", senderId: "u_sofia", text: "ok wait you actually went to the Rubell? what did you think of the new Hirst room??", sentAt: minsAgo(5), read: false },
    { id: "msg_s2", matchId: "match_sofia", senderId: "u_sofia", text: "most people I know haven't even heard of it 😭", sentAt: minsAgo(4), read: false },
  ],
  match_maya: [
    { id: "msg_m0a", matchId: "match_maya", senderId: "u_maya", text: "ok I have a design question — what's the worst UI you use every day", sentAt: hrsAgo(5), read: true },
    { id: "msg_m0b", matchId: "match_maya", senderId: "me", text: "honestly? every airline app. no exceptions", sentAt: hrsAgo(4), read: true },
    { id: "msg_m0c", matchId: "match_maya", senderId: "u_maya", text: "CORRECT. this is the most correct answer", sentAt: hrsAgo(3.5), read: true },
    { id: "msg_m1", matchId: "match_maya", senderId: "u_maya", text: "that ramen spot I posted in my Moment — you should try it before it blows up", sentAt: hrsAgo(1), read: false },
  ],
};

// ─── Mock Events ──────────────────────────────────────────────────────────────

const tomorrow = new Date(Date.now() + 86_400_000);
const nextSat = new Date(Date.now() + 5 * 86_400_000);
const nextSun = new Date(Date.now() + 6 * 86_400_000);

function eventDate(d: Date, hour: number, min = 0): string {
  const dt = new Date(d);
  dt.setHours(hour, min, 0, 0);
  return dt.toISOString();
}

export const MOCK_EVENTS: MockEvent[] = [
  {
    id: "ev_yoga_sunrise",
    title: "Sunrise Yoga + Cold Plunge",
    hostName: "Kayla R.",
    hostPhotoUrl: FACE(1),
    location: "Crandon Park Beach, Key Biscayne",
    neighborhood: "Key Biscayne",
    dateTime: eventDate(tomorrow, 6, 30),
    coverUrl: COVER(1),
    category: "fitness",
    attendeeCount: 18,
    maxCapacity: 25,
    priceLabel: "Free",
    description: "Start your week with a 45-min vinyasa on the beach followed by a cold plunge in the Atlantic. Mats provided. Just bring yourself and a towel.",
    tags: ["yoga", "wellness", "beach", "morning"],
    isRSVPd: true,
  },
  {
    id: "ev_wynwood_gallery",
    title: "Wynwood Gallery Walk — Opening Night",
    hostName: "Maya T.",
    hostPhotoUrl: FACE(2),
    location: "Starting at Wynwood Walls, NW 2nd Ave",
    neighborhood: "Wynwood",
    dateTime: eventDate(nextSat, 19, 0),
    coverUrl: COVER(2),
    category: "art",
    attendeeCount: 47,
    maxCapacity: null,
    priceLabel: "Free",
    description: "Three galleries, one night, zero pretension. We'll hit the openings at Gallery Jones, Primary Projects, and end at the new spot on 29th. Street tacos after.",
    tags: ["art", "gallery", "free", "social", "wynwood"],
    isRSVPd: false,
  },
  {
    id: "ev_rooftop_social",
    title: "Brickell Rooftop Social — ConnectSphere x Edition Hotel",
    hostName: "ConnectSphere",
    hostPhotoUrl: "https://picsum.photos/seed/logo/200/200",
    location: "The Miami EDITION, Brickell",
    neighborhood: "Brickell",
    dateTime: eventDate(nextSat, 20, 0),
    coverUrl: COVER(3),
    category: "social",
    attendeeCount: 83,
    maxCapacity: 120,
    priceLabel: "$20 (includes 2 drinks)",
    description: "ConnectSphere's first IRL social. Meet your matches, discover new connections. DJ set starts at 9. Dress code: Miami casual (you know what that means).",
    tags: ["social", "networking", "rooftop", "nightlife", "official"],
    isRSVPd: true,
  },
  {
    id: "ev_salsa_class",
    title: "Salsa for Beginners — Calle Ocho",
    hostName: "Andre M.",
    hostPhotoUrl: FACE(9),
    location: "Cubaocho Museum & Performing Arts",
    neighborhood: "Little Havana",
    dateTime: eventDate(nextSun, 15, 0),
    coverUrl: COVER(4),
    category: "social",
    attendeeCount: 22,
    maxCapacity: 30,
    priceLabel: "$15",
    description: "No experience needed. Local instructors, live music, and enough café con leche to keep you going. One of the best ways to actually feel Miami.",
    tags: ["salsa", "dance", "music", "culture", "beginner"],
    isRSVPd: false,
  },
  {
    id: "ev_bay_kayak",
    title: "Biscayne Bay Kayak at Golden Hour",
    hostName: "Daniela C.",
    hostPhotoUrl: FACE(6),
    location: "Launch from Coconut Grove Marina",
    neighborhood: "Coconut Grove",
    dateTime: eventDate(nextSun, 17, 30),
    coverUrl: COVER(5),
    category: "outdoor",
    attendeeCount: 9,
    maxCapacity: 12,
    priceLabel: "$35 (includes kayak rental)",
    description: "I'll guide you through the mangroves and we'll end up in the bay for sunset. Good chance of seeing manatees and definitely dolphins. No experience needed.",
    tags: ["kayaking", "nature", "outdoor", "sunset", "ocean"],
    isRSVPd: false,
  },
  {
    id: "ev_chef_dinner",
    title: "Private Chef's Table — 8 Seats Only",
    hostName: "Rachel P.",
    hostPhotoUrl: FACE(7),
    location: "Little Havana (address on RSVP)",
    neighborhood: "Little Havana",
    dateTime: eventDate(nextSat, 19, 30),
    coverUrl: COVER(6),
    category: "food",
    attendeeCount: 5,
    maxCapacity: 8,
    priceLabel: "$85 (5-course, BYOB)",
    description: "I'm cooking a 5-course Cuban-Caribbean fusion menu for 8 people. This is the menu I can't put on my restaurant's menu. Come hungry.",
    tags: ["food", "chef", "dinner", "intimate", "cuban"],
    isRSVPd: false,
  },
  {
    id: "ev_design_tour",
    title: "Design District Architecture Walk",
    hostName: "Carlos E.",
    hostPhotoUrl: FACE(10),
    location: "Meets at Palm Court, Design District",
    neighborhood: "Design District",
    dateTime: eventDate(nextSun, 10, 0),
    coverUrl: COVER(7),
    category: "art",
    attendeeCount: 14,
    maxCapacity: 20,
    priceLabel: "Free",
    description: "An architect's tour of the Design District — what's worth seeing, what's terrible and why, and what the buildings say about Miami's ambitions. 90 minutes, coffee stops included.",
    tags: ["architecture", "design", "free", "walking", "art"],
    isRSVPd: false,
  },
  {
    id: "ev_pool_day",
    title: "ConnectSphere Pool Day — Faena Hotel",
    hostName: "ConnectSphere",
    hostPhotoUrl: "https://picsum.photos/seed/logo/200/200",
    location: "Faena Hotel Miami Beach",
    neighborhood: "South Beach",
    dateTime: eventDate(nextSun, 12, 0),
    coverUrl: COVER(8),
    category: "social",
    attendeeCount: 61,
    maxCapacity: 80,
    priceLabel: "$45 (pool access + welcome drink)",
    description: "ConnectSphere takes over the Faena pool for a Sunday social. Arrive when you want, leave when you want. Music curated by Andre M. Meet people IRL who matched your vibe online.",
    tags: ["pool", "social", "hotel", "official", "beach"],
    isRSVPd: false,
  },
];

// ─── Mock Communities (Spaces) ────────────────────────────────────────────────

export const MOCK_COMMUNITIES: MockCommunity[] = [
  {
    id: "space_wynwood_creatives",
    name: "Wynwood Creatives",
    description: "Artists, designers, photographers, and anyone who thinks of Wynwood as a second living room. Upcoming show tips, studio shares, gallery talk.",
    neighborhood: "Wynwood",
    memberCount: 847,
    coverUrl: COVER(9),
    iconEmoji: "🎨",
    category: "art",
    isJoined: true,
    recentActivity: "Maya posted: 'New mural on NW 29th just dropped — it's incredible'",
    pinned: true,
  },
  {
    id: "space_miami_fitness",
    name: "Miami Fitness Crew",
    description: "Early risers, beach runners, gym rats, and anyone who thinks a 6am workout is a reasonable life choice. PRs, race registrations, class recommendations.",
    neighborhood: "Citywide",
    memberCount: 1240,
    coverUrl: COVER(10),
    iconEmoji: "💪",
    category: "fitness",
    isJoined: true,
    recentActivity: "Kayla posted her Moment: 'Sunday sunrise crew grew by 4 today 🙌'",
    pinned: true,
  },
  {
    id: "space_brickell_professionals",
    name: "Brickell After Hours",
    description: "Young professionals in Brickell who don't want every happy hour to be a networking event. Good drinks, no elevator pitches.",
    neighborhood: "Brickell",
    memberCount: 593,
    coverUrl: COVER(11),
    iconEmoji: "🥂",
    category: "social",
    isJoined: false,
    recentActivity: "Marcus: 'Anyone else notice the new rooftop bar on SE 2nd? Tried it last night'",
  },
  {
    id: "space_miami_foodies",
    name: "Miami Foodies",
    description: "Discovering Miami's food scene one restaurant at a time. New spots, hidden gems, farmers market finds, and opinions about who makes the best croqueta.",
    neighborhood: "Citywide",
    memberCount: 2104,
    coverUrl: COVER(12),
    iconEmoji: "🍜",
    category: "food",
    isJoined: false,
    recentActivity: "Rachel: 'That ramen spot on NW 2nd is not a drill — line at 11:30pm on a Wednesday'",
  },
  {
    id: "space_ocean_lovers",
    name: "Biscayne Bay Collective",
    description: "Kayakers, paddleboarders, free divers, and anyone who thinks the ocean is the best thing about living in Miami. Conservation, trips, and impromptu sessions.",
    neighborhood: "Key Biscayne / Coconut Grove",
    memberCount: 378,
    coverUrl: COVER(13),
    iconEmoji: "🌊",
    category: "outdoor",
    isJoined: true,
    recentActivity: "Daniela: 'Manatee sighting in the bay this morning — 3 of them 🐾'",
  },
  {
    id: "space_miami_music",
    name: "Miami Underground Music",
    description: "Local artists, producers, and heads who know there's a scene beyond Ultra. Warehouse shows, studio sessions, and actual Miami sound.",
    neighborhood: "Overtown / Wynwood",
    memberCount: 621,
    coverUrl: COVER(14),
    iconEmoji: "🎵",
    category: "music",
    isJoined: false,
    recentActivity: "Andre: 'Playing Gramps on Friday — come through if you want to hear something different'",
  },
  {
    id: "space_coconut_grove",
    name: "Grove Life",
    description: "The Grove has its own energy and it's hard to explain to people who haven't lived here. Farmers market Saturday, sailing Sunday, everything in between.",
    neighborhood: "Coconut Grove",
    memberCount: 445,
    coverUrl: COVER(15),
    iconEmoji: "🌿",
    category: "social",
    isJoined: false,
    recentActivity: "Alicia: 'Anyone else going to the farmer's market tomorrow? Meet at the coffee stand?'",
  },
];

// ─── Mock Moments ─────────────────────────────────────────────────────────────

function momentTime(minsAgo: number) {
  return {
    createdAt: new Date(Date.now() - minsAgo * 60_000).toISOString(),
    expiresAt: new Date(Date.now() - minsAgo * 60_000 + 24 * 3_600_000).toISOString(),
  };
}

export const MOCK_MOMENTS: MockMoment[] = [
  {
    id: "mom_kayla_1",
    userId: "u_kayla",
    userDisplayName: "Kayla R.",
    userPhotoUrl: FACE(1),
    text: "Sunday reset hits different at Crandon 🧘‍♀️ who else is up at 6am",
    location: "Crandon Park · Key Biscayne",
    neighborhood: "Key Biscayne",
    ...momentTime(22),
    totalViews: 47,
    echoCount: 11,
    isEchoed: false,
    isOwn: false,
    viewerCount: 14,
  },
  {
    id: "mom_maya_1",
    userId: "u_maya",
    userDisplayName: "Maya T.",
    userPhotoUrl: FACE(2),
    text: "new ramen spot just opened on NW 2nd and it's genuinely not a drill 👀 already went twice this week",
    location: "Wynwood · Miami",
    neighborhood: "Wynwood",
    ...momentTime(38),
    totalViews: 33,
    echoCount: 6,
    isEchoed: true,
    isOwn: false,
    viewerCount: 6,
  },
  {
    id: "mom_jess_1",
    userId: "u_jess",
    userDisplayName: "Jess M.",
    userPhotoUrl: FACE(3),
    text: "5am club. chaotic but we love it 😭 if you know you know",
    location: "Equinox · Brickell",
    neighborhood: "Brickell",
    ...momentTime(3 * 60 + 30),
    totalViews: 22,
    echoCount: 3,
    isEchoed: false,
    isOwn: false,
    viewerCount: 2,
  },
  {
    id: "mom_sofia_1",
    userId: "u_sofia",
    userDisplayName: "Sofia L.",
    userPhotoUrl: FACE(5),
    text: "golden hour in the Design District goes absolutely different 📸",
    location: "Design District · Miami",
    neighborhood: "Design District",
    ...momentTime(1 * 60 + 15),
    totalViews: 61,
    echoCount: 18,
    isEchoed: false,
    isOwn: false,
    viewerCount: 22,
  },
  {
    id: "mom_andre_1",
    userId: "u_andre",
    userDisplayName: "Andre M.",
    userPhotoUrl: FACE(9),
    text: "just finished a track that actually sounds like Miami at 2am. will play it Friday 🎵",
    location: "Overtown · Miami",
    neighborhood: "Overtown",
    ...momentTime(5 * 60),
    totalViews: 18,
    echoCount: 4,
    isEchoed: false,
    isOwn: false,
    viewerCount: 5,
  },
  {
    id: "mom_daniela_1",
    userId: "u_daniela",
    userDisplayName: "Daniela C.",
    userPhotoUrl: FACE(6),
    text: "3 manatees in the bay this morning at sunrise. living my best life 🌊",
    location: "Biscayne Bay · Coconut Grove",
    neighborhood: "Coconut Grove",
    ...momentTime(4 * 60 + 20),
    totalViews: 29,
    echoCount: 9,
    isEchoed: true,
    isOwn: false,
    viewerCount: 8,
  },
  // User's own story (shows at front of rail)
  {
    id: "mom_me_1",
    userId: "me",
    userDisplayName: "You",
    userPhotoUrl: FACE(31),
    text: "first time at the Rubell. this place is underrated and I stand by it",
    location: "Rubell Museum · Allapattah",
    neighborhood: "Allapattah",
    ...momentTime(2 * 60),
    totalViews: 8,
    echoCount: 2,
    isEchoed: false,
    isOwn: true,
    viewerCount: 8,
  },
];

// ─── Mock Moment Requests ─────────────────────────────────────────────────────

export const MOCK_MOMENT_REQUESTS: MockMomentRequest[] = [
  {
    id: "mreq_1",
    momentId: "mom_sofia_1",
    fromUserId: "u_sofia",
    fromDisplayName: "Sofia L.",
    fromPhotoUrl: FACE(5),
    momentPreviewText: "golden hour in the Design District goes absolutely different 📸",
    sentAt: minsAgo(8),
    status: "pending",
  },
  {
    id: "mreq_2",
    momentId: "mom_andre_1",
    fromUserId: "u_andre",
    fromDisplayName: "Andre M.",
    fromPhotoUrl: FACE(9),
    momentPreviewText: "just finished a track that actually sounds like Miami at 2am...",
    sentAt: minsAgo(35),
    status: "pending",
  },
];

// ─── Hot Zone data ────────────────────────────────────────────────────────────

export interface HotZone {
  neighborhood: string;
  momentCount: number;
  activeUsers: number;
  topTag: string;
}

export const MOCK_HOT_ZONES: HotZone[] = [
  { neighborhood: "Wynwood", momentCount: 31, activeUsers: 24, topTag: "art" },
  { neighborhood: "Brickell", momentCount: 18, activeUsers: 15, topTag: "nightlife" },
  { neighborhood: "South Beach", momentCount: 14, activeUsers: 11, topTag: "beach" },
  { neighborhood: "Design District", momentCount: 9, activeUsers: 7, topTag: "fashion" },
];

export const CURRENT_HOT_ZONE = MOCK_HOT_ZONES[0];

// ─── Demo mode guard ──────────────────────────────────────────────────────────

export const IS_DEMO_MODE =
  process.env.EXPO_PUBLIC_DEMO_MODE === "true" ||
  process.env.NODE_ENV === "test";

/**
 * Seed the in-memory API store with mock data for local dev.
 * Call this from app/_layout.tsx or the API server seed route.
 */
export function getMockFeedData() {
  return {
    users: MOCK_USERS,
    matches: MOCK_MATCHES,
    events: MOCK_EVENTS,
    communities: MOCK_COMMUNITIES,
    moments: MOCK_MOMENTS,
    momentRequests: MOCK_MOMENT_REQUESTS,
    hotZones: MOCK_HOT_ZONES,
  };
}
