export type ConnectMatchMomentTrigger =
  | "accept_request"
  | "like_back_reaction"
  | "accept_shot";

export function shouldShowConnectMatchMoment(trigger: ConnectMatchMomentTrigger) {
  return trigger === "accept_shot";
}
