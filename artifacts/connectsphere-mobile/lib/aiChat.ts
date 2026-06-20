/**
 * aiChat.ts
 * Client-side service for the Spark (dating) and Vibe (friends) AI companions.
 * Routes through the API server so the Anthropic key stays server-side only.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiUrl } from "./apiBase";

export type AiChatMode = "dating" | "friends";

export type AiChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type AiChatResponse = {
  reply: string;
};

// ─── Typed errors ─────────────────────────────────────────────────────────────
// Lets the UI show distinct copy for rate-limit vs outage vs network failures.

export type AiChatErrorKind = "rate_limited" | "unavailable" | "network" | "stream" | "timeout" | "paywall";

export class AiChatError extends Error {
  readonly kind: AiChatErrorKind;
  readonly status?: number;

  constructor(kind: AiChatErrorKind, message: string, status?: number) {
    super(message);
    this.name = "AiChatError";
    this.kind = kind;
    this.status = status;
  }
}

function errorFromStatus(status: number): AiChatError {
  if (status === 402) {
    return new AiChatError("paywall", "Free limit reached", status);
  }
  if (status === 429) {
    return new AiChatError("rate_limited", "Rate limited", status);
  }
  if (status >= 500 || status === 503 || status === 502) {
    return new AiChatError("unavailable", "AI service unavailable", status);
  }
  return new AiChatError("network", `AI request failed: ${status}`, status);
}

// ─── Timeout helper ───────────────────────────────────────────────────────────
// Merges a deadline AbortSignal with any caller-supplied signal so both can
// cancel the fetch. Uses AbortSignal.any() when available (Expo SDK 52+),
// falls back to a manual forwarder on older runtimes.

function withDeadline(ms: number, callerSignal?: AbortSignal): {
  signal: AbortSignal;
  clear: () => void;
} {
  const controller = new AbortController();
  const tid = setTimeout(() => {
    controller.abort(new AiChatError("timeout", "Request timed out"));
  }, ms);
  const clear = () => clearTimeout(tid);

  // Forward caller abort → our controller
  if (callerSignal) {
    if (callerSignal.aborted) {
      controller.abort(callerSignal.reason);
    } else {
      callerSignal.addEventListener("abort", () => controller.abort(callerSignal.reason), { once: true });
    }
  }

  return { signal: controller.signal, clear };
}

function toAbortError(signal?: AbortSignal): Error {
  if (signal?.reason instanceof Error) return signal.reason;
  return Object.assign(new Error("aborted"), { name: "AbortError" });
}

// ─── Message factory helpers ─────────────────────────────────────────────────

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function makeUserMessage(content: string): AiChatMessage {
  return { id: makeId(), role: "user", content, createdAt: new Date().toISOString() };
}

export function makeAssistantMessage(content: string): AiChatMessage {
  return { id: makeId(), role: "assistant", content, createdAt: new Date().toISOString() };
}

// ─── Standard (non-streaming) request ────────────────────────────────────────

// Non-streaming: 12s timeout (Render cold-start can take ~10s; this gives
// a small buffer while still failing fast enough to feel responsive).
const NON_STREAM_TIMEOUT_MS = 12_000;

export async function sendAiChatMessage(
  mode: AiChatMode,
  history: AiChatMessage[],
  signal?: AbortSignal,
): Promise<string> {
  const messages = history.map(({ role, content }) => ({ role, content }));
  const { signal: deadline, clear } = withDeadline(NON_STREAM_TIMEOUT_MS, signal);
  let res: Response;
  try {
    res = await fetch(apiUrl("/api/ai-chat"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, messages }),
      signal: deadline,
    });
  } catch (e) {
    clear();
    const err = e as Error;
    if (err?.name === "AbortError") {
      // Distinguish timeout (our deadline fired) from user-cancel
      if (err instanceof AiChatError && err.kind === "timeout") throw err;
      throw err;
    }
    throw new AiChatError("network", "Network request failed");
  }
  clear();
  if (!res.ok) throw errorFromStatus(res.status);
  const data = (await res.json().catch(() => null)) as AiChatResponse | null;
  if (!data || typeof data.reply !== "string") {
    throw new AiChatError("unavailable", "Malformed AI response");
  }
  return data.reply;
}

// ─── SSE frame parsing ───────────────────────────────────────────────────────

type StreamEvent = { delta: string } | { done: true } | { error: string };

/**
 * Parse one SSE "data: ..." line. Returns null for malformed frames — the
 * caller skips them. NEVER throws: Hermes/JSC produce different JSON error
 * messages, so message-sniffing (the old approach) rethrew valid skips and
 * killed the whole reply on a single bad frame.
 */
