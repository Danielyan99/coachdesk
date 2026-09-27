/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

const TITLE = 'Coachdesk · Client management for personal trainers';
const DESCRIPTION =
  'Weekly workout and meal plans, a daily checklist for clients, and a dashboard that shows who is on track. A React + NestJS + MongoDB portfolio project.';

/**
 * Adds Open Graph / Twitter tags for link previews (LinkedIn, WhatsApp, Slack…).
 * Scrapers need an absolute image URL, so it uses VITE_SITE_URL when set.
 */
function socialMeta(siteUrl: string | undefined): Plugin {
  const base = siteUrl?.replace(/\/$/, '') ?? '';
  const image = `${base}/og-image.png`;
  const tags = [
    ['property', 'og:type', 'website'],
    ['property', 'og:title', TITLE],
    ['property', 'og:description', DESCRIPTION],
    ['property', 'og:image', image],
    ['property', 'og:image:width', '1200'],
    ['property', 'og:image:height', '630'],
    [
      'property',
      'og:image:alt',
      'Coachdesk: a client list where each client has an on-track, at-risk or behind status',
    ],
    ...(base ? [['property', 'og:url', base]] : []),
    ['name', 'twitter:card', 'summary_large_image'],
    ['name', 'twitter:title', TITLE],
    ['name', 'twitter:description', DESCRIPTION],
    ['name', 'twitter:image', image],
  ];

  return {
    name: 'social-meta',
    transformIndexHtml: () =>
      tags.map(([attr, key, content]) => ({ tag: 'meta', attrs: { [attr]: key, content }, injectTo: 'head' as const })),
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  return {
    plugins: [react(), tailwindcss(), socialMeta(env.VITE_SITE_URL)],
    server: {
      port: 5173,
      // Same origin as production (Vercel rewrite): the auth cookie stays first-party.
      proxy: { '/api': 'http://localhost:3000' },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test-setup.ts'],
      css: false,
    },
  };
});
