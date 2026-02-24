/**
 * server.js — Production Express Server
 *
 * Architecture:
 *  - Express handles static assets, security headers, and rate limiting
 *  - React Router v7 request handler processes ALL dynamic routes:
 *      /auth/*           — Shopify OAuth (handled by shopify-app-react-router)
 *      /webhooks/*       — Shopify webhooks (HMAC verified server-side)
 *      /app/*            — Embedded app UI (loaders/actions are server-side)
 *  - Admin API calls happen exclusively inside React Router loaders/actions
 *  - Access tokens are never sent to the browser
 *
 * Deploy: Render Web Service → Start Command: node server.js
 */

import express            from "express";
import { createRequestHandler } from "@react-router/express";
import helmet             from "helmet";
import compression        from "compression";
import rateLimit          from "express-rate-limit";
import path               from "path";
import { fileURLToPath }  from "url";

const __dirname   = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIR  = path.join(__dirname, "build", "client");
const BUILD_PATH  = path.join(__dirname, "build", "server", "index.js");

// ─── Boot guard ───────────────────────────────────────────────────────────────
const REQUIRED_ENV = [
  "SHOPIFY_API_KEY",
  "SHOPIFY_API_SECRET",
  "SHOPIFY_APP_URL",
  "DATABASE_URL",
  "SESSION_SECRET",
];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length) {
  console.error("❌ Missing required environment variables:", missing.join(", "));
  process.exit(1);
}

// ─── App ──────────────────────────────────────────────────────────────────────
const app = express();

// Trust Render's load-balancer proxy so req.ip is correct for rate limiting
app.set("trust proxy", 1);

// ─── Compression ──────────────────────────────────────────────────────────────
app.use(compression());

// ─── Security headers ─────────────────────────────────────────────────────────
// NOTE: CSP and frameguard must be OFF for Shopify embedded apps.
// Shopify injects its own CSP via response headers in the SDK.
app.use(
  helmet({
    contentSecurityPolicy:    false, // Shopify App Bridge controls this
    crossOriginEmbedderPolicy: false, // Required for Shopify Admin iframe
    frameguard:                false, // App is embedded in an iframe
  })
);

// ─── Global rate limiter (abuse protection) ───────────────────────────────────
// Webhooks are excluded — Shopify must not be rate-limited.
const globalLimiter = rateLimit({
  windowMs:         60_000,          // 1 minute
  max:              300,             // 300 req/min per IP
  standardHeaders:  true,
  legacyHeaders:    false,
  skip: (req) => req.path.startsWith("/webhooks/"),
  message: { error: "Too many requests. Please slow down." },
});
app.use(globalLimiter);

// ─── Stricter limiter for auth routes (prevent OAuth flooding) ────────────────
const authLimiter = rateLimit({
  windowMs: 60_000,
  max:      30,
  standardHeaders: true,
  legacyHeaders:   false,
});
app.use("/auth", authLimiter);

// ─── Static assets — immutable hashed files (1-year cache) ───────────────────
app.use(
  "/assets",
  express.static(path.join(CLIENT_DIR, "assets"), {
    immutable: true,
    maxAge:    "1y",
  })
);

// ─── Other public files (favicon, etc.) — short cache ────────────────────────
app.use(express.static(CLIENT_DIR, { maxAge: "1h" }));

// ─── Health check (Render uses this to verify the service is up) ──────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// ─── React Router v7 request handler ─────────────────────────────────────────
// This is the single entry point for all SSR routes.
// Loaders and actions run SERVER-SIDE — the browser never receives tokens.
const build = await import(BUILD_PATH);

app.all(
  "*",
  createRequestHandler({
    build,
    // Optionally pass Express req/res into React Router context
    getLoadContext(req, res) {
      return { expressReq: req, expressRes: res };
    },
  })
);

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT ?? "3000", 10);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`   NODE_ENV  : ${process.env.NODE_ENV}`);
  console.log(`   APP URL   : ${process.env.SHOPIFY_APP_URL}`);
});
