import type {
  ConnectionBuckets,
  ConnectionDocument,
  ConnectionParticipantPreview,
  ConnectionType,
  CreateConnectionInput,
} from "./types";

const HOUR = 60 * 60 * 1000;

function isoHoursAgo(hoursAgo: number, now = new Date()) {
  return new Date(now.getTime() - hoursAgo * HOUR).toISOString();
}

function makeUnreadMap(participantUserIds: string[], currentUserId: string, unreadCount: number, now: string) {
  return participantUserIds.reduce<ConnectionDocument["unreadByUserId"]>((acc, userId) => {
    acc[userId] = {
      hasUnread: userId === currentUserId && unreadCount > 0,
      count: userId === currentUserId ? unreadCount : 0,
      lastReadAt: userId === currentUserId && unreadCount > 0 ? null : now,
    };
    return acc;
  }, {});
}

export function createConnectionDocument(input: CreateConnectionInput): ConnectionDocument {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const participantUserIds = [...new Set(input.participantUserIds)].sort();

  return {
    id: input.id ?? `${input.type}_${input.sourceId}`,
    participantUserIds,
    type: input.type,
    sourceId: input.sourceId,
    createdAt,
    updatedAt: createdAt,
    lastMessage: {
      text: input.lastMessageText,
      senderUserId: input.lastMessageSenderUserId ?? null,
      createdAt,
    },
    unreadByUserId: makeUnreadMap(participantUserIds, participantUserIds[0] ?? "", 0, createdAt),
    participantPreviews: input.participantPreviews,
    previewTitle: input.previewTitle,
    previewSubtitle: input.previewSubtitle,
    location: input.location,
    archivedByUserId: {},
  };
}

function selfPreview(currentUserId: string): ConnectionParticipantPreview {
  return {
    userId: currentUserId,
    displayName: "You",
    photoUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=80",
  };
}

export function buildMockConnectionsForSoloTesting(currentUserId: string, now = new Date()): ConnectionDocument[] {
  const self = selfPreview(currentUserId);

  const seeds: Array<{
    id: string;
    otherUserId: string;
    type: ConnectionType;
    sourceId: string;
    title: string;
    subtitle: string;
    neighborhood: string;
    venueName?: string;
    photoUrl: string;
    message: string;
    senderUserId: string | null;
    hoursAgo: number;
    unreadCount: number;
  }> = [
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

  return seeds.map((seed) => {
    const createdAt = isoHoursAgo(seed.hoursAgo, now);
    const participantUserIds = [currentUserId, seed.otherUserId];
    const participantPreviews = {
      [currentUserId]: self,
      [seed.otherUserId]: {
        userId: seed.otherUserId,
        displayName: seed.title,
        photoUrl: seed.photoUrl,
      },
    };

    return {
      ...createConnectionDocument({
        id: seed.id,
        participantUserIds,
        type: seed.type,
        sourceId: seed.sourceId,
        lastMessageText: seed.message,
        lastMessageSenderUserId: seed.senderUserId,
        participantPreviews,
        previewTitle: seed.title,
        previewSubtitle: seed.subtitle,
        location: {
          city: "Miami",
          neighborhood: seed.neighborhood,
          venueName: seed.venueName,
        },
        createdAt,
      }),
      unreadByUserId: makeUnreadMap(participantUserIds, currentUserId, seed.unreadCount, createdAt),
    };
  });
}

export function sortConnectionsForInbox(connections: ConnectionDocument[]) {
  return [...connections].sort(
    (a, b) => new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime(),
  );
}

export function getConnectionBuckets(connections: ConnectionDocument[]): ConnectionBuckets {
  const sorted = sortConnectionsForInbox(connections);
  return {
    all: sorted,
    dating: sorted.filter((connection) => connection.type === "dating"),
    friend: sorted.filter((connection) => connection.type === "friend"),
    plan: sorted.filter((connection) => connection.type === "plan"),
  };
}