function parseSseLine(line: string): StreamEvent | null {
  if (!line.startsWith("data: ")) return null;
  const raw = line.slice(6).trim();
  if (!raw) return null;
  try {
    const event = JSON.parse(raw) as Partial<Record<string, unknown>>;
    if (typeof event?.error === "string") return { error: event.error };
    if (event?.done === true) return { done: true };
    if (typeof event?.delta === "string") return { delta: event.delta };
    return null;
  } catch {
    return null; // malformed frame — skip, never throw
  }
}

// ─── Streaming request ────────────────────────────────────────────────────────
// Calls POST /api/ai-chat/stream and delivers tokens incrementally via onDelta.
// Resolves with the full assembled text when the stream ends.
//
// Transport: React Native's global fetch does NOT support response streaming
// (`res.body` is undefined), which made every send fail. We use `expo/fetch`
// (WinterCG fetch, Expo SDK 52+) which streams on native. If streaming is
// still unavailable for any reason, we degrade to the non-streaming endpoint
// and deliver the reply as a single delta — slower, but never broken.

// Streaming: 15s timeout to get the first byte (headers + first delta).
// After the first byte arrives, tokens flow fast so no further timeout needed.
const STREAM_CONNECT_TIMEOUT_MS = 15_000;

export async function sendAiChatMessageStreaming(
  mode: AiChatMode,
  history: AiChatMessage[],
  onDelta: (token: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  // TextDecoder ships with Expo's winter runtime alongside expo/fetch; if
  // either is missing we can't stream — use the non-streaming fallback.
  if (typeof TextDecoder === "undefined") {
    const reply = await sendAiChatMessage(mode, history, signal);
    onDelta(reply);
    return reply;
  }

  const url = apiUrl("/api/ai-chat/stream");
  const messages = history.map(({ role, content }) => ({ role, content }));

  // Try expo/fetch for streaming; fall back to non-streaming if unavailable.
  let expoFetch: typeof fetch | undefined = fetch;
  try {
    const mod = await import("expo/fetch");
    expoFetch = mod.fetch as unknown as typeof fetch;
  } catch {
    // expo/fetch not available — fall back
  }

  if (!expoFetch) {
    const reply = await sendAiChatMessage(mode, history, signal);
    onDelta(reply);
    return reply;
  }

  const { signal: deadline, clear: clearDeadline } = withDeadline(STREAM_CONNECT_TIMEOUT_MS, signal);

  let res: Response;
  try {
    res = await expoFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, messages }),
      signal: deadline,
    });
  } catch (e) {
    clearDeadline();
    const err = e as Error;
    if (err?.name === "AbortError") {
      if (err instanceof AiChatError && err.kind === "timeout") throw err;
      throw err;
    }
    // expo/fetch network failure — fall back to non-streaming
    const reply = await sendAiChatMessage(mode, history, signal);
    onDelta(reply);
    return reply;
  }
  clearDeadline(); // connected — cancel the deadline, tokens will flow

  if (deadline.aborted) {
    clearDeadline();
    throw toAbortError(deadline);
  }
  if (!res.ok) throw new AiChatError("stream", `AI stream failed: ${res.status}`, res.status);

  if (!res.body) {
    // Streaming unsupported on this runtime — degrade gracefully.
    const reply = await sendAiChatMessage(mode, history, signal);
    onDelta(reply);
    return reply;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let full = "";
  let sawDone = false;

  const handleEvent = (event: StreamEvent): "stop" | "continue" => {
    if ("error" in event) {
      throw new AiChatError("stream", event.error);
    }
    if ("done" in event) {
      sawDone = true;
      return "stop";
    }
    full += event.delta;
    onDelta(event.delta);
    return "continue";
  };

  try {
    let stopped = false;
    while (!stopped) {
      if (signal?.aborted) throw toAbortError(signal);
      const { done, value } = await reader.read();
      if (done) break;

      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";

      for (const line of lines) {
        const event = parseSseLine(line);
        if (event && handleEvent(event) === "stop") {
          stopped = true;
          break;
        }
      }
    }

    // Flush any complete frame left in the buffer after the stream closed.
    if (!sawDone) {
      buf += decoder.decode();
      const event = parseSseLine(buf);
      if (event) handleEvent(event);
    }
  } finally {
    reader.cancel().catch(() => {});
  }

  // Connection dropped before any content and no done marker → real failure.
  if (!sawDone && full.length === 0) {
    throw new AiChatError("stream", "Stream ended unexpectedly");
  }

  return full;
}

