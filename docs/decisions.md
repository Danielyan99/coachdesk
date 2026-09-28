# Decisions

Short notes on why the backend is built the way it is. One entry per decision.

## 1. Monorepo with a shared package

npm workspaces with `apps/server`, `apps/web` and `packages/shared`. The shared package holds the zod schemas and types.
The web form and the server validate with the **same schema**, so the two sides can never disagree about what a valid
client or plan looks like. The shared package is built to CommonJS (for NestJS) and ESM (for Vite).
This is the same pattern as my other portfolio projects, so the setup is familiar and proven.

## 2. All routes under `/api`, and one origin for the browser

The server uses `setGlobalPrefix('api')`. The web app never calls the API on another domain: locally Vite proxies
`/api` to `localhost:3000`, and in production `vercel.json` rewrites `/api/*` to the Render server.
Why: the login cookie is then **first-party**. Cross-site cookies need `SameSite=None` and are blocked by Safari and
more and more by Chrome. With one origin there is also no CORS setup to get wrong.
Cost: every API call goes through the Vercel edge first, which adds a few milliseconds. That is fine for this app.

## 3. Login: JWT in an httpOnly cookie

After signup or login the server sets a cookie `cd_session` with a signed JWT (7 days). The cookie is `httpOnly`
(JavaScript on the page can't read it, so an XSS bug can't steal it), `SameSite=Lax` and `Path=/api`.
The alternative, a token in localStorage sent as a Bearer header, is readable by any script on the page.
The JWT only holds the user id. The guard **loads the user from MongoDB on every request**: one small indexed query,
but a tier change applies at once, and a deleted or expired demo account is logged out even with a valid token.

## 4. Default deny: global guards

Three global guards run in order: rate limit, then `AuthGuard` (who are you?), then `RolesGuard` (may you do this?).
Every route needs a login unless it is marked `@Public()`. A forgotten decorator then means "locked", not "open".
`@Roles('trainer')` on a controller keeps clients out of trainer routes (403).

## 5. Passwords: argon2

`@node-rs/argon2` is the current recommended password hash (memory-hard, slow for attackers on GPUs) and ships
prebuilt binaries, so there is nothing to compile on Windows or Render. Login gives the same message for a wrong
password and an unknown email, and runs one hash check even when the email doesn't exist, so neither the message
nor the response time tells an attacker which emails have an account.

## 6. Validation: zod schemas from the shared package

Instead of NestJS `class-validator` DTOs, a small `ZodValidationPipe` validates with the zod schema from
`@coachdesk/shared`. The web form uses the same schema, so the rules can't drift apart. The pipe returns the parsed
value (trimmed, lowercased email) and a 400 with `fieldErrors` keyed by dotted path (`days.2.meals.0.name`), so the
form can show each message under the right field.

## 7. Rate limits

Two `@nestjs/throttler` limits per IP: a loose one for every route (120/min) and a strict one (10/min) only for routes
marked `@AuthRateLimit()` (login, signup, later demo and invite). This slows down password guessing and demo spam.
Behind proxies the server must trust the `X-Forwarded-For` header to see the real IP (`TRUST_PROXY_HOPS`, default 1).
**Checked at deploy:** with the default of 1, the server saw an internal Render address, so every visitor shared one
limit. A request through Vercel passes 4 proxies (Vercel, Cloudflare, two Render hops), so production uses
`TRUST_PROXY_HOPS=4`. Vercel overwrites `X-Forwarded-For`, so visitors can't fake their IP through the website; someone
calling Render directly could, which is why demo creation also has a **global** cap (300 per hour, any IP).

## 8. Tests on a real (in-memory) MongoDB

API tests start the real Nest app with `mongodb-memory-server` and call it with `supertest`, so guards, pipes,
cookies and indexes are all tested together. One MongoDB starts per test run (Jest global setup) and each test file
gets its own empty database. No mocks of Mongoose, which would test the mock instead of the queries.

## 9. 404, not 403, for another trainer's data

Every client query filters on `trainerId` from the logged-in user (`findOne({ _id, trainerId })`), never on a
`trainerId` from the request body. If trainer B asks for trainer A's client, the answer is **404 Not Found**, the
same as for an id that doesn't exist. A 403 would confirm "this id exists, it's just not yours". A malformed id
is also a 404 (`ParseObjectIdPipe`). Tests check GET, PATCH, DELETE and invite from a second trainer.

## 10. Invite links

The trainer clicks "Invite" and gets a link with a random 256-bit token to send on WhatsApp (no email service).
Only the **SHA-256 hash** of the token is stored, so a database leak doesn't leak working links. (A slow hash like
argon2 is only needed for low-entropy secrets like passwords; a 256-bit random token can't be guessed.)
The link is valid for 7 days and works **once**: accepting claims it with a conditional update
(`userId` must still be empty), so two tabs opening the same link can't create two logins. A new invite replaces
the old link. The client picks their own email on the invite page, so they can log in again later.
If that email is taken, the link stays valid and they can try another one.

## 11. Archive instead of delete

`DELETE /clients/:id` sets `archived: true`. The client leaves the list and stops counting toward the tier limit,
but their plan and check-in history stay. A real product would regret a hard delete the first time a trainer
clicks the wrong button.

## 12. Tier limits, lightly enforced

Creating a client counts the active clients and returns a 403 with `code: CLIENT_LIMIT` when the tier is full, so
the web app can show "Switch plan" instead of a generic error. Two requests at the exact same moment could both
pass; a strict check would need a transaction or a counter document, which is too much for a demo of pricing.
Switching plans is instant and free. Switching down is refused while the trainer has more active clients than the
smaller plan allows.

