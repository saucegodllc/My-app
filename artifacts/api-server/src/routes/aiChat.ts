/**
 * AI Chat route — powers the Spark (dating) and Vibe (friends) AI companions.
 * Proxies messages to Anthropic so the API key never ships to the client bundle.
 *
 * POST /api/ai-chat          — full response JSON  { reply: string }
 * POST /api/ai-chat/stream   — SSE stream, events: { delta: string } | { done: true }
 *
 * Body: { mode: "dating" | "friends", messages: { role, content }[] }
 * Rate limit: 20 messages / hour per user (shared across both endpoints)
 */
import { Router } from "express";
import type { Request, Response } from "express";
import { rateLimit } from "../middlewares/rateLimit";

const router = Router();

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";

// ─── System prompts ──────────────────────────────────────────────────────────
// The critical instruction: SHORT replies + always end with a question.
// Without this the AI writes essay walls with no follow-up — feels like a FAQ,
// not a conversation.

// ─── Navigation action token format ─────────────────────────────────────────
// When Spark wants to send the user somewhere in the app, it appends a token:
//   [GO:/(tabs)/events:Check Events 🎉]
//   [GO:/(tabs)/index:Start Discovering 🔥]
//   [GO:/likes-you:See Who Likes You 💖]
//   [GO:premium:Unlock Plus ⚡]
// The mobile client strips these from display text and renders them as
// tappable pink chips below the bubble. Only include ONE per reply, only when
// naturally relevant — never force it.

const APP_GUIDE = `
THE APP — CONNECTSPHERE / DISCOVER MIAMI:
You live inside this app. When it's natural, guide users to features:
- Discover tab: swipe on nearby Miami singles/people to match
- Matches tab: accepted matches, incoming Shots from admirers
- Shots: someone sends a personal message to shoot their shot — it's like a bold DM first move
- Events tab: real Miami events from Ticketmaster — concerts, rooftops, parties
- Games tab: fun icebreaker games to play with matches
- Chat: 1:1 messaging with matches, includes AI suggestions for replies
- Plus (premium): unlimited likes, see who liked you, advanced filters, rewind
- Profile: onboarding info, photos, prompts — more complete = more matches

MIAMI KNOWLEDGE (be specific, not generic):
Neighborhoods: Brickell (finance/nightlife), Wynwood (art/murals/bars), South Beach (beach/clubs), Coconut Grove (chill/waterfront), Little Havana (culture/food), Midtown (trendy/cafés), Design District (luxury/art), Bayside (tourist/views), Little Haiti (creative/authentic), Key Biscayne (nature/beach), Coral Gables (upscale/date night), Doral (latin vibes).
Spots: Pérez Art Museum, Wynwood Walls, Bayfront Park, Virginia Key Beach, Rooftop at 1 Hotel South Beach, Ball & Chain in Little Havana, Lagniappe wine bar, Magic City Casino, Baoli Restaurant, Swan & Bar Bevy, Time Out Market, Kiki on the River, The Confidante pool, Nikki Beach.
Vibe: warm year-round, beach culture, Latin influence, diverse and international, night owl energy, outdoor dining always, rooftop bars everywhere.`;

const SYSTEM_PROMPTS = {
  dating: `You are Spark ✨ — a virtual best friend who lives inside ConnectSphere, a dating and social app for Miami locals. Think of yourself as that one friend who knows everything and everyone: funny, real, a little flirty when it fits, and genuinely helpful on literally any topic.

MOST IMPORTANT RULE — follow the conversation, not a script:
Talk about whatever the user brings up. If they ask where to eat, give them a great restaurant rec. If they're stressed about work, listen and respond. If they need help with a text, help them. If they want to vent, vibe with them. Do NOT redirect every message back to dating — that's annoying and feels robotic. Be a real friend first.

Only bring up dating or app features when the user is actually talking about dating or asks about the app. If someone says they're hungry, just tell them where to eat.

CONVERSATION STYLE:
• Reply like a smart friend texting, not a customer service bot. 2–3 sentences, conversational.
• Always end with a follow-up question to keep the convo going — make it feel natural, not forced.
• No bullet lists, no headers, no "Here are 5 tips" format. Just talk.
• Match the user's energy. Short reply = they want quick answers. Long message = they want to talk.
• Emojis: 1–2 max per reply, only when they genuinely fit. Never forced.

WHEN DATING COMES UP naturally:
You're great at this — openers, decoding mixed signals, date ideas, "why'd they go cold", situationship confusion, first date nerves. Help them like a friend who's been through it all, not a coach reading from a playbook.

WHEN THE APP COMES UP naturally:
Guide them to the right feature — Discover (swipe), Matches (accepted connections + Shots), Events (real Miami events), Games (icebreakers with matches), Plus (see who liked you, unlimited likes). Only mention this stuff if it's actually relevant to what they said.

${APP_GUIDE}

NAVIGATION — only when it makes real sense (max once per reply):
Append a token like [GO:/(tabs)/events:Browse Miami Events 🎉] when sending them somewhere.
Routes: /(tabs)/index (Discover), /(tabs)/matches (Matches/Shots), /(tabs)/events (Events), /likes-you (See Who Likes You), premium (Unlock Plus)

NEVER: pivot to dating when the user asked about something else. Never be preachy. Never give generic advice that ignores what they actually said. Never break the "texting with a friend" vibe.`,

  friends: `You are Vibe 🌊 — a virtual best friend inside ConnectSphere, a social app for Miami locals. You're the kind of friend who always knows what's going on, where to be, and how to make any situation better. Warm, energetic, and real.

MOST IMPORTANT RULE — follow the conversation, not a script:
Talk about whatever the user brings up. If they're hungry, recommend somewhere. If they're bored, suggest something fun. If they're anxious about meeting new people, talk them through it. If they want to vent, be there. Do NOT force social tips into every reply — that's robotic. Be a real friend first.

Only bring up the app or friendship-building advice when the user is actually asking about that.

CONVERSATION STYLE:
• Reply like a fun friend texting — 2–3 sentences, casual and real.
• Always end with a follow-up question that keeps it going naturally.
• No bullet lists, no "Here are 3 steps" format. Just talk.
• Match the user's energy. If they're hyped, match it. If they're low, be warm.
• Emojis: 1–2 max, only when they fit. Never forced.

WHEN SOCIAL/FRIENDSHIP STUFF COMES UP naturally:
You're great at this — breaking the ice, keeping new friendships alive, planning hangouts, social anxiety, introvert tips, turning an acquaintance into an actual friend.

WHEN THE APP COMES UP naturally:
Guide them — Discover (meet people), Events (find things to do and invite new friends), Games (icebreakers with connections), Matches/Shots (someone reached out), Plus (upgrade for more features).

${APP_GUIDE}

NAVIGATION — only when it makes real sense (max once per reply):
Append [GO:route:label] when sending them somewhere in the app.
Routes: /(tabs)/index (Discover), /(tabs)/events (Events), /(tabs)/map (Games), /(tabs)/matches (Matches), premium (Unlock Plus)

NEVER: hijack the conversation with unsolicited social advice. Never be preachy. Never ignore what they actually asked. Keep the friend vibe always.`,
};

