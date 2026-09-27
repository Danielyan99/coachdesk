# Build Plan: Trainer Client-Management App (portfolio project)

## Context

Narek splits the work into two tracks. The **startup idea** is discussed in a separate chat. **This project is portfolio-only**: a real, deployed, full-stack app that shows React + NestJS + MongoDB skills and the Claude Code workflow. It gets linked from his CV, LinkedIn, and portfolio site.

The goal is **small, clean, and finished**, not big. A recruiter opens the link, clicks "Try demo", and understands the app in under a minute.

This plan is self-contained. Narek will run it in a **new chat** in `C:\Users\User\OneDrive\Desktop\portfolio\trainer-management` (currently empty except `docs/trainer-interviews.md`).

**How to start the new chat:** "Build the app following docs/BUILD_PLAN.md. Work phase by phase and report after each phase."

## Working rules for the build chat

- Narek is the manager (English level B1-B2). Send short, simple reports after each phase: what you did and why. Do commits, pushes, and deploy checks yourself.
- **Backend is a refresher for Narek**, so write a short "why" for each backend decision in `docs/decisions.md` (5-10 lines each).
- Everything must be free (no paid services or APIs). Never ask Narek to paste keys into chat. He sets secrets in dashboards himself.
- Commit messages via PowerShell: no double quotes, no arrow characters.
- **Ask Narek first** about: the product name, anything that costs money, deleting data, or force-push.
- Working name: **"Coachdesk"**. Confirm with Narek in Phase 0 before creating the GitHub repo.

## Stack and conventions (copy from sibling projects)

Use the same monorepo pattern as `portfolio/live-sports-scoreboard` and `portfolio/bank-expense`:

- npm workspaces: `apps/server` (NestJS 11 + Mongoose 8, Jest), `apps/web` (React 19 + Vite + Tailwind v4 + React Router 7, Vitest + Testing Library), `packages/shared` (types and schemas, CJS+ESM build like `live-sports-scoreboard/packages/shared`).
- Root scripts: `build:shared`, `dev` (concurrently), `build`, `test`, `format`. Copy the root `package.json`, `tsconfig.base.json`, `.prettierrc`, and `docker-compose.yml` (local Mongo) as templates.
- `.github/workflows/ci.yml` is the same as `bank-expense/.github/workflows/ci.yml` (npm ci, test, build on Node 22).
- `render.yaml` is like `bank-expense/render.yaml` (free web service, `/health`). The web app goes on Vercel with `apps/web/vercel.json`.
- `.claude/launch.json` for the preview server, like the siblings.
- Extra libraries: **TanStack Query** (server state), **react-hook-form** + **zod** (forms), **zod** schemas in `packages/shared` used by BOTH the web forms and a server `ZodValidationPipe` (one source of truth), `@nestjs/throttler`, `helmet`, `cookie-parser`, `@node-rs/argon2` (password hashing, prebuilt, no compiling), `mongodb-memory-server` + `supertest` for API tests.
- Add a `CLAUDE.md` in the repo with these conventions.

## Key design decisions

