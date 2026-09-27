import type { CookieOptions, Response } from 'express';

export const SESSION_COOKIE = 'cd_session';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function options(secure: boolean): CookieOptions {
  // httpOnly: page scripts can't read it, so an XSS bug can't steal it. SameSite=Lax is enough because
  // the browser only talks to its own origin (/api is proxied). Path=/api: never sent with page requests.
  return { httpOnly: true, secure, sameSite: 'lax', path: '/api' };
}

export function setSessionCookie(res: Response, token: string, secure: boolean, maxAgeMs = SESSION_TTL_MS) {
  res.cookie(SESSION_COOKIE, token, { ...options(secure), maxAge: maxAgeMs });
}

export function clearSessionCookie(res: Response, secure: boolean) {
  res.clearCookie(SESSION_COOKIE, options(secure));
}
