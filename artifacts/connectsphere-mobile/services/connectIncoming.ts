import type {
  CsReaction,
  CsReactionType,
  CsRequest,
  CsRequestType,
} from "./connectApi.ts";

export type IncomingActionType =
  | "spark"
  | "like"
  | "shot"
  | "plan"
  | "vibe"
  | "connect"
  | "chat";

export type IncomingActionCard =
  | {
      id: string;
      sourceType: "reaction";
      actionType: IncomingActionType;
      icon: string;
      color: string;
      label: string;
      subtitle: string;
      senderId: string;
      senderName?: string;
      senderPhotoUrl?: string;
      senderAge?: number;
      senderNeighborhood?: string;
      createdAt: string;
      isLocked: boolean;
      rawItem: CsReaction;
    }
  | {
      id: string;
      sourceType: "request";
      actionType: IncomingActionType;
      icon: string;
      color: string;
      label: string;
      subtitle: string;
      senderId: string;
      senderName?: string;
      senderPhotoUrl?: string;
      senderAge?: number;
      senderNeighborhood?: string;
      createdAt: string;
      isLocked: boolean;
      rawItem: CsRequest;
    };

const REACTION_ACTIONS: Record<CsReactionType, IncomingActionType> = {
  spark: "spark",
  like: "like",
  shot_reaction: "shot",
  plan_like: "plan",
  vibe_reaction: "vibe",
};

const REACTION_ICONS: Record<CsReactionType, string> = {
  spark: "flash",
  like: "heart",
  shot_reaction: "basketball",
  plan_like: "calendar",
  vibe_reaction: "musical-notes",
};

const REACTION_COLORS: Record<CsReactionType, string> = {
  spark: "#C084FC",
  like: "#FF2DA8",
  shot_reaction: "#FB923C",
  plan_like: "#34D399",
  vibe_reaction: "#60A5FA",
};

const REQUEST_META: Record<CsRequestType, { actionType: IncomingActionType; icon: string; color: string; label: string; subtitle: string }> = {
  shot_request: {
    actionType: "shot",
    icon: "basketball",
    color: "#FB923C",
    label: "Shot",
    subtitle: "Sent an intention",
  },
  plan_request: {
    actionType: "plan",
    icon: "calendar",
    color: "#34D399",
    label: "Plan",
    subtitle: "Wants to make plans",
  },
  chat_request: {
    actionType: "chat",
    icon: "chatbubble-ellipses",
    color: "#60A5FA",
    label: "Chat",
    subtitle: "Wants to text",
  },
  connect_request: {
    actionType: "connect",
    icon: "person-add",
    color: "#FF2DA8",
    label: "Connect",
    subtitle: "Asked to connect",
  },
};

function reactionLabel(type: CsReactionType) {
  switch (type) {
    case "spark":
      return "Spark";
    case "like":
      return "Like";
    case "shot_reaction":
      return "Shot";
    case "plan_like":
      return "Plan";
    case "vibe_reaction":
      return "Vibe";
    default:
      return "Action";
  }
}

function reactionSubtitle(type: CsReactionType) {
  switch (type) {
    case "spark":
      return "Sparked your profile";
    case "like":
      return "Liked your energy";
    case "shot_reaction":
      return "Reacted to a Shot";
    case "plan_like":
      return "Liked a Plan";
    case "vibe_reaction":
      return "Matched your vibe";
    default:
      return "Sent an action";
  }
}

function requestSubtitle(request: CsRequest) {
  if (request.type === "plan_request" && request.planTitle) {
    return `Wants "${request.planTitle}"`;
  }
  if (request.message) return request.message;
  switch (request.type) {
    case "shot_request":
      return "Shot their shot";
    case "plan_request":
      return "Wants to make plans";
    case "chat_request":
      return "Wants to turn this into a chat";
    case "connect_request":
    default:
      return "Asked to connect";
  }
}

export function buildIncomingActionCards({
  reactions,
  requests,
  isPremium,
}: {
  reactions: CsReaction[];
  requests: CsRequest[];
  isPremium: boolean;
}): IncomingActionCard[] {
  const reactionCards = reactions
    .filter((reaction) => reaction.status === "pending")
    .flatMap((reaction): IncomingActionCard[] => {
      const type = reaction.type as CsReactionType;
      const actionType = REACTION_ACTIONS[type];
      if (!actionType) return [];
      return [
        {
          id: `reaction:${reaction.id}`,
          sourceType: "reaction",
          actionType,
          icon: REACTION_ICONS[type],
          color: REACTION_COLORS[type],
          label: reactionLabel(type),
          subtitle: reactionSubtitle(type),
          senderId: reaction.senderId,
          senderName: reaction.senderName,
          senderPhotoUrl: reaction.senderPhotoUrl,
          senderAge: reaction.senderAge,
          senderNeighborhood: reaction.senderNeighborhood,
          createdAt: reaction.createdAt,
          isLocked: !isPremium && reaction.isBlurredForReceiver,
          rawItem: reaction,
        },
      ];
    });

  const requestCards = requests
    .filter((request) => request.status === "pending")
    .flatMap((request): IncomingActionCard[] => {
      const meta = REQUEST_META[request.type];
      if (!meta) return [];
      return [
        {
          id: `request:${request.id}`,
          sourceType: "request",
          actionType: meta.actionType,
          icon: meta.icon,
          color: meta.color,
          label: meta.label,
          subtitle: requestSubtitle(request) || meta.subtitle,
          senderId: request.senderId,
          senderName: request.senderName,
          senderPhotoUrl: request.senderPhotoUrl,
          senderAge: request.senderAge,
          senderNeighborhood: request.senderNeighborhood,
          createdAt: request.createdAt,
          isLocked: !isPremium,
          rawItem: request,
        },
      ];
    });

  return [...reactionCards, ...requestCards]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((card, index) => ({
      ...card,
      isLocked: isPremium ? false : index > 0,
    }));
}
