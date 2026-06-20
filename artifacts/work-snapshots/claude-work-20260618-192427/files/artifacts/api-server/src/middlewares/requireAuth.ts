import { getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";

declare global {
  namespace Express {
    interface Request {
      auth?: { userId: string | null };
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  req.auth = { userId };
  return next();
}
