import type { NextFunction, Request, Response } from 'express';
import crypto from 'node:crypto';
import { safeLog } from '../lib/safe-log.js';

/**
 * Assigns a correlation id to every request, echoes it as `X-Request-Id`, and
 * logs a structured completion line (method, path, status, duration) through
 * the secret-redacting `safeLog` helper.
 *
 * Registered first in server.ts so every downstream middleware/route can read
 * `req.id` and include it in its own logs.
 */

export interface RequestWithId extends Request {
  id: string;
  requestId: string;
}

export function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const id = crypto.randomUUID();
  (req as RequestWithId).id = id;
  (req as RequestWithId).requestId = id;
  res.setHeader('X-Request-Id', id);

  const startedAt = process.hrtime.bigint();
  const method = req.method;
  const path = req.originalUrl || req.url;

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    safeLog('info', `[http] ${id}`, `${method} ${path} -> ${res.statusCode} ${durationMs.toFixed(1)}ms`);
  });

  next();
}
