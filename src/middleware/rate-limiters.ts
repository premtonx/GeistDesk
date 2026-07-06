import rateLimit from 'express-rate-limit';

const isProd = process.env.NODE_ENV === 'production';

/** Brute-force protection for credential endpoints. */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 20 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again later.' },
});

/** Protect public vault reveal/upload capability endpoints. */
export const vaultRevealRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 30 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many vault access attempts. Please try again later.' },
});

/** Limit unauthenticated webhook abuse. */
export const webhookRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isProd ? 60 : 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Webhook rate limit exceeded.' },
});

/** Sandbox / AI test harness — tighter in production when enabled. */
export const sandboxRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isProd ? 10 : 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Sandbox rate limit exceeded.' },
});
