import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { createTestApp, signupTrainer, type TestApp } from '../test-utils/test-app';
import { Client } from './client.schema';

type Agent = ReturnType<TestApp['agent']>;

const newClient = { name: 'Sam Lee', goals: 'Run 10 km', timezone: 'Asia/Yerevan', stats: { weightKg: 80 } };

async function createClient(agent: Agent, body: object = newClient) {
  const res = await agent.post('/api/clients').send(body).expect(201);
  return res.body as { id: string };
}

function tokenFrom(url: string) {
  return url.split('/invite/')[1];
}

describe('Clients (e2e)', () => {
  let t: TestApp;
  let trainerA: Agent;
  let trainerB: Agent;

  beforeAll(async () => {
    t = await createTestApp();
    trainerA = t.agent();
    trainerB = t.agent();
    await signupTrainer(trainerA, 'Trainer A');
    await signupTrainer(trainerB, 'Trainer B');
  });

  afterAll(() => t.close());

  describe('CRUD', () => {
    it('creates, reads, updates and archives a client', async () => {
      const created = await agentCreate();
      expect(created).toMatchObject({
        name: 'Sam Lee',
        goals: 'Run 10 km',
        notes: '',
        timezone: 'Asia/Yerevan',
        stats: { weightKg: 80 },
        archived: false,
        hasLogin: false,
        inviteExpiresAt: null,
      });

      const list = await trainerA.get('/api/clients').expect(200);
      expect(list.body.map((c: { id: string }) => c.id)).toContain(created.id);

      const updated = await trainerA
        .patch(`/api/clients/${created.id}`)
        .send({ notes: 'Knee injury, no jumping', stats: { weightKg: 78, heightCm: 180 } })
        .expect(200);
      expect(updated.body).toMatchObject({ name: 'Sam Lee', notes: 'Knee injury, no jumping' });
      expect(updated.body.stats).toEqual({ weightKg: 78, heightCm: 180 });

      await trainerA.delete(`/api/clients/${created.id}`).expect(204);
      const after = await trainerA.get('/api/clients').expect(200);
      expect(after.body.map((c: { id: string }) => c.id)).not.toContain(created.id);
      const archived = await trainerA.get(`/api/clients/${created.id}`).expect(200);
      expect(archived.body.archived).toBe(true);
    });

    it('validates input, including the time zone', async () => {
      const res = await trainerA
        .post('/api/clients')
        .send({ name: '', timezone: 'Mars/Olympus', stats: { weightKg: 5 } })
        .expect(400);
      expect(Object.keys(res.body.fieldErrors).sort()).toEqual(['name', 'stats.weightKg', 'timezone']);
    });

    async function agentCreate() {
      const res = await trainerA.post('/api/clients').send(newClient).expect(201);
      return res.body;
    }
  });

  describe('data isolation', () => {
    it('trainer B gets 404 for every action on trainer A client, and never sees it in the list', async () => {
      const { id } = await createClient(trainerA);

      await trainerB.get(`/api/clients/${id}`).expect(404);
      await trainerB.patch(`/api/clients/${id}`).send({ name: 'Hacked' }).expect(404);
      await trainerB.delete(`/api/clients/${id}`).expect(404);
      await trainerB.post(`/api/clients/${id}/invite`).expect(404);
      const list = await trainerB.get('/api/clients').expect(200);
      expect(list.body.map((c: { id: string }) => c.id)).not.toContain(id);

      const unchanged = await trainerA.get(`/api/clients/${id}`).expect(200);
      expect(unchanged.body).toMatchObject({ name: 'Sam Lee', archived: false });
    });

    it('ignores a trainerId sent in the body', async () => {
      const me = await trainerB.get('/api/auth/me').expect(200);
      const { id } = await createClient(trainerA, { ...newClient, trainerId: me.body.id });
      await trainerB.get(`/api/clients/${id}`).expect(404);
      await trainerA.get(`/api/clients/${id}`).expect(200);
    });

    it('returns 404 for a malformed id', async () => {
      await trainerA.get('/api/clients/not-an-id').expect(404);
    });

    it('needs a login', async () => {
      await t.agent().get('/api/clients').expect(401);
    });
  });

  describe('invites', () => {
    it('lets the client set a login once, then logs them in as a client who cannot use trainer routes', async () => {
      const { id } = await createClient(trainerA);
      const invite = await trainerA.post(`/api/clients/${id}/invite`).expect(201);
      expect(invite.body.url).toMatch(/^http:\/\/localhost:5173\/invite\/[\w-]{40,}$/);
      const token = tokenFrom(invite.body.url);

      const listed = await trainerA.get(`/api/clients/${id}`).expect(200);
      expect(listed.body.inviteExpiresAt).toBe(invite.body.expiresAt);

      const preview = await t.agent().get(`/api/auth/invite/${token}`).expect(200);
      expect(preview.body).toEqual({ clientName: 'Sam Lee', trainerName: 'Trainer A' });

      const client = t.agent();
      const accepted = await client
        .post(`/api/auth/invite/${token}/accept`)
        .send({ email: 'Sam@Example.com', password: 'client-password' })
        .expect(200);
      expect(accepted.body).toMatchObject({ role: 'client', name: 'Sam Lee', email: 'sam@example.com', clientId: id });

      // Logged in as the client now
      const me = await client.get('/api/auth/me').expect(200);
      expect(me.body.role).toBe('client');
      await client.get('/api/clients').expect(403);

      // Single use
      await t.agent().get(`/api/auth/invite/${token}`).expect(404);
      await t
        .agent()
        .post(`/api/auth/invite/${token}/accept`)
        .send({ email: 'other@example.com', password: 'client-password' })
        .expect(404);

      // Trainer view: has a login, no open invite, and a new invite is refused
      const after = await trainerA.get(`/api/clients/${id}`).expect(200);
      expect(after.body).toMatchObject({ hasLogin: true, inviteExpiresAt: null });
      await trainerA.post(`/api/clients/${id}/invite`).expect(409);

      // The client can log in again later with the email they chose
      await t
        .agent()
        .post('/api/auth/login')
        .send({ email: 'sam@example.com', password: 'client-password' })
        .expect(200);
    });

    it('rejects an expired invite', async () => {
      const { id } = await createClient(trainerA);
      const invite = await trainerA.post(`/api/clients/${id}/invite`).expect(201);
      const clients = t.app.get<Model<Client>>(getModelToken(Client.name));
      await clients.updateOne({ _id: id }, { $set: { inviteExpiresAt: new Date(Date.now() - 1000) } });

      await t
        .agent()
        .post(`/api/auth/invite/${tokenFrom(invite.body.url)}/accept`)
        .send({ email: 'late@example.com', password: 'client-password' })
        .expect(404);
    });

    it('a new invite replaces the old link', async () => {
      const { id } = await createClient(trainerA);
      const first = await trainerA.post(`/api/clients/${id}/invite`).expect(201);
      const second = await trainerA.post(`/api/clients/${id}/invite`).expect(201);
      await t
        .agent()
        .get(`/api/auth/invite/${tokenFrom(first.body.url)}`)
        .expect(404);
      await t
        .agent()
        .get(`/api/auth/invite/${tokenFrom(second.body.url)}`)
        .expect(200);
    });

    it('keeps the link valid when the chosen email is taken, so the client can retry', async () => {
      const { id } = await createClient(trainerA);
      const token = tokenFrom((await trainerA.post(`/api/clients/${id}/invite`).expect(201)).body.url);
      const taken = (await trainerA.get('/api/auth/me')).body.email;

      await t
        .agent()
        .post(`/api/auth/invite/${token}/accept`)
        .send({ email: taken, password: 'client-password' })
        .expect(409);
      await t
        .agent()
        .post(`/api/auth/invite/${token}/accept`)
        .send({ email: 'fresh@example.com', password: 'client-password' })
        .expect(200);
    });

    it('archiving a client kills its open invite', async () => {
      const { id } = await createClient(trainerA);
      const token = tokenFrom((await trainerA.post(`/api/clients/${id}/invite`).expect(201)).body.url);
      await trainerA.delete(`/api/clients/${id}`).expect(204);
      await t.agent().get(`/api/auth/invite/${token}`).expect(404);
    });

    it('returns 404 for an unknown token', async () => {
      await t.agent().get('/api/auth/invite/made-up-token').expect(404);
    });
  });
});

