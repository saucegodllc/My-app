export type DiscoverIntent = "dating" | "friends";

export type DiscoverRailAction =
  | "vibe"
  | "shot"
  | "spark"
  | "pass"
  | "create_plan"
  | "best_friend";

export type DiscoverRailColor = "pink" | "shot" | "purple" | "rose" | "blue" | "sky" | "gold";

export type DiscoverRailButtonConfig = {
  icon: string;
  label: string;
  sub: string;
  color: DiscoverRailColor;
  action: DiscoverRailAction;
};

const DATING_RAIL_ACTIONS: DiscoverRailButtonConfig[] = [
  { icon: "heart", label: "LIKE", sub: "Energy", color: "pink", action: "vibe" },
  { icon: "send", label: "SHOOT", sub: "Opener", color: "shot", action: "shot" },
  { icon: "sparkles", label: "SPARK", sub: "Boost", color: "purple", action: "spark" },
  { icon: "close", label: "PASS", sub: "Skip", color: "rose", action: "pass" },
];

const FRIEND_RAIL_ACTIONS: DiscoverRailButtonConfig[] = [
  { icon: "person-add", label: "LIKE", sub: "Friend", color: "blue", action: "vibe" },
  { icon: "calendar", label: "PLAN", sub: "Hang", color: "sky", action: "create_plan" },
  { icon: "people-circle", label: "BESTIES", sub: "Badge", color: "gold", action: "best_friend" },
  { icon: "close", label: "PASS", sub: "Skip", color: "rose", action: "pass" },
];

export function getDiscoverRailActions(intent: DiscoverIntent): DiscoverRailButtonConfig[] {
  return intent === "friends" ? FRIEND_RAIL_ACTIONS : DATING_RAIL_ACTIONS;
}