## 13. Assigning a template makes a copy (snapshot)

`POST /templates/:id/assign` copies the template's 7 days into a new `ClientPlan` document for that client.
The trainer can then adjust one client's plan (swap squats for lunges because of a knee injury) without touching
the template or the other clients who got the same template. Editing or deleting the template later also leaves
existing plans alone. The alternative, plans that point to a shared template, would change every client's week
the moment the trainer edits the template, which is surprising and can't be undone.
Cost: some duplicated data. A week plan is a few KB, so this is fine.

## 14. One active plan per client, old plans kept

A **partial unique index** (`clientId` unique where `active: true`) lets MongoDB itself guarantee at most one active
plan per client. Assigning a new plan sets the old one to `active: false` instead of deleting it, so past check-ins
still point to a real plan (adherence history stays correct).

## 15. Plan shape: Mongoose sub-schemas + zod

A week is an array of 7 days (index 0 = Monday); each day has an optional workout (list of exercises) and a list of
meals. It is stored as embedded sub-documents inside the plan, not in separate collections: the app always loads and
saves a whole week at once, so embedding means one read and one write. The zod `weekSchema` checks exactly 7 days
and that every exercise and meal **id is unique** in the week, because a check-off points to one item id.
The browser creates these ids (`crypto.randomUUID`), so the editor can add items before anything is saved.

## 16. "Today" is computed on the server, in the client's time zone

Each client stores an IANA time zone (`Asia/Yerevan`). The server turns "now" into that client's calendar date with
`Intl.DateTimeFormat` and works with plain `YYYY-MM-DD` strings from there. A plan day is a calendar day, not a
24-hour UTC slice: at 02:00 on Monday in Yerevan it is still Sunday in UTC, and the client must see Monday's workout.
The browser's clock is not trusted for this (it can be wrong, and the trainer's dashboard needs the same answer).
Unit tests cover UTC+4, UTC-7, a half-hour zone, UTC+14 and the October daylight-saving switch.

## 17. The "on track" rule

Adherence = done items / scheduled items over the **last 7 days, including today**, only counting days from the plan's
start date. At least 80% is on track (green), at least 50% at risk (amber), below 50% behind (red).
Two details make it fair:

- **Today only counts in the client's favour.** Past days count all their scheduled items; today counts only the
  items already done. Otherwise every client would look "behind" at 9 am.
- **"Just started"** (grey) when nothing is scheduled in the window yet (plan starts today, or only rest days), and
  **"No plan"** when there is no plan. A new client should not show up red.
  It is one pure function (`computeAdherence`) with unit tests for every threshold and edge case.

## 18. Check-offs: idempotent PUT and DELETE

`PUT /me/checkins/:date/:itemId` checks an item, `DELETE` unchecks it. A unique index on (client, date, item) plus an
upsert makes a double tap or a retry after a timeout harmless: the result is always one check-in. That matters for
the optimistic UI on a phone with a bad connection. Only **today and yesterday** can be changed ("I did it last night
but forgot to tick it"); older history is fixed so the trainer can trust it. The item must really be on the plan
for that weekday.

## 19. The dashboard is one request with three queries

`GET /dashboard` returns every client with status, plan name and last activity. It runs a fixed number of queries
(clients, their active plans, recent check-ins, plus one aggregation for the last activity) and joins them in memory,
instead of one query per client (the "N+1" problem). With 30 clients that is 4 queries, not 90.
Clients can be in different time zones, so it fetches one extra day of check-ins and lets `computeAdherence` pick
each client's own 7-day window.

## 20. Web app: server state in TanStack Query, one schema for forms

All API data lives in TanStack Query (cache, loading and error states, refetch after a change). There is no global
store: the server is the source of truth. Simple forms (login, client profile) use react-hook-form with
`zodResolver(schema)` using the **same schema** the server validates with. The week editor is one big nested object,
so it keeps plain React state and runs the shared `weekSchema` on save; errors (from the browser or from a server 400)
are keyed by the same dotted paths, so both appear under the right field and the day tab gets a red dot.
Local development needs no Docker: `npm run db:dev` starts a real `mongod` binary on port 27017.

## 21. The demo: a private sandbox per visitor, deleted by MongoDB itself

"Try as trainer" / "Try as client" call `POST /api/auth/demo`, which builds a fresh copy of the demo data (1 trainer,
8 clients, 3 templates, plans, about 2.5 weeks of check-ins) and logs the visitor in with a 24-hour cookie.
Every document gets `expiresAt = now + 24h`, and every collection has a **TTL index** on it, so MongoDB deletes the
sandbox by itself. There is no nightly reset job, and visitors never see each other's edits (a shared demo account
would show whatever the last visitor did). Anything a visitor creates inside the sandbox inherits the same expiry.
It is built with a few bulk `insertMany` calls (about 0.1 s locally). Creating sandboxes is rate-limited per IP
(20 per hour, plus the 10/min auth limit), so nobody can fill the free 512 MB database.

## 22. Demo data that always tells the same story

A recruiter should see the same picture any day: two clients on track, two at risk, two behind, one just started,
one without a plan. Which items were "done" is decided with a golden-ratio sequence instead of random numbers, so the
misses are spread evenly and every 7-day window stays close to the client's target ratio. A unit test checks each
client's status at 28 moments across a week (every weekday, four times of day). The same builder feeds
`npm run seed` (a permanent copy with typed logins, for local development only; it refuses to run against a
non-local database).
