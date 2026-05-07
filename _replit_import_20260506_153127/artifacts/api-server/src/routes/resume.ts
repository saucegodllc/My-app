import { Router } from "express";
import OpenAI from "openai";

const router = Router();

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? "placeholder",
});

router.post("/resume/detect", async (req, res) => {
  try {
    const { base64, mimeType, fileName } = req.body as {
      base64?: string;
      mimeType?: string;
      fileName?: string;
    };

    if (!base64 || !mimeType) {
      res.status(400).json({ error: "Missing base64 or mimeType" });
      return;
    }

    // PDFs get a pass without vision — we trust the file type
    if (mimeType === "application/pdf") {
      const looksLikeResume =
        /resume|cv|curriculum|vitae/i.test(fileName ?? "");
      res.json({
        isResume: true,
        confidence: looksLikeResume ? "high" : "medium",
        message: looksLikeResume
          ? "PDF resume detected — looks great!"
          : "PDF uploaded. We'll treat this as your resume.",
      });
      return;
    }

    // For images, use GPT vision
    const supportedImageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!supportedImageTypes.includes(mimeType)) {
      res.status(400).json({ error: "Unsupported file type. Please upload a JPG, PNG, WEBP, or PDF." });
      return;
    }

    const dataUrl = `data:${mimeType};base64,${base64}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_completion_tokens: 200,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: dataUrl, detail: "low" },
            },
            {
              type: "text",
              text: `Look at this image and determine if it is a professional resume or CV document.

A resume typically contains: name and contact info, work experience, education, skills, and professional formatting.

Respond in this exact JSON format:
{
  "isResume": true or false,
  "confidence": "high", "medium", or "low",
  "message": "a short friendly message (max 15 words) explaining what you see"
}

If it's NOT a resume (e.g. a selfie, meme, screenshot, random photo), set isResume to false and explain what it appears to be.`,
            },
          ],
        },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "";

    // Parse JSON from the response (handle markdown code blocks)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      res.status(500).json({ error: "AI response could not be parsed." });
      return;
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      isResume: boolean;
      confidence: string;
      message: string;
    };

    res.json({
      isResume: Boolean(parsed.isResume),
      confidence: parsed.confidence ?? "medium",
      message: parsed.message ?? (parsed.isResume ? "Resume detected!" : "This doesn't look like a resume."),
    });
  } catch (err) {
    console.error("Resume detect error:", err);
    res.status(500).json({ error: "Failed to analyze file. Please try again." });
  }
});

export default router;
