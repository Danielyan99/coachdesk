import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { AppConfig } from './config/configuration';

/** Shared by main.ts and the e2e tests, so tests run the same HTTP setup as production. */
export function configureApp(app: INestApplication, config: AppConfig) {
  // Every route lives under /api: the web app proxies /api/* to this server (Vite locally, Vercel in production).
  // No CORS setup on purpose: the browser never calls this server from another origin.
  app.setGlobalPrefix('api');
  app.use(helmet());
  app.use(cookieParser());
  // Behind Render's load balancer (and the Vercel rewrite): trust them so rate limits see the real client IP.
  (app as NestExpressApplication).set('trust proxy', config.trustProxyHops);
}
