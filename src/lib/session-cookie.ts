import type { Response } from 'express';

export const SESSION_COOKIE_NAME = 'session';
const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export function setSessionCookie(res: Response, token: string): void {
  const secure = process.env.NODE_ENV === 'production';
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_MS,
    path: '/',
  });
}

export function clearSessionCookie(res: Response): void {
  const secure = process.env.NODE_ENV === 'production';
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
  });
}
