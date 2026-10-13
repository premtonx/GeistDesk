import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { Request } from 'express';

const isProd = process.env.NODE_ENV === 'production';

/** Stable per-IP key that correctly folds IPv6 (express-rate-limit v8+). */
function ipKey(req: Request): string {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  try {
    return ipKeyGenerator(ip);
  } catch {
    return ip;
  }
}

/** Brute-force protection for credential endpoints. */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 20 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKey,
  message: { error: 'Too many authentication attempts. Please try again later.' },
});

/**
 * Phase-1 hardening: tight per-IP limit for auth + onboarding credential
 * endpoints (max 10 requests per minute per IP). In-memory per-process;
 * swap to a shared store (Redis) when scaling horizontally.
 */
export const credentialRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: ipKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again in a minute.' },
});

/** Protect public vault reveal/upload capability endpoints. */
export const vaultRevealRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 30 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKey,
  message: { error: 'Too many vault access attempts. Please try again later.' },
});

/** Limit unauthenticated webhook abuse. */
export const webhookRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isProd ? 60 : 600,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKey,
  message: { error: 'Webhook rate limit exceeded.' },
});

/** Sandbox / AI test harness — tighter in production when enabled. */
export const sandboxRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isProd ? 10 : 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: ipKey,
  message: { error: 'Sandbox rate limit exceeded.' },
});
