/**
 * AI Shot Assist
 * ──────────────
 * POST /api/ai/shot-assist
 *
 * Generates 3 personalized conversation openers ("Shots") for a given target
 * profile using OpenAI GPT-4o-mini. Each opener is ≤120 chars, warm, specific,
 * and doesn't start with "Hey" or "Hi".
 *
 * Request body:
 * {
 *   senderName: string
 *   targetName: string
 *   targetBio?: string
 *   targetInterests?: string[]
 *   sharedInterests?: string[]
 *   vibeCompatPercent?: number   // 0–100
 * }
 *
 * Response:
 * { openers: string[] }   // array of 3
 *
 * Env vars (set via firebase functions:config or Secret Manager):
 *   OPENAI_API_KEY  — your sk-... key
 */

import * as functions from "firebase-functions";
import * as https from "https";

if (!process.env["OPENAI_API_KEY"]) {
  functions.logger.warn("aiShot: OPENAI_API_KEY not set — AI openers will be unavailable");
}

function json(res: functions.Response, status: number, body: Record<string, unknown>) {
  res.status(status).json(body);
}

interface ShotRequest {
  senderName?: string;
  targetName?: string;
  targetBio?: string;
  targetInterests?: string[];
  sharedInterests?: string[];
  vibeCompatPercent?: number;
}

interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenAIChoice {
  message: OpenAIMessage;
}

interface OpenAIResponse {
  choices: OpenAIChoice[];
}

function callOpenAI(messages: OpenAIMessage[], model = "gpt-4o-mini"): Promise<string> {
  return new Promise((resolve, reject) => {
    const apiKey = process.env["OPENAI_API_KEY"] ?? "";
    const body = JSON.stringify({
      model,
      messages,
      max_tokens: 300,
      temperature: 0.85,
    });

    const options = {
      hostname: "api.openai.com",
      path: "/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (httpRes) => {
      let data = "";
      httpRes.on("data", (chunk: string) => { data += chunk; });
      httpRes.on("end", () => {
        try {
          const parsed = JSON.parse(data) as OpenAIResponse;
          resolve(parsed.choices?.[0]?.message?.content ?? "");
        } catch (e) {
          reject(new Error("Failed to parse OpenAI response"));
        }
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

export const aiShotAssist = functions
  .runWith({ timeoutSeconds: 30, memory: "256MB" })
  .https.onRequest(async (req, res) => {
    if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

    const userId = (req.headers["x-cs-user-id"] as string | undefined) ?? "";
    if (!userId) return json(res, 401, { error: "Unauthorized" });

    const apiKey = process.env["OPENAI_API_KEY"];
    if (!apiKey) {
      // Graceful fallback: return canned generic openers
      return json(res, 200, {
        openers: [
          "Your energy in your photos is contagious — what's your go-to vibe on a Sunday?",
          "Okay your taste is lowkey immaculate. What's currently on your playlist?",
          "Something tells me you have strong opinions on the best spots in Miami — prove me right?",
        ],
        fallback: true,
      });
    }

    const body = req.body as ShotRequest;
    const {
      senderName = "someone",
      targetName = "them",
      targetBio = "",
      targetInterests = [],
      sharedInterests = [],
      vibeCompatPercent,
    } = body;

    const interestLine = targetInterests.length
      ? `Their interests: ${targetInterests.slice(0, 6).join(", ")}.`
      : "";
    const sharedLine = sharedInterests.length
      ? `You both like: ${sharedInterests.slice(0, 4).join(", ")}.`
      : "";
    const compatLine = vibeCompatPercent != null
      ? `Your vibe compatibility score is ${vibeCompatPercent}%.`
      : "";
    const bioLine = targetBio ? `Their bio: "${targetBio}".` : "";

    const systemPrompt = `You are a witty dating coach writing personalized icebreaker messages for ConnectSphere, a Miami-based social/dating app.

Rules:
- Write exactly 3 openers, one per line, numbered 1. 2. 3.
- Each must be ≤120 characters
- Warm, specific, playful — Miami energy without being cringe
- Never start with "Hey", "Hi", or "Hello"
- Reference something specific from their profile (bio or interests)
- If there are shared interests, use them — it's a great hook
- No pickup lines, no generic compliments about looks`;

    const userPrompt = `Write 3 openers for ${senderName} to send to ${targetName}.
${bioLine}
${interestLine}
${sharedLine}
${compatLine}`.trim();

    try {
      const raw = await callOpenAI([
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ]);

      // Parse numbered list: "1. text\n2. text\n3. text"
      const openers = raw
        .split("\n")
        .map((l) => l.replace(/^\d+\.\s*/, "").trim())
        .filter((l) => l.length > 0 && l.length <= 160)
        .slice(0, 3);

      if (openers.length === 0) throw new Error("No openers parsed");

      functions.logger.info("aiShotAssist: generated", { userId, count: openers.length });
      return json(res, 200, { openers, fallback: false });
    } catch (err) {
      functions.logger.error("aiShotAssist: OpenAI error", { userId, err });
      // Graceful fallback
      return json(res, 200, {
        openers: [
          "Your vibe is seriously hard to ignore — what are you usually up to on weekends?",
          "Something about your profile just caught my attention. What's the story behind it?",
          "Okay I need to know more. What's your go-to spot in Miami?",
        ],
        fallback: true,
      });
    }
  });
