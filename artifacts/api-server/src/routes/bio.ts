import { Router, type Request, type Response } from "express";
import { getAuth } from "@clerk/express";
import OpenAI from "openai";
import { isFeatureEnabled } from "../lib/featureFlags";
import { rateLimit } from "../middlewares/rateLimit";

const router = Router();

const openai = new OpenAI({
  baseURL: process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"],
  apiKey: process.env["AI_INTEGRATIONS_OPENAI_API_KEY"] ?? "placeholder",
});

function cleanBio(rawBio: string): string {
  return rawBio
    .replace(/^["']|["']$/g, "")
    .replace(/#/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function fallbackBio(input: {
  firstName?: string;
  intent?: string;
  location?: string;
  interests?: string[];
  whyHere?: string;
}): string {
  const interests = Array.isArray(input.interests) ? input.interests.filter(Boolean).slice(0, 2) : [];
  const location = input.location && input.location !== "South Florida" ? input.location : "South Florida";
  const interestCopy = interests.length > 0 ? interests.join(" + ") : "good music + easy plans";
  const nameCopy = input.firstName ? `${input.firstName} here, ` : "";
  const intentCopy =
    input.intent === "friendship" ? "new friends and spontaneous plans" :
    input.intent === "dating" ? "real chemistry and easy laughs" :
    input.whyHere || "good people and plans that actually happen";

  return cleanBio(`${nameCopy}${location} days, ${interestCopy}, and main-character energy 🌴 Here for ${intentCopy} ✨`);
}

async function generateBio(req: Request, res: Response) {
  if (!isFeatureEnabled("ai_bio")) return res.status(403).json({ error: "AI bio generation is currently unavailable." });
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { firstName, whoYouAre, whyHere, intent, location, interests } = req.body as {
    firstName?: string;
    whoYouAre?: string;
    whyHere?: string;
    intent?: string;
    location?: string;
    interests?: string[];
  };

  if (!whoYouAre && !whyHere && (!Array.isArray(interests) || interests.length === 0)) {
    return res.status(400).json({ error: "Please add a few interests or profile details first." });
  }

  const configuredApiKey = process.env["AI_INTEGRATIONS_OPENAI_API_KEY"];
  if (!configuredApiKey || configuredApiKey === "placeholder") {
    return res.json({ bio: fallbackBio({ firstName, intent, location, interests, whyHere }) });
  }

  const intentContext =
    intent === "dating" ? "looking for romantic connections" :
    intent === "friendship" ? "looking to make new friends" :
    "open to dating and friendship";

  const prompt = `Write a short dating/social app bio for someone on ConnectSphere, a South Florida social app.
Profile context:
- First name: ${firstName || "not specified"}
- About them: ${whoYouAre || "not specified"}
- Why they are here: ${whyHere || "not specified"}
- Interests: ${Array.isArray(interests) && interests.length > 0 ? interests.join(", ") : "not specified"}
- Location: ${location || "South Florida"}
- Intent: They are ${intentContext}.

Rules:
- Maximum 180 characters.
- First person.
- Warm, flirty/social, animated, and South Florida-coded.
- Include 1-2 tasteful emojis that match the vibe.
- Make it punchy and alive, like a profile someone would actually want to reply to.
- No hashtags.
- No quotation marks.
- Avoid cliches like "love to laugh".
- Return only the bio text.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 80,
      temperature: 0.9,
      messages: [{ role: "user", content: prompt }],
    });

    const rawBio = completion.choices[0]?.message?.content?.trim() ?? "";
    const bio = cleanBio(rawBio) || fallbackBio({ firstName, intent, location, interests, whyHere });
    return res.json({ bio });
  } catch (err) {
    return res.json({ bio: fallbackBio({ firstName, intent, location, interests, whyHere }) });
  }
}

router.post("/bio/generate", rateLimit({ key: "ai_bio", windowMs: 60_000, max: 10 }), generateBio);
router.post("/api/bio/generate", rateLimit({ key: "ai_bio_legacy", windowMs: 60_000, max: 10 }), generateBio);

export default router;
