import { getConnectionToken } from '@nestjs/mongoose';
import type { DashboardDto, TodayDto } from '@coachdesk/shared';
import type { Connection } from 'mongoose';
import { createTestApp, type TestApp } from '../test-utils/test-app';

describe('Demo sandbox (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(() => t.close());

  it('"Try as trainer" gives a full dashboard with every status', async () => {
    const agent = t.agent();
    const res = await agent.post('/api/auth/demo').send({ role: 'trainer' }).expect(200);
    expect(res.body).toMatchObject({ role: 'trainer', name: 'Alex Morgan', tier: 'pro', demo: true });
    expect(String(res.headers['set-cookie'])).toMatch(/Max-Age=86400/);

    const dash = (await agent.get('/api/dashboard').expect(200)).body as DashboardDto;
    expect(dash.clients).toHaveLength(8);
    expect(dash.counts).toEqual({ 'on-track': 2, 'at-risk': 2, behind: 2, 'no-data': 1, 'no-plan': 1 });
    expect(dash.clientLimit).toBe(30);
    expect((await agent.get('/api/templates').expect(200)).body).toHaveLength(3);
  });

  it('"Try as client" logs in as a client with a plan and history', async () => {
    const agent = t.agent();
    const res = await agent.post('/api/auth/demo').send({ role: 'client' }).expect(200);
    expect(res.body).toMatchObject({ role: 'client', name: 'Ana Petrosyan', demo: true });

    const today = (await agent.get('/api/me/today').expect(200)).body as TodayDto;
    expect(today).toMatchObject({ trainerName: 'Alex Morgan', planName: 'Beginner strength (3 days)' });
    expect(today.today?.meals.length).toBeGreaterThan(0);
    await agent.get('/api/dashboard').expect(403);
  });

  it('gives each visitor a private copy', async () => {
    const one = t.agent();
    const two = t.agent();
    await one.post('/api/auth/demo').send({ role: 'trainer' }).expect(200);
    await two.post('/api/auth/demo').send({ role: 'trainer' }).expect(200);

    const created = await one.post('/api/clients').send({ name: 'Only in sandbox one', timezone: 'UTC' }).expect(201);
    const oneNames = (await one.get('/api/dashboard')).body.clients.map((c: { name: string }) => c.name);
    const twoDash = (await two.get('/api/dashboard')).body as DashboardDto;
    expect(oneNames).toContain('Only in sandbox one');
    expect(twoDash.clients.map((c) => c.name)).not.toContain('Only in sandbox one');
    await two.get(`/api/clients/${created.body.id}`).expect(404);
    // Same names, different records
    expect(twoDash.clients.map((c) => c.id)).not.toContain((await one.get('/api/dashboard')).body.clients[0].id);
  });

  it('marks every sandbox document to expire in 24 hours, with TTL indexes on every collection', async () => {
    const agent = t.agent();
    await agent.post('/api/auth/demo').send({ role: 'trainer' }).expect(200);
    await agent.post('/api/clients').send({ name: 'Added during the demo', timezone: 'UTC' }).expect(201);

    const db = t.app.get<Connection>(getConnectionToken()).db!;
    for (const name of ['users', 'clients', 'templates', 'clientplans', 'checkins']) {
      const indexes = await db.collection(name).indexes();
      expect(indexes).toContainEqual(expect.objectContaining({ key: { expiresAt: 1 }, expireAfterSeconds: 0 }));
    }

    const client = await db.collection('clients').findOne({ name: 'Added during the demo' });
    const hoursLeft = (client!.expiresAt.getTime() - Date.now()) / 3_600_000;
    expect(hoursLeft).toBeGreaterThan(23.9);
    expect(hoursLeft).toBeLessThanOrEqual(24);
  });

  it('rejects an unknown role', async () => {
    await t.agent().post('/api/auth/demo').send({ role: 'admin' }).expect(400);
  });
});

describe('Demo rate limit (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp({ demoRateLimitPerHour: 2 });
  });

  afterAll(() => t.close());

  it('limits sandboxes per IP per hour', async () => {
    await t.agent().post('/api/auth/demo').send({ role: 'trainer' }).expect(200);
    await t.agent().post('/api/auth/demo').send({ role: 'client' }).expect(200);
    await t.agent().post('/api/auth/demo').send({ role: 'trainer' }).expect(429);
    await t.agent().post('/api/auth/login').send({ email: 'x@example.com', password: 'whatever' }).expect(401);
  });
});
