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
**To check at deploy:** with the Vercel rewrite in front of Render there may be 2 hops; if the value is too low,
all users share one IP and hit the limit together.

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
