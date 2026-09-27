# Coachdesk

Client management for personal trainers: weekly workout + meal plans, client check-offs, and an "on track" dashboard.
Portfolio project. Keep it small, clean and finished. The full plan is in `docs/BUILD_PLAN.md`.

## Layout (npm workspaces)

- `packages/shared` — types and **zod schemas**. One source of truth: the web forms (react-hook-form + zod) and the
  server `ZodValidationPipe` use the same schemas. Built to CJS + ESM (`npm run build:shared`).
- `apps/server` — NestJS 11 + Mongoose 8. Every route is under `/api` (see `configure-app.ts`). Jest tests;
  API tests use `mongodb-memory-server` + `supertest`.
- `apps/web` — React 19 + Vite + Tailwind v4 + React Router 7 + TanStack Query. Vitest + Testing Library.

## Commands

- `npm run dev` — server (:3000) and web (:5173). Vite proxies `/api` to the server.
- `npm test`, `npm run build`, `npm run format`
- Local Mongo: `docker compose up -d`, then copy `apps/server/.env.example` to `apps/server/.env`.

## Rules

- Auth: JWT in an httpOnly cookie. The browser only talks to its own origin (`/api` is proxied by Vite locally and by
  the Vercel rewrite in production). Never store tokens in localStorage.
- Every trainer query is scoped by `trainerId` from the JWT, never from the request body. Another trainer's data
  returns **404**, not 403.
- Assigning a template **copies** it into a client plan. Editing a plan never changes the template.
- "Today" is computed on the server in the client's timezone.
- Demo data has `expiresAt` + a TTL index (24h).
- Write a short "why" in `docs/decisions.md` for each backend decision.
- Everything must stay free (no paid services or APIs).
- Commit messages: no double quotes, no arrow characters.
