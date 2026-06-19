import { initializeApp } from "firebase/app";
import { doc, getFirestore, writeBatch } from "firebase/firestore";

const currentUserId = process.argv[2] ?? "user_self";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.appId) {
  console.error("Missing Firebase config. Set EXPO_PUBLIC_FIREBASE_API_KEY, EXPO_PUBLIC_FIREBASE_PROJECT_ID, and EXPO_PUBLIC_FIREBASE_APP_ID.");
  process.exit(1);
}

const HOUR = 60 * 60 * 1000;

function isoHoursAgo(hoursAgo, now = new Date()) {
  return new Date(now.getTime() - hoursAgo * HOUR).toISOString();
}

function unreadMap(participantUserIds, unreadCount, createdAt) {
  return Object.fromEntries(
    participantUserIds.map((userId) => [
      userId,
      {
        hasUnread: userId === currentUserId && unreadCount > 0,
        count: userId === currentUserId ? unreadCount : 0,
        lastReadAt: userId === currentUserId && unreadCount > 0 ? null : createdAt,
      },
    ]),
  );
}

function buildConnection(seed) {
  const createdAt = isoHoursAgo(seed.hoursAgo);
  const participantUserIds = [currentUserId, seed.otherUserId].sort();

  return {
    id: seed.id,
    participantUserIds,
    type: seed.type,
    sourceId: seed.sourceId,
    createdAt,
    updatedAt: createdAt,
    lastMessage: {
      text: seed.message,
      senderUserId: seed.senderUserId,
      createdAt,
    },
    unreadByUserId: unreadMap(participantUserIds, seed.unreadCount, createdAt),
    participantPreviews: {
      [currentUserId]: {
        userId: currentUserId,
        displayName: "You",
        photoUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80",
      },
      [seed.otherUserId]: {
        userId: seed.otherUserId,
        displayName: seed.title,
        photoUrl: seed.photoUrl,
      },
    },
    previewTitle: seed.title,
    previewSubtitle: seed.subtitle,
    location: {
      city: "Miami",
      neighborhood: seed.neighborhood,
      venueName: seed.venueName,
    },
    archivedByUserId: {},
  };
}

const seeds = [
  {
    id: "mock_connection_dating_sofia",
    otherUserId: "mock_user_sofia_martinez",
    type: "dating",
    sourceId: "mock_dating_id_sofia_martinez",
    title: "Sofia Martinez",
    subtitle: "Dating match - Wynwood gallery nights",
    neighborhood: "Wynwood",
    venueName: "Superblue Miami",
    photoUrl: "https://images.unsplash.com/photo-1512316609839-ce289d3eba0a?auto=format&fit=crop&w=800&q=80",
    message: "I am down for Superblue, especially if we grab cafecito after.",
    senderUserId: "mock_user_sofia_martinez",
    hoursAgo: 0.4,
    unreadCount: 1,
  },
  {
    id: "mock_connection_dating_mateo",
    otherUserId: "mock_user_mateo_reyes",
    type: "dating",
    sourceId: "mock_dating_id_mateo_reyes",
    title: "Mateo Reyes",
    subtitle: "Dating match - sunset walks",
    neighborhood: "South Pointe",
    venueName: "South Pointe Park Pier",
    photoUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=800&q=80",
    message: "Sunset at South Pointe sounds easy. Want to do Thursday?",
    senderUserId: currentUserId,
    hoursAgo: 2.2,
    unreadCount: 0,
  },
  {
    id: "mock_connection_friend_ana",
    otherUserId: "mock_user_ana_cabrera",
    type: "friend",
    sourceId: "mock_friend_request_id_ana_cabrera",
    title: "Ana Cabrera",
    subtitle: "Friend request accepted - brunch crew",
    neighborhood: "Brickell",
    venueName: "B Bistro + Bakery",
    photoUrl: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=800&q=80",
    message: "New friend unlocked. Ana is planning a low-key Brickell brunch.",
    senderUserId: null,
    hoursAgo: 5,
    unreadCount: 1,
  },
  {
    id: "mock_connection_friend_julian",
    otherUserId: "mock_user_julian_brooks",
    type: "friend",
    sourceId: "mock_friend_request_id_julian_brooks",
    title: "Julian Brooks",
    subtitle: "Friend request accepted - pickleball + food halls",
    neighborhood: "Coconut Grove",
    venueName: "Peacock Park",
    photoUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80",
    message: "Let us make it casual: Peacock Park, then something quick nearby.",
    senderUserId: "mock_user_julian_brooks",
    hoursAgo: 12,
    unreadCount: 2,
  },
  {
    id: "mock_connection_plan_rooftop",
    otherUserId: "mock_user_rooftop_group",
    type: "plan",
    sourceId: "mock_plan_id_brickell_rooftop_social",
    title: "Brickell Rooftop Social",
    subtitle: "Joined plan - 4 people going",
    neighborhood: "Brickell",
    venueName: "Sugar",
    photoUrl: "https://images.unsplash.com/photo-1543007630-9710e4a00a20?auto=format&fit=crop&w=800&q=80",
    message: "You joined the rooftop plan. The group chat is ready.",
    senderUserId: null,
    hoursAgo: 24,
    unreadCount: 0,
  },
];

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const batch = writeBatch(db);
const connections = seeds.map(buildConnection);

for (const connection of connections) {
  batch.set(doc(db, "connections", connection.id), connection, { merge: true });
}

await batch.commit();
console.log(`Seeded ${connections.length} mock connections for ${currentUserId}.`);
