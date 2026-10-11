/**
 * HTTP hardening for the Express server: security headers (CSP, HSTS, ...),
 * rate limiting, and a JSON error handler that never leaks stack traces.
 */
import type { ErrorRequestHandler, RequestHandler } from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";

/** Origin of a URL, or null when it is empty / malformed. */
const originOf = (url?: string): string | null => {
  try {
    return url ? new URL(url).origin : null;
  } catch {
    return null;
  }
};

/**
 * Build the Content-Security-Policy directives. Third-party origins are the
 * minimum the app needs: Google Fonts (CSS), pdf.js on cdnjs (PDF blueprints),
 * the browser-side Gemini BYOK call, Google Analytics (only when enabled) and
 * the configured Supabase project. Everything else is blocked, which limits the
 * blast radius of any XSS (e.g. theft of the BYOK key held in sessionStorage).
 */
export function buildCspDirectives(env: NodeJS.ProcessEnv = process.env) {
  const supabase = originOf(env.VITE_SUPABASE_URL || env.SUPABASE_URL);
  const supabaseWs = supabase ? supabase.replace(/^http/, "ws") : null;
  const analytics = Boolean(env.VITE_GA_MEASUREMENT_ID);

  return {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "https://cdnjs.cloudflare.com", ...(analytics ? ["https://www.googletagmanager.com"] : [])],
    // Inline styles are required by three.js overlays / motion; scripts stay strict.
    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
    imgSrc: ["'self'", "data:", "blob:", ...(supabase ? [supabase] : [])],
    connectSrc: [
      "'self'",
      "https://generativelanguage.googleapis.com",
      "https://cdnjs.cloudflare.com",
      ...(supabase ? [supabase, supabaseWs as string] : []),
      ...(analytics
        ? ["https://www.google-analytics.com", "https://*.google-analytics.com", "https://*.analytics.google.com", "https://www.googletagmanager.com"]
        : []),
    ],
    workerSrc: ["'self'", "blob:", "https://cdnjs.cloudflare.com"],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
  };
}

/**
 * Security headers. The CSP is only enforced in production: the Vite dev server
 * injects inline scripts for HMR that a strict policy would block. Set
 * CSP_REPORT_ONLY=true to roll a policy change out without enforcing it.
 */
export function securityHeaders(env: NodeJS.ProcessEnv = process.env): RequestHandler {
  const production = env.NODE_ENV === "production";
  return helmet({
    contentSecurityPolicy: production
      ? { useDefaults: false, reportOnly: env.CSP_REPORT_ONLY === "true", directives: buildCspDirectives(env) }
      : false,
    // Plain-http localhost production runs must not be force-upgraded.
    strictTransportSecurity: production ? { maxAge: 15552000, includeSubDomains: true } : false,
  });
}

const tooMany = { error: "Too many requests. Please slow down and retry shortly." };

/** Baseline limiter for every /api route (per client IP). */
export const apiRateLimiter = (max = 120): RequestHandler =>
  rateLimit({ windowMs: 60_000, limit: max, standardHeaders: "draft-7", legacyHeaders: false, message: tooMany });

/** Tighter limiter for the expensive, paid-upstream AI routes. */
export const aiRateLimiter = (max = 10): RequestHandler =>
  rateLimit({ windowMs: 60_000, limit: max, standardHeaders: "draft-7", legacyHeaders: false, message: tooMany });

/** Final error handler: JSON, correct status for body-parser errors, no stack leaks. */
export const jsonErrorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) return next(err);
  const status = Number(err?.status || err?.statusCode) || 500;
  if (status === 413) return res.status(413).json({ error: "Request body too large." });
  if (status === 400) return res.status(400).json({ error: "Malformed request body." });
  console.error("Unhandled server error:", err?.message || err);
  return res.status(500).json({ error: "Internal server error." });
};
