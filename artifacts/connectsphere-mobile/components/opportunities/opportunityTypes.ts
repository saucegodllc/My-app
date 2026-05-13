export type OpportunityFilter =
  | "For You"
  | "Hiring"
  | "Side Hustles"
  | "Pop-Ups"
  | "Events"
  | "People"
  | "Groups";

export type OpportunityKind = "hiring" | "sideHustle" | "popup" | "event" | "person" | "group";

export type OpportunityPrimaryAction = "Apply" | "Claim" | "RSVP" | "Connect" | "Join";

export type OpportunityRelayAction = "apply" | "claim" | "rsvp" | "connect" | "join" | "message";

export type OpportunityProfile = {
  label: "Looking to connect" | "Needs help" | "Hiring" | "Mentor" | "Collaborator" | "Professional" | "Local plug";
  age?: number;
  role?: string;
  lookingFor: string;
  offers: string;
  suggestedOpener: string;
  photoUrl?: string;
};

export type OpportunityGroup = {
  memberCount: string;
  activeNow: string;
  theme: string;
  examples: string[];
};

export type OpportunityItem = {
  id: string;
  kind: OpportunityKind;
  title: string;
  subtitle: string;
  description: string;
  location: string;
  timing: string;
  source: string;
  trustCue: string;
  tags: string[];
  primaryAction: OpportunityPrimaryAction;
  actionUrl?: string | null;
  image?: string;
  profile?: OpportunityProfile;
  group?: OpportunityGroup;
  relevanceReason: string;
  isRemote?: boolean;
};

export type OpportunityRelayPayload = {
  userId: string;
  action: OpportunityRelayAction;
  opportunity: {
    id: string;
    kind: OpportunityKind;
    title: string;
    subtitle: string;
    location: string;
    source: string;
    actionUrl?: string | null;
  };
};
