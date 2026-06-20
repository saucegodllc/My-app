"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiShotAssist = void 0;
const functions = __importStar(require("firebase-functions"));
const https = __importStar(require("https"));
if (!process.env["OPENAI_API_KEY"]) {
    functions.logger.warn("aiShot: OPENAI_API_KEY not set — AI openers will be unavailable");
}
function json(res, status, body) {
    res.status(status).json(body);
}
function callOpenAI(messages, model = "gpt-4o-mini") {
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
            httpRes.on("data", (chunk) => { data += chunk; });
            httpRes.on("end", () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed.choices?.[0]?.message?.content ?? "");
                }
                catch (e) {
                    reject(new Error("Failed to parse OpenAI response"));
                }
            });
        });
        req.on("error", reject);
        req.write(body);
        req.end();
    });
}
exports.aiShotAssist = functions
    .runWith({ timeoutSeconds: 30, memory: "256MB" })
    .https.onRequest(async (req, res) => {
    if (req.method !== "POST")
        return json(res, 405, { error: "Method not allowed" });
    const userId = req.headers["x-cs-user-id"] ?? "";
    if (!userId)
        return json(res, 401, { error: "Unauthorized" });
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
    const body = req.body;
    const { senderName = "someone", targetName = "them", targetBio = "", targetInterests = [], sharedInterests = [], vibeCompatPercent, } = body;
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
        if (openers.length === 0)
            throw new Error("No openers parsed");
        functions.logger.info("aiShotAssist: generated", { userId, count: openers.length });
        return json(res, 200, { openers, fallback: false });
    }
    catch (err) {
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
//# sourceMappingURL=aiShot.js.map