// ─── AsyncStorage conversation persistence ───────────────────────────────────

const STORAGE_KEYS: Record<AiChatMode, string> = {
  dating: "@aiChat:dating:v1",
  friends: "@aiChat:friends:v1",
};

const MAX_PERSISTED = 40;

export async function saveConversation(
  mode: AiChatMode,
  messages: AiChatMessage[],
): Promise<void> {
  try {
    const trimmed = messages.slice(-MAX_PERSISTED);
    await AsyncStorage.setItem(STORAGE_KEYS[mode], JSON.stringify(trimmed));
  } catch {
    // non-fatal
  }
}

export async function loadConversation(mode: AiChatMode): Promise<AiChatMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS[mode]);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is AiChatMessage =>
        typeof m === "object" &&
        m !== null &&
        typeof (m as AiChatMessage).id === "string" &&
        ((m as AiChatMessage).role === "user" ||
          (m as AiChatMessage).role === "assistant"),
    );
  } catch {
    return [];
  }
}

export async function clearConversation(mode: AiChatMode): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS[mode]);
  } catch {}
}

// ─── Static content ──────────────────────────────────────────────────────────

export const DATING_STARTER_PROMPTS = [
  "Write me an opener that actually gets a reply 🔥",
  "They left me on read — what do I do?",
  "Best first date spots in Miami right now?",
  "Help me reply to this message they just sent me",
  "Is this person interested or just being nice?",
  "My profile feels boring — how do I fix it?",
  "We've been talking for weeks but nothing's happening",
  "I'm nervous about our date tomorrow, help me out",
];

export const FRIENDS_STARTER_PROMPTS = [
  "How do I suggest hanging out without it being weird?",
  "Best places to meet people in Miami?",
  "Fun group activities in Miami this weekend?",
  "I'm shy — how do I keep conversations going?",
  "How do I turn an acquaintance into an actual friend?",
  "Good spots for a low-key first hangout in Miami?",
  "I just moved to Miami — where do I even start?",
  "Help me plan a fun day for me and a new friend",
];

export function getStarterPrompts(mode: AiChatMode): string[] {
  return mode === "friends" ? FRIENDS_STARTER_PROMPTS : DATING_STARTER_PROMPTS;
}

export const AI_BOT_NAMES: Record<AiChatMode, string> = {
  dating: "Spark ✨",
  friends: "Vibe 🌊",
};

export const AI_BOT_SUBTITLES: Record<AiChatMode, string> = {
  dating: "your new virtual bestie, what's good? 👋",
  friends: "your new virtual bestie, what's good? 👋",
};
