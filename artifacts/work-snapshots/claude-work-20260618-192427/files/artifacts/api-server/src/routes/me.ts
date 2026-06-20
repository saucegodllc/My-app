import { getAuth } from "@clerk/express";
import { Router } from "express";
import { shouldUseLocalDbFallback } from "../launchGuards";

const router = Router();

router.get("/me/session-state", (req, res) => {
  const { userId, sessionId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({
      ok: false,
      error: "Unauthorized",
      state: "unauthenticated",
      userId: null,
      sessionId: null,
      environment: process.env.NODE_ENV ?? "development",
    });
  }

  return res.json({
    ok: true,
    state: "active",
    userId,
    sessionId,
    environment: process.env.NODE_ENV ?? "development",
    localDbFallbackEnabled: shouldUseLocalDbFallback(),
  });
});

export default router;
