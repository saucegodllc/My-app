import { customFetch, type Match, type Profile } from "@workspace/api-client-react";

export type DatingShotStatus = "pending" | "accepted" | "sparked_back" | "ignored";

export type DatingShotApi = {
  id: string;
  fromUserId: string;
  toUserId: string;
  message: string;
  status: DatingShotStatus;
  createdAt: string;
  respondedAt?: string;
  senderProfile?: Profile & { modeData?: Record<string, unknown> };
  receiverProfile?: Profile & { modeData?: Record<string, unknown> };
};

export type ShotResponse = {
  success: boolean;
  shot: DatingShotApi;
  remainingShots?: number | null;
  premiumRequired?: boolean;
};

export type ShotRespondAction = "accept" | "spark_back" | "ignore";

export type ShotRespondResponse = {
  success: boolean;
  shot: DatingShotApi;
  match?: Match;
  chat?: { id: string; matchId: string };
};

type RequestOptions = {
  headers?: HeadersInit;
};

export function sendShot(fromUserId: string, toUserId: string, message: string, options?: RequestOptions) {
  return customFetch<ShotResponse>("/api/dating/shots/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
    body: JSON.stringify({ fromUserId, toUserId, message }),
  });
}

export function getIncomingShots(userId: string, options?: RequestOptions) {
  return customFetch<{ shots: DatingShotApi[] }>(`/api/dating/shots/incoming/${userId}`, {
    headers: options?.headers,
  });
}

export function getSentShots(userId: string, options?: RequestOptions) {
  return customFetch<{ shots: DatingShotApi[] }>(`/api/dating/shots/sent/${userId}`, {
    headers: options?.headers,
  });
}

export function respondToShot(shotId: string, userId: string, action: ShotRespondAction, options?: RequestOptions) {
  return customFetch<ShotRespondResponse>("/api/dating/shots/respond", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
    body: JSON.stringify({ shotId, userId, action }),
  });
}
