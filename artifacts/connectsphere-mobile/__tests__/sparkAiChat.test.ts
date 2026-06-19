/**
 * Spark AI Chat tests
 * Covers: streaming assembly, AsyncStorage persistence, history correctness,
 * clear conversation, and the server-side rate-limit contract.
 */

// ── Mocks ────────────────────────────────────────────────────────────────────

// Mock AsyncStorage
const mockStorage: Record<string, string> = {};
jest.mock("@react-native-async-storage/async-storage", () => ({
  setItem: jest.fn(async (key: string, value: string) => {
    mockStorage[key] = value;
  }),
  getItem: jest.fn(async (key: string) => mockStorage[key] ?? null),
  removeItem: jest.fn(async (key: string) => {
    delete mockStorage[key];
  }),
}));

// Mock apiBase so sendAiChatMessageStreaming builds a real URL
jest.mock("@/lib/apiBase", () => ({
  apiUrl: (path: string) => `http://localhost:8080${path}`,
}));

// Mock global fetch used by sendAiChatMessageStreaming
const mockFetch = jest.fn();
global.fetch = mockFetch;

// ── Helpers ───────────────────────────────────────────────────────────────────

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  clearConversation,
  loadConversation,
  makeAssistantMessage,
  makeUserMessage,
  saveConversation,
  sendAiChatMessageStreaming,
  type AiChatMessage,
} from "@/lib/aiChat";

/** Build a minimal SSE stream from an array of token strings */
function makeStream(tokens: string[], error?: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const token of tokens) {
        const line = `data: ${JSON.stringify({ delta: token })}\n\n`;
        controller.enqueue(encoder.encode(line));
      }
      if (error) {
        const errLine = `data: ${JSON.stringify({ error })}\n\n`;
        controller.enqueue(encoder.encode(errLine));
      } else {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
      }
      controller.close();
    },
  });
}

// ── Streaming tests ───────────────────────────────────────────────────────────

describe("sendAiChatMessageStreaming", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("assembles tokens in order and resolves with full text", async () => {
    const tokens = ["Hello", " there", ", how can", " I help?"];
    mockFetch.mockResolvedValue({
      ok: true,
      body: makeStream(tokens),
    });

    const deltas: string[] = [];
    const history = [makeUserMessage("hi")];
    const result = await sendAiChatMessageStreaming(
      "dating",
      history,
      (d) => deltas.push(d),
    );

    expect(result).toBe("Hello there, how can I help?");
    expect(deltas).toEqual(tokens);
  });

  it("calls the streaming endpoint with correct mode and history", async () => {
    mockFetch.mockResolvedValue({ ok: true, body: makeStream(["ok"]) });

    const history: AiChatMessage[] = [
      makeUserMessage("hey"),
      makeAssistantMessage("hi!"),
      makeUserMessage("help me"),
    ];
    await sendAiChatMessageStreaming("friends", history, () => {});

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/ai-chat/stream");
    const body = JSON.parse(init.body as string);
    expect(body.mode).toBe("friends");
    expect(body.messages).toHaveLength(3);
    expect(body.messages[2].content).toBe("help me");
  });

  it("throws when the server returns an error event", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      body: makeStream([], "Rate limit exceeded"),
    });

    await expect(
      sendAiChatMessageStreaming("dating", [makeUserMessage("test")], () => {}),
    ).rejects.toThrow("Rate limit exceeded");
  });

  it("throws when fetch response is not ok", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 429, body: null });

    await expect(
      sendAiChatMessageStreaming("dating", [makeUserMessage("test")], () => {}),
    ).rejects.toThrow("AI stream failed: 429");
  });

  it("respects AbortSignal and rejects with AbortError", async () => {
    const controller = new AbortController();
    // Resolve with a stream that never closes
    const neverEnding = new ReadableStream({ start() {} });
    mockFetch.mockResolvedValue({ ok: true, body: neverEnding });

    // Abort immediately after starting
    const promise = sendAiChatMessageStreaming(
      "dating",
      [makeUserMessage("test")],
      () => {},
      controller.signal,
    );
    controller.abort();

    // fetch throws AbortError when signal fires — mock that behavior
    mockFetch.mockRejectedValueOnce(Object.assign(new Error("aborted"), { name: "AbortError" }));
    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
  });
});

// ── Persistence tests ─────────────────────────────────────────────────────────

