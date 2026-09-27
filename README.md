# Coachdesk

Client management for personal trainers: build weekly workout and meal plans, share them with clients through an
invite link, and see on one dashboard who is on track.

**Status:** in development. Stack: NestJS + MongoDB + React (TypeScript monorepo).

## Run locally

```bash
npm install
docker compose up -d        # local MongoDB
cp apps/server/.env.example apps/server/.env
npm run dev                 # API on :3000, web on :5173
```