describe('Tier limits (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(() => t.close());

  it('stops at 10 active clients on Starter, and allows more after switching to Pro', async () => {
    const trainer = t.agent();
    await signupTrainer(trainer);
    const ids: string[] = [];
    for (let i = 0; i < 10; i++) ids.push((await createClient(trainer, { ...newClient, name: `Client ${i}` })).id);

    const blocked = await trainer.post('/api/clients').send(newClient).expect(403);
    expect(blocked.body).toMatchObject({ code: 'CLIENT_LIMIT', limit: 10 });
    expect(blocked.body.message).toMatch(/Starter plan includes up to 10 clients/);

    // Archived clients don't count
    await trainer.delete(`/api/clients/${ids[0]}`).expect(204);
    await createClient(trainer);
    await trainer.post('/api/clients').send(newClient).expect(403);

    const switched = await trainer.patch('/api/me/tier').send({ tier: 'pro' }).expect(200);
    expect(switched.body.tier).toBe('pro');
    expect((await trainer.get('/api/auth/me')).body.tier).toBe('pro');
    await createClient(trainer);

    // Can't go back down while over the Starter limit
    const down = await trainer.patch('/api/me/tier').send({ tier: 'starter' }).expect(409);
    expect(down.body.message).toMatch(/11 active clients/);
  });

  it('rejects an unknown tier', async () => {
    const trainer = t.agent();
    await signupTrainer(trainer);
    await trainer.patch('/api/me/tier').send({ tier: 'gold' }).expect(400);
  });
});
