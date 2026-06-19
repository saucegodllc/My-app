/**
 * planRequestEnvelope.ts
 *
 * Plan requests travel INSIDE normal chat messages (spec 2.1/2.2) so they:
 *   - persist server-side with the conversation (survive app restart),
 *   - sync to the other participant through the existing message transport
 *     (server matches, inbox chats, and JSON chats alike),
 *   - need zero new endpoints or schema changes.
 *
 * Two envelope kinds, folded into UI state by the chat screen:
 *   ::cs_plan_request::v1::{json}   — a pending plan proposal (renders as card)
 *   ::cs_plan_response::v1::{json}  — accept/decline for a prior request
 *     (hidden from the message list; flips the matching card's status)
 */

export type PlanRequestPayload = {
  /** Stable id shared by the request and its responses. */
  id: string;
  title: string;
  time?: string;
  location?: string;
};

export type PlanResponsePayload = {
  id: string;
  status: "accepted" | "declined";
};

const REQUEST_PREFIX = "::cs_plan_request::v1::";
const RESPONSE_PREFIX = "::cs_plan_response::v1::";

export function encodePlanRequest(payload: PlanRequestPayload): string {
  return `${REQUEST_PREFIX}${JSON.stringify(payload)}`;
}

export function encodePlanResponse(payload: PlanResponsePayload): string {
  return `${RESPONSE_PREFIX}${JSON.stringify(payload)}`;
}

export type ParsedPlanEnvelope =
  | { kind: "request"; request: PlanRequestPayload }
  | { kind: "response"; response: PlanResponsePayload }
  | null;

export function parsePlanEnvelope(content: string | undefined | null): ParsedPlanEnvelope {
  if (!content) return null;
  if (content.startsWith(REQUEST_PREFIX)) {
    try {
      const raw = JSON.parse(content.slice(REQUEST_PREFIX.length)) as Partial<PlanRequestPayload>;
      if (typeof raw?.id === "string" && typeof raw?.title === "string") {
        return {
          kind: "request",
          request: {
            id: raw.id,
            title: raw.title,
            time: typeof raw.time === "string" ? raw.time : undefined,
            location: typeof raw.location === "string" ? raw.location : undefined,
          },
        };
      }
    } catch {
      // malformed — treat as plain text
    }
    return null;
  }
  if (content.startsWith(RESPONSE_PREFIX)) {
    try {
      const raw = JSON.parse(content.slice(RESPONSE_PREFIX.length)) as Partial<PlanResponsePayload>;
      if (typeof raw?.id === "string" && (raw.status === "accepted" || raw.status === "declined")) {
        return { kind: "response", response: { id: raw.id, status: raw.status } };
      }
    } catch {
      // malformed — treat as plain text
    }
    return null;
  }
  return null;
}
