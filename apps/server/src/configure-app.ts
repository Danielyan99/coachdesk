import type { INestApplication } from '@nestjs/common';

/** Shared by main.ts and the e2e tests, so tests run the same HTTP setup as production. */
export function configureApp(app: INestApplication) {
  // Every route lives under /api: the web app proxies /api/* to this server (Vite locally, Vercel in production).
  app.setGlobalPrefix('api');
}
