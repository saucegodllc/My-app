import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "crypto";
import { logger } from "./logger";
import { createOpsId, nowIso, readOpsStore, writeOpsStore } from "./operationalStore";

type CaptureContext = Record<string, unknown>;

let sentryPromise: Promise<any | null> | null = null;
const sentryModuleName = "@sentry/node";

async function getSentry() {
  if (!process.env.SENTRY_DSN) return null;
  sentryPromise ??= import(sentryModuleName)
    .then((module) => {
      module.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV ?? "development",
        release: process.env.CONNECTSPHERE_RELEASE ?? process.env.SENTRY_RELEASE,
        tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0"),
      });
      return module;
    })
    .catch((err) => {
      logger.warn({ err }, "Sentry API SDK failed to initialize");
      return null;
    });
  return sentryPromise;
}

export function captureApiError(err: unknown, context: CaptureContext = {}): void {
  logger.error({ err, ...context }, "API error");
  void getSentry().then((sentry) => {
    if (!sentry) return;
    sentry.withScope((scope: any) => {
      Object.entries(context).forEach(([key, value]) => scope.setContext(key, { value }));
      sentry.captureException(err);
    });
  });
}

export function logLaunchEvent(action: string, input: { userId?: string; targetId?: string; reason?: string; ip?: string; [key: string]: unknown } = {}): void {
  const store = readOpsStore();
  store.abuseEvents.push({
    id: createOpsId(),
    action,
    userId: input.userId,
    targetId: input.targetId,
    reason: input.reason,
    ip: input.ip,
    createdAt: nowIso(),
  });
  writeOpsStore(store);
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header("x-request-id");
  const requestId = incoming && incoming.length <= 120 ? incoming : randomUUID();
  req.headers["x-request-id"] = requestId;
  res.setHeader("x-request-id", requestId);
  next();
}

export function apiErrorMiddleware(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  captureApiError(err, {
    requestId: req.headers["x-request-id"],
    method: req.method,
    path: req.path,
  });
  if (res.headersSent) return;
  res.status(500).json({
    error: "Internal server error",
    requestId: req.headers["x-request-id"],
  });
}