describe("conversation persistence", () => {
  beforeEach(() => {
    // Clear in-memory mock storage
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
    (AsyncStorage.setItem as jest.Mock).mockClear();
    (AsyncStorage.getItem as jest.Mock).mockClear();
    (AsyncStorage.removeItem as jest.Mock).mockClear();
  });

  it("saves and reloads conversation for dating mode", async () => {
    const msgs: AiChatMessage[] = [
      makeUserMessage("first message"),
      makeAssistantMessage("first reply"),
    ];
    await saveConversation("dating", msgs);
    const loaded = await loadConversation("dating");
    expect(loaded).toHaveLength(2);
    expect(loaded[0]?.content).toBe("first message");
    expect(loaded[1]?.content).toBe("first reply");
  });

  it("dating and friends histories are stored independently", async () => {
    await saveConversation("dating", [makeUserMessage("dating msg")]);
    await saveConversation("friends", [makeUserMessage("friends msg")]);

    const dating = await loadConversation("dating");
    const friends = await loadConversation("friends");

    expect(dating[0]?.content).toBe("dating msg");
    expect(friends[0]?.content).toBe("friends msg");
  });

  it("returns empty array when nothing is stored", async () => {
    const loaded = await loadConversation("dating");
    expect(loaded).toEqual([]);
  });

  it("clearConversation removes the stored history", async () => {
    await saveConversation("dating", [makeUserMessage("test")]);
    await clearConversation("dating");
    const loaded = await loadConversation("dating");
    expect(loaded).toEqual([]);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith("@aiChat:dating:v1");
  });

  it("trims to last 40 messages when saving", async () => {
    const many: AiChatMessage[] = Array.from({ length: 60 }, (_, i) =>
      makeUserMessage(`msg ${i}`),
    );
    await saveConversation("dating", many);
    const loaded = await loadConversation("dating");
    expect(loaded).toHaveLength(40);
    // Should keep the LAST 40 — so msg 20..59
    expect(loaded[0]?.content).toBe("msg 20");
  });

  it("handles corrupted storage gracefully — returns empty array", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce("not valid json{{");
    const loaded = await loadConversation("dating");
    expect(loaded).toEqual([]);
  });
});

// ── History correctness ───────────────────────────────────────────────────────
// The AI only gives good answers when the FULL conversation history is sent
// every turn — not just the latest message.

describe("history correctness", () => {
  beforeEach(() => mockFetch.mockReset());

  it("sends full history including the new user message each turn", async () => {
    mockFetch.mockResolvedValue({ ok: true, body: makeStream(["reply"]) });

    const existingHistory: AiChatMessage[] = [
      makeUserMessage("turn 1"),
      makeAssistantMessage("response 1"),
      makeUserMessage("turn 2"),
      makeAssistantMessage("response 2"),
    ];

    // Simulate the pattern used in sendMessage: snapshot = [...messages, newUserMsg]
    const newMsg = makeUserMessage("turn 3");
    const snapshot = [...existingHistory, newMsg];

    await sendAiChatMessageStreaming("dating", snapshot, () => {});

    const body = JSON.parse((mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.messages).toHaveLength(5);
    expect(body.messages[4].content).toBe("turn 3");
    expect(body.messages[4].role).toBe("user");
  });

  it("strips id and createdAt fields — only sends role and content", async () => {
    mockFetch.mockResolvedValue({ ok: true, body: makeStream(["ok"]) });

    const history = [makeUserMessage("test")];
    await sendAiChatMessageStreaming("dating", history, () => {});

    const body = JSON.parse((mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string);
    const sentMsg = body.messages[0];
    expect(sentMsg).toHaveProperty("role");
    expect(sentMsg).toHaveProperty("content");
    expect(sentMsg).not.toHaveProperty("id");
    expect(sentMsg).not.toHaveProperty("createdAt");
  });
});

// ── makeUserMessage / makeAssistantMessage ────────────────────────────────────

describe("message factories", () => {
  it("makeUserMessage creates correct shape", () => {
    const msg = makeUserMessage("hello");
    expect(msg.role).toBe("user");
    expect(msg.content).toBe("hello");
    expect(typeof msg.id).toBe("string");
    expect(typeof msg.createdAt).toBe("string");
  });

  it("makeAssistantMessage creates correct shape", () => {
    const msg = makeAssistantMessage("hi back");
    expect(msg.role).toBe("assistant");
    expect(msg.content).toBe("hi back");
  });

  it("each message gets a unique id", () => {
    const a = makeUserMessage("a");
    const b = makeUserMessage("b");
    expect(a.id).not.toBe(b.id);
  });
});
