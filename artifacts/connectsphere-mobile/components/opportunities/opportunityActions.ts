import type { OpportunityFilter, OpportunityItem, OpportunityRelayAction, OpportunityRelayPayload } from "./opportunityTypes";

const filterToKinds: Record<Exclude<OpportunityFilter, "For You">, OpportunityItem["kind"][]> = {
  Hiring: ["hiring"],
  "Side Hustles": ["sideHustle"],
  "Pop-Ups": ["popup"],
  Events: ["event"],
  People: ["person"],
  Groups: ["group"],
};

export function validateOpportunityUrl(url: string | undefined | null): string | null {
  const trimmed = url?.trim();
  if (!trimmed || trimmed === "#") return null;
  if (/^https?:\/\/(www\.)?connectsphere\.app\//i.test(trimmed)) return null;
  if (!/^https:\/\//i.test(trimmed)) return null;
  return trimmed;
}

export function filterOpportunityItems(items: OpportunityItem[], filter: OpportunityFilter): OpportunityItem[] {
  if (filter === "For You") return items;
  const kinds = filterToKinds[filter];
  return items.filter((item) => kinds.includes(item.kind));
}

export function searchOpportunityItems(items: OpportunityItem[], query: string): OpportunityItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => {
    const profileText = item.profile
      ? [item.profile.label, item.profile.role, item.profile.lookingFor, item.profile.offers, item.profile.suggestedOpener].join(" ")
      : "";
    const groupText = item.group ? [item.group.theme, ...item.group.examples].join(" ") : "";
    return [
      item.title,
      item.subtitle,
      item.description,
      item.location,
      item.timing,
      item.source,
      item.trustCue,
      item.relevanceReason,
      ...item.tags,
      profileText,
      groupText,
    ]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });
}

export function selectOpportunitySpotlight(items: OpportunityItem[]): OpportunityItem | null {
  return (
    items.find((item) => item.kind === "popup" || item.kind === "event") ??
    items.find((item) => validateOpportunityUrl(item.actionUrl)) ??
    items.find((item) => item.kind === "person") ??
    items[0] ??
    null
  );
}

export function actionToRelayAction(label: OpportunityItem["primaryAction"]): OpportunityRelayAction {
  if (label === "Apply") return "apply";
  if (label === "RSVP") return "rsvp";
  if (label === "Connect") return "connect";
  if (label === "Join") return "join";
  return "claim";
}

export function buildOpportunityRelayPayload(
  item: OpportunityItem,
  action: OpportunityRelayAction,
  userId: string,
): OpportunityRelayPayload {
  return {
    userId,
    action,
    opportunity: {
      id: item.id,
      kind: item.kind,
      title: item.title,
      subtitle: item.subtitle,
      location: item.location,
      source: item.source,
      actionUrl: validateOpportunityUrl(item.actionUrl),
    },
  };
}
