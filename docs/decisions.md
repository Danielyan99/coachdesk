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
