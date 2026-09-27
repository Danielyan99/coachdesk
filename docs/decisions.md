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
