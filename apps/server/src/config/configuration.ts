export interface AppConfig {
  port: number;
  mongoUri: string;
  jwtSecret: string;
  /** Public URL of the web app, e.g. https://coachdesk.vercel.app. Used for invite links. */
  webOrigin: string;
  /** Send the session cookie only over HTTPS. On whenever the web app is served over HTTPS. */
  secureCookies: boolean;
  /** How many proxies sit in front of the server (Render load balancer, Vercel rewrite). Needed for real client IPs. */
  trustProxyHops: number;
  /** Requests per minute per IP for normal API routes. */
  rateLimitPerMinute: number;
  /** Requests per minute per IP for login, signup and other auth routes. */
  authRateLimitPerMinute: number;
}

function int(value: string | undefined, fallback: number, min: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < min) throw new Error(`Config value ${value} is below the minimum of ${min}`);
  return parsed;
}

function required(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key]?.trim();
  if (!value)
    throw new Error(`${key} is not set. Copy apps/server/.env.example to apps/server/.env for local development.`);
  return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  // Browsers send the origin without a trailing slash; forgive one pasted from the address bar.
  const webOrigin = (env.WEB_ORIGIN?.trim() || 'http://localhost:5173').replace(/\/+$/, '');
  const jwtSecret = required(env, 'JWT_SECRET');
  if (jwtSecret.length < 32 && webOrigin.startsWith('https://')) {
    throw new Error('JWT_SECRET must be at least 32 characters in production');
  }
  return {
    port: int(env.PORT, 3000, 1),
    mongoUri: required(env, 'MONGO_URI'),
    jwtSecret,
    webOrigin,
    secureCookies: webOrigin.startsWith('https://'),
    trustProxyHops: int(env.TRUST_PROXY_HOPS, 1, 0),
    rateLimitPerMinute: int(env.RATE_LIMIT_PER_MINUTE, 120, 1),
    authRateLimitPerMinute: int(env.AUTH_RATE_LIMIT_PER_MINUTE, 10, 1),
  };
}

export const APP_CONFIG = Symbol('APP_CONFIG');