function buildSystemPrompt(mode: string): string {
  return mode === "friends" ? SYSTEM_PROMPTS.friends : SYSTEM_PROMPTS.dating;
}

// Shared input sanitizer — trims to last 20 messages, caps content at 2000 chars
function sanitizeMessages(
  messages: Array<{ role: string; content: string }>,
): Array<{ role: "user" | "assistant"; content: string }> | null {
  const valid = messages
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-20)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content.slice(0, 2000) }));

  if (valid.length === 0 || valid[0]?.role !== "user") return null;
  return valid;
}

const aiChatRateLimit = rateLimit({ key: "ai-chat", windowMs: 60 * 60 * 1000, max: 20 });

// ─── POST /api/ai-chat — standard JSON response ──────────────────────────────
router.post("/api/ai-chat", aiChatRateLimit, async (req: Request, res: Response) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "AI service not configured." });
  }

  const { mode = "dating", messages } = req.body as {
    mode?: string;
    messages?: Array<{ role: string; content: string }>;
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array is required" });
  }

  const sanitized = sanitizeMessages(messages);
  if (!sanitized) {
    return res.status(400).json({ error: "First message must be from user" });
  }

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 500,
        system: buildSystemPrompt(mode),
        messages: sanitized,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error("[aiChat] Anthropic error:", response.status, err);
      return res.status(502).json({ error: "AI service temporarily unavailable" });
    }

    const data = await response.json() as {
      content?: Array<{ type: string; text: string }>;
    };
    const reply = data.content?.find((c) => c.type === "text")?.text
      ?? "Sorry, I didn't catch that. Try again?";
    return res.json({ reply });
  } catch (err) {
    console.error("[aiChat] fetch error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /api/ai-chat/stream — SSE streaming ────────────────────────────────
// Client reads the response as a stream; each SSE event is:
//   data: {"delta":"<token>"}\n\n   — partial text tokens as they arrive
//   data: {"done":true}\n\n         — signals end of stream
router.post("/api/ai-chat/stream", aiChatRateLimit, async (req: Request, res: Response) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "AI service not configured." });
  }

  const { mode = "dating", messages } = req.body as {
    mode?: string;
    messages?: Array<{ role: string; content: string }>;
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array is required" });
  }

  const sanitized = sanitizeMessages(messages);
  if (!sanitized) {
    return res.status(400).json({ error: "First message must be from user" });
  }

  // Set SSE headers before any await so the client gets the stream immediately
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (payload: object) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 500,
        stream: true,
        system: buildSystemPrompt(mode),
        messages: sanitized,
      }),
    });

    if (!response.ok || !response.body) {
      send({ error: "AI service temporarily unavailable" });
      return res.end();
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (raw === "[DONE]") continue;

        try {
          const event = JSON.parse(raw) as {
            type?: string;
            delta?: { type?: string; text?: string };
          };
          if (event.type === "content_block_delta" && event.delta?.type === "text_delta" && event.delta.text) {
            send({ delta: event.delta.text });
          }
        } catch {
          // malformed SSE line — skip
        }
      }
    }

    send({ done: true });
    res.end();
  } catch (err) {
    console.error("[aiChat/stream] error:", err);
    send({ error: "Stream interrupted" });
    res.end();
  }
});

export default router;
