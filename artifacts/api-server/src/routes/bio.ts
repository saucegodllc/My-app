import { Router } from "express";
import OpenAI from "openai";
import { getAuth } from "@clerk/express";

const router = Router();

const openai = new OpenAI({
  baseURL: process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"],
  apiKey: process.env["AI_INTEGRATIONS_OPENAI_API_KEY"] ?? "placeholder",
});

router.post("/api/bio/generate", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { whoYouAre, whyHere, intent } = req.body as {
    whoYouAre?: string;
    whyHere?: string;
    intent?: string;
  };

  if (!whoYouAre && !whyHere) {
    return res.status(400).json({ error: "Please tell us a bit about yourself first." });
  }

  const intentContext =
    intent === "dating" ? "looking for romantic connections"
    : intent === "friendship" ? "looking to make new friends"
    : "open to dating and friendship";

  const prompt = `Write a SHORT, engaging dating/social app bio (2-3 sentences, max 180 characters) for someone on ConnectSphere, a South Florida social app.
They said:
- About themselves: "${whoYouAre || "not specified"}"
- Why they're on the app: "${whyHere || "not specified"}"
- They are ${intentContext}.

Write in first person, casual and warm. No hashtags. No quotes. South Florida vibe. Be specific and authentic — avoid clichés like "love to laugh". Return ONLY the bio text, nothing else.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 120,
      messages: [{ role: "user", content: prompt }],
    });

    const bio = completion.choices[0]?.message?.content?.trim() ?? "";
    return res.json({ bio });
  } catch (err) {
    return res.status(500).json({ error: "Failed to generate bio. Please write your own!" });
  }
});

export default router;
