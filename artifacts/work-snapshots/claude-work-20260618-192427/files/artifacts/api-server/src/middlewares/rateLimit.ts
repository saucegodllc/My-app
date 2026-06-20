import type { NextFunction, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { logLaunchEvent } from "../lib/monitoring";

type RateLimitOptions = {
  key: string;
  windowMs: number;
  max: number;
};

const buckets = new Map<string, { count: number; resetAt: number }>();

function clientKey(req: Request, key: string): string {
  const { userId } = getAuth(req);
  return `${key}:${userId ?? req.ip ?? "anonymous"}`;
}

export function rateLimit(options: RateLimitOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const bucketKey = clientKey(req, options.key);
    const bucket = buckets.get(bucketKey);
    const current = !bucket || bucket.resetAt <= now ? { count: 0, resetAt: now + options.windowMs } : bucket;
    current.count += 1;
    buckets.set(bucketKey, current);

    res.setHeader("x-ratelimit-limit", String(options.max));
    res.setHeader("x-ratelimit-remaining", String(Math.max(0, options.max - current.count)));
    res.setHeader("x-ratelimit-reset", new Date(current.resetAt).toISOString());

    if (current.count > options.max) {
      logLaunchEvent("rate_limit_exceeded", {
        userId: getAuth(req).userId ?? undefined,
        ip: req.ip,
        reason: options.key,
      });
      return res.status(429).json({ error: "Too many requests. Please try again shortly." });
    }

    return next();
  };
}
