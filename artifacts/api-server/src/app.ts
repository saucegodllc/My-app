import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { clerkMiddleware } from "@clerk/express";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { apiErrorMiddleware, requestIdMiddleware } from "./lib/monitoring";
import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";

const app: Express = express();

process.env.CLERK_PUBLISHABLE_KEY ??= "pk_test_a2V5LWNoYW1vaXMtNzkuY2xlcmsuYWNjb3VudHMuZGV2JA";
process.env.CLERK_SECRET_KEY ??= "sk_test_connectsphere_local";

// ── Security headers (helmet-equivalent, no extra dependency) ─────────────────
// Removes the "X-Powered-By: Express" fingerprint
app.disable("x-powered-by");
app.use((_req: Request, res: Response, next: NextFunction) => {
  // Prevent MIME-type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");
  // Deny framing (clickjacking protection)
  res.setHeader("X-Frame-Options", "DENY");
  // Legacy XSS filter — still respected by some older browsers
  res.setHeader("X-XSS-Protection", "1; mode=block");
  // Enforce HTTPS for 1 year once the browser has seen it
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  // Only send origin in referer, no full URL
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  // Restrict browser features we never use
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return next();
});

app.use(requestIdMiddleware);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

// CORS: allow origins listed in ALLOWED_ORIGINS env var (comma-separated).
// Falls back to reflecting the request origin so the mobile app always works in dev.
// In production, set ALLOWED_ORIGINS=https://connectsphere.app,https://admin.connectsphere.app
const rawAllowedOrigins = process.env.ALLOWED_ORIGINS;
const allowedOrigins: string[] = rawAllowedOrigins ? rawAllowedOrigins.split(",").map((o) => o.trim()) : [];
app.use(cors({
  credentials: true,
  origin: allowedOrigins.length > 0
    ? (origin, callback) => {
        // Allow server-to-server calls with no origin (e.g. health checks)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error(`CORS policy: origin '${origin}' not allowed`));
      }
    : true, // dev fallback: reflect any origin
}));
app.use(cookieParser());
app.use(clerkMiddleware());

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);
app.use(apiErrorMiddleware);

export default app;
