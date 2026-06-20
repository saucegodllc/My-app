import { parsePlanEnvelope } from "@/lib/planRequestEnvelope";

export type ChatPayload =
  | { kind: "plan_request"; id: string; title: string; time?: string; location?: string }
  | { kind: "plan_response"; id: string; status: "accepted" | "declined" }
  | { kind: "voice"; url: string; durationSeconds?: number }
  | { kind: "gif"; url: string }
  | { kind: "image"; url: string }
  | { kind: "text"; text: string };

const VOICE_PREFIX = "[voice:";
const GIF_PREFIX = "[gif:";
const IMAGE_PREFIX = "[image:";

function stripBracketPayload(text: string, prefix: string): string | null {
  if (!text.startsWith(prefix) || !text.endsWith("]")) return null;
  return text.slice(prefix.length, -1);
}

export function encodeVoiceMemoPayload(url: string, durationSeconds?: number): string {
  const duration = Number.isFinite(durationSeconds) ? Math.max(0, Math.round(durationSeconds ?? 0)) : 0;
  return `${VOICE_PREFIX}${url}:${duration}]`;
}

export function parseChatPayload(content: string | undefined | null): ChatPayload {
  const text = content ?? "";
  const plan = parsePlanEnvelope(text);
  if (plan?.kind === "request") {
    return {
      kind: "plan_request",
      id: plan.request.id,
      title: plan.request.title,
      time: plan.request.time,
      location: plan.request.location,
    };
  }
  if (plan?.kind === "response") {
    return { kind: "plan_response", id: plan.response.id, status: plan.response.status };
  }

  const voicePayload = stripBracketPayload(text, VOICE_PREFIX);
  if (voicePayload) {
    const lastColon = voicePayload.lastIndexOf(":");
    if (lastColon > "https://x".length) {
      const maybeDuration = Number(voicePayload.slice(lastColon + 1));
      const url = voicePayload.slice(0, lastColon);
      if (url && Number.isFinite(maybeDuration)) {
        return { kind: "voice", url, durationSeconds: maybeDuration };
      }
    }
    return { kind: "voice", url: voicePayload };
  }

  const gifUrl = stripBracketPayload(text, GIF_PREFIX);
  if (gifUrl) return { kind: "gif", url: gifUrl };

  const imageUrl = stripBracketPayload(text, IMAGE_PREFIX);
  if (imageUrl) return { kind: "image", url: imageUrl };

  return { kind: "text", text };
}

export function formatDuration(seconds?: number): string | null {
  if (!Number.isFinite(seconds)) return null;
  const total = Math.max(0, Math.round(seconds ?? 0));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export function formatChatPreview(content: string | undefined | null): string {
  const payload = parseChatPayload(content);
  switch (payload.kind) {
    case "plan_request":
      return "Plan request pending";
    case "plan_response":
      return payload.status === "accepted" ? "Plan confirmed" : "Plan declined";
    case "voice": {
      const duration = formatDuration(payload.durationSeconds);
      return duration ? `Voice memo · ${duration}` : "Voice memo";
    }
    case "gif":
      return "GIF";
    case "image":
      return "Photo";
    case "text":
    default:
      return payload.text;
  }
}

export function isPendingPlanPayload(content: string | undefined | null): boolean {
  return parseChatPayload(content).kind === "plan_request";
}
