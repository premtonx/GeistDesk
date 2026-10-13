import type { Request } from 'express';

/**
 * Detect browser / CDN speculative loads that must never trigger burn-on-read.
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Sec-Purpose
 */
export function isPreviewOrPrefetchRequest(
  req: Pick<Request, 'method' | 'get'>,
): boolean {
  if (req.method === 'HEAD') {
    return true;
  }

  const purpose = (
    req.get('Purpose') ||
    req.get('Sec-Purpose') ||
    req.get('X-Purpose') ||
    ''
  ).toLowerCase();

  return (
    purpose === 'prefetch' ||
    purpose === 'preview' ||
    purpose.includes('prefetch') ||
    purpose.includes('preview')
  );
}

/** Explicit user-initiated reveal from the GeistExchange viewer SPA. */
export function isVaultReadCommit(req: Pick<Request, 'get'>): boolean {
  return req.get('X-GeistDesk-Read-Intent') === 'commit';
}