1. **Auth: JWT in an httpOnly cookie, same-origin through a Vercel rewrite.** `apps/web/vercel.json` rewrites `/api/*` to the Render API. The browser sees one origin, so cookies are first-party (no SameSite=None, no Safari third-party cookie problems) and tokens are never in localStorage. Local dev uses the Vite proxy for `/api`.
2. **Two roles: `trainer` and `client`.** The client gets a real login through an **invite link**. The trainer creates a client, clicks "Invite", and copies a one-time link (sends it on WhatsApp, so no email service is needed). The client opens `/invite/:token` and sets a password. Store the token **hashed**, with a 7-day expiry and single use.
3. **Data isolation.** Every trainer query is scoped by `trainerId` from the JWT, never from the request body. Clients can only read their own plan and check-ins. Write tests that prove trainer A can't read trainer B's data (404, not 403, to avoid leaking IDs).
4. **Templates are copied into a client plan (snapshot).** Assigning a template creates a `ClientPlan` copy. Editing one client's plan never changes the template or other clients.
5. **Weekly schedule.** A template or plan has 7 days (Mon-Sun). Each day has an optional workout (exercises) and a meal list. "Today" = the plan day for today's weekday in the **client's timezone** (stored on the client, IANA name, default from the trainer's browser). The server computes the date, not the browser.
6. **Adherence status (the "on track" rule).** Last 7 days (only days since plan start): done items / scheduled items. **≥ 80% on track (green), 50-79% at risk (amber), < 50% behind (red).** No plan or nothing scheduled shows "No plan" (grey). Write it as a pure function with unit tests.
7. **Demo = private sandbox per visitor.** "Try as trainer" / "Try as client" buttons call `POST /api/auth/demo`. That creates a fresh copy of the seed data (1 trainer, 6-8 clients with varied adherence, 3 templates, 2-3 weeks of check-in history) and logs the visitor in. All demo documents get an `expiresAt` field with a **MongoDB TTL index (24h)**, so they auto-delete. Visitors never see each other's changes and no nightly reset job is needed. Rate-limit demo creation (throttler).
8. **Flat pricing, shown and lightly enforced.** Tiers: Starter up to 10 clients $9, Pro up to 30 $19, Unlimited $29 (all per month, flat). The trainer has a `tier` field. The dashboard shows "7 of 30 clients". Creating a client over the limit returns a friendly error with a link to pricing. On the pricing page, "Switch plan" changes the tier instantly with a clear "Demo, no payment" label. No Stripe.

## Data model (Mongoose)

- **User**: `email` (unique, lowercased), `passwordHash`, `role` (trainer or client), `name`, `trainerId` (clients only), `clientId` (clients only), `tier` (trainers only), `expiresAt?` (demo).
- **Client**: `trainerId` (indexed), `name`, `goals`, `stats` {weightKg, heightCm, bodyFatPct?}, `notes` (restrictions/injuries), `timezone`, `userId?` (after invite accepted), `inviteTokenHash?`, `inviteExpiresAt?`, `archived`, `expiresAt?`.
- **Template**: `trainerId`, `name`, `description`, `days[7]`: { `workout?`: {title, exercises[{id, name, sets, reps, restSec?, notes?}]}, `meals`[{id, name, time?, description, kcal?}] }, `expiresAt?`.
- **ClientPlan**: `trainerId`, `clientId` (one active plan per client), `sourceTemplateId?`, `name`, `startDate`, `days[7]` (copied), `active`, `expiresAt?`.
- **CheckIn**: `clientId`, `planId`, `date` ("YYYY-MM-DD"), `itemId`, `itemType` (exercise or meal), `completedAt`, `expiresAt?`. **Unique index (clientId, date, itemId)**, so a check-off is idempotent (PUT to check, DELETE to uncheck).

## API (all under `/api`)

- `GET /health`
- Auth: `POST /auth/signup` (trainer), `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/demo` {role}, `GET /auth/invite/:token` (who invited you), `POST /auth/invite/:token/accept` {email, password} (the client picks the email they log in with)
- Trainer: `GET/POST /clients`, `GET/PATCH/DELETE /clients/:id` (archive), `POST /clients/:id/invite`, `GET /clients/:id/adherence`
- Trainer: `GET/POST /templates`, `GET/PATCH/DELETE /templates/:id`, `POST /templates/:id/assign` {clientId, startDate}
- Trainer: `GET/PUT /clients/:id/plan` (edit the client's own copy)
- Trainer: `GET /dashboard` (clients + status + last activity, one aggregated call)
- Trainer: `PATCH /me/tier`
- Client: `GET /me/today`, `GET /me/week`, `PUT /me/checkins/:date/:itemId`, `DELETE /me/checkins/:date/:itemId` (date must be today or yesterday, no editing old history)

## Pages (web)

- `/` landing: hero, 3 features, screenshot, two big "Try demo" buttons.
- `/pricing`: 3 flat tiers ("no per-client fees").
- `/login`, `/signup`, `/invite/:token`
- Trainer (`/app`): **Dashboard** (client list, status chips, filter by status, "7 of 30 clients"), **Client detail** (profile, stats, notes, current plan editor, adherence last 7 days, invite link), **Templates** (list and editor: 7 day tabs, exercises and meals), **Assign template** dialog.
- Client (`/me`): **Today** (big checkboxes, workout then meals, progress ring "4 of 6 done", optimistic updates), **Week** (7-day overview with done marks). Mobile-first: tap targets ≥ 44px, one column, no clutter. Must be understandable in under a minute.
- Shared: loading skeletons, empty states, error states. A **"Waking up the server…" screen** when the first API call is slow (Render free tier sleeps, first load can take 30-50 s), like the siblings do. Dark mode optional.

## Phases (commit and short report after each)

0. **Setup**: confirm the name with Narek. `git init`, monorepo skeleton, CI, prettier, CLAUDE.md, `docs/decisions.md`. Delete `docs/trainer-interviews.md` (it belonged to the startup track). Create a **public** GitHub repo with `gh` and push.
1. **Server foundation**: config, Mongo connection, `/health`, helmet, throttler, shared zod pipe, User model, auth (signup/login/logout/me), JWT cookie guard, role guard. Tests: auth e2e with mongodb-memory-server.
2. **Clients**: CRUD scoped by trainer, invite create/accept, tier limit. Tests: isolation between two trainers, invite expiry and single use.
3. **Templates and plans**: template CRUD, assign (snapshot copy), plan edit. Tests: editing the plan doesn't change the template.
4. **Client side and adherence**: today/week endpoints with timezone logic, check-ins, adherence pure function and dashboard endpoint. Unit tests for adherence and "today in timezone" (include a timezone edge case).
5. **Web: trainer app**: layout, auth pages, dashboard, client detail, template editor, assign dialog. Vitest tests for key components.
6. **Web: client app**: Today and Week pages, optimistic check-offs. Test: checking an item updates progress.
7. **Demo, landing, pricing**: seed data builder (one function used by both the demo sandbox and a `npm run seed` script), TTL indexes, demo endpoint, landing and pricing pages.
8. **Polish**: responsive check at 375px and desktop, keyboard and focus states, wake-up screen, README (like `live-sports-scoreboard/README.md`: live link, highlights table, mermaid architecture diagram, decisions, "Built with Claude Code" section, run locally), screenshots and an OG image.
9. **Deploy**: Narek creates the free MongoDB Atlas M0 cluster and the Render and Vercel accounts/projects, and sets the env vars `MONGO_URI`, `JWT_SECRET`, `WEB_ORIGIN` in the dashboards. Give him exact short steps and explain why he has to do it (logins and secrets). Claude does everything else and checks the live site.

## Verification

- `npm test` and `npm run build` pass locally and in GitHub Actions CI.
- Manual end-to-end in the browser preview (local): sign up as a trainer, create a client, build a template, assign it, invite, open the invite link in a second tab, set a password, check off items on Today, and see the dashboard status change.
- Demo: "Try as trainer" and "Try as client" each give a filled app. Two demo sessions don't see each other's edits.
- Security checks: trainer B gets 404 on trainer A's client. A client can't call trainer endpoints (403). Login is rate-limited.
- Mobile: Today page at 375px width has no horizontal scroll and big tap targets.
- Live: the deployed Vercel URL works end-to-end, `/api/health` works through the rewrite, and the README links are correct.
- After deploy, **ask Narek** before adding the project to the cv-website or the CV PDFs (approved CV text must not change without his OK).

## Done in THIS chat before handoff (after approval)

- Copy this plan into the project as `docs/BUILD_PLAN.md`.
- Update the memory note `trainer-app-goal.md`: the trainer app is **portfolio-only**, and the startup is a separate track discussed in another chat.
- Keep the startup research (education centers / IE tax helper short list) as a separate memory note so the startup conversation can continue.
