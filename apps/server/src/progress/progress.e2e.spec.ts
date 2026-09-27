import { getModelToken } from '@nestjs/mongoose';
import type { DashboardDto, PlanDay, TodayDto, WeekDto } from '@coachdesk/shared';
import { type Model, Types } from 'mongoose';
import { sampleWeek } from '../test-utils/sample-week';
import { createTestApp, signupTrainer, type TestApp } from '../test-utils/test-app';
import { itemIdsOf } from './adherence';
import { CheckIn } from './check-in.schema';
import { addDays, todayIn, weekdayOf } from './dates';

type Agent = ReturnType<TestApp['agent']>;

const TZ = 'Asia/Yerevan';
let emailSeq = 0;

describe('Client progress and trainer dashboard (e2e)', () => {
  let t: TestApp;
  let trainer: Agent;
  let checkIns: Model<CheckIn>;
  const today = () => todayIn(TZ);

  beforeAll(async () => {
    t = await createTestApp();
    trainer = t.agent();
    await signupTrainer(trainer, 'Coach Kim');
    await trainer.patch('/api/me/tier').send({ tier: 'unlimited' }).expect(200); // this file makes >10 clients
    checkIns = t.app.get(getModelToken(CheckIn.name));
  });

  afterAll(() => t.close());

  /** A client with a login and (unless startDate is null) the sample week, started 10 days ago. */
  async function setupClient(name: string, startDate: string | null = addDays(today(), -10)) {
    const clientId = (await trainer.post('/api/clients').send({ name, timezone: TZ }).expect(201)).body.id as string;
    let days: PlanDay[] = [];
    if (startDate) {
      days = sampleWeek();
      await trainer.put(`/api/clients/${clientId}/plan`).send({ name: 'Base plan', startDate, days }).expect(200);
    }
    const url = (await trainer.post(`/api/clients/${clientId}/invite`).expect(201)).body.url as string;
    const agent = t.agent();
    await agent
      .post(`/api/auth/invite/${url.split('/invite/')[1]}/accept`)
      .send({ email: `client${++emailSeq}@example.com`, password: 'client-password' })
      .expect(200);
    return { clientId, agent, days };
  }

  describe('client screens', () => {
    it('shows today in the client time zone with the right plan day', async () => {
      const { agent, days } = await setupClient('Ana');
      const res = await agent.get('/api/me/today').expect(200);
      const body = res.body as TodayDto;
      const date = today();
      expect(body).toMatchObject({ trainerName: 'Coach Kim', planName: 'Base plan' });
      expect(body.editableDates).toEqual([addDays(date, -1), date]);
      expect(body.today).toMatchObject({ date, weekday: weekdayOf(date), done: [], beforeStart: false });
      expect(body.today!.meals).toEqual(days[weekdayOf(date)].meals);
    });

    it('shows the week Monday to Sunday', async () => {
      const { agent } = await setupClient('Ben');
      const body = (await agent.get('/api/me/week').expect(200)).body as WeekDto;
      expect(body.days.map((d) => d.weekday)).toEqual([0, 1, 2, 3, 4, 5, 6]);
      expect(body.days.map((d) => d.date)).toContain(today());
    });

    it('checks and unchecks items idempotently', async () => {
      const { agent, days } = await setupClient('Cleo');
      const date = today();
      const [meal] = days[weekdayOf(date)].meals;

      await agent.put(`/api/me/checkins/${date}/${meal.id}`).expect(204);
      await agent.put(`/api/me/checkins/${date}/${meal.id}`).expect(204);
      expect((await agent.get('/api/me/today')).body.today.done).toEqual([meal.id]);

      await agent.delete(`/api/me/checkins/${date}/${meal.id}`).expect(204);
      await agent.delete(`/api/me/checkins/${date}/${meal.id}`).expect(204);
      expect((await agent.get('/api/me/today')).body.today.done).toEqual([]);
    });

    it('allows yesterday but not older days or the future', async () => {
      const { agent, days } = await setupClient('Dan');
      const itemOn = (date: string) => days[weekdayOf(date)].meals[0].id;
      const yesterday = addDays(today(), -1);
      await agent.put(`/api/me/checkins/${yesterday}/${itemOn(yesterday)}`).expect(204);

      const older = addDays(today(), -2);
      const tomorrow = addDays(today(), 1);
      await agent.put(`/api/me/checkins/${older}/${itemOn(older)}`).expect(403);
      await agent.put(`/api/me/checkins/${tomorrow}/${itemOn(tomorrow)}`).expect(403);
    });

    it('rejects items that are not on that day, and bad input', async () => {
      const { agent, days } = await setupClient('Eve');
      const date = today();
      const otherDay = days[(weekdayOf(date) + 1) % 7].meals[0].id;
      await agent.put(`/api/me/checkins/${date}/${otherDay}`).expect(404);
      await agent.put(`/api/me/checkins/${date}/made-up`).expect(404);
      await agent.put(`/api/me/checkins/not-a-date/${otherDay}`).expect(400);
    });

    it('refuses check-offs before the plan starts', async () => {
      const { agent, days } = await setupClient('Finn', addDays(today(), 3));
      const res = await agent.get('/api/me/today').expect(200);
      expect(res.body.today.beforeStart).toBe(true);
      const meal = days[weekdayOf(today())].meals[0].id;
      await agent.put(`/api/me/checkins/${today()}/${meal}`).expect(409);
    });

    it('works without a plan', async () => {
      const { agent } = await setupClient('Gus', null);
      expect((await agent.get('/api/me/today').expect(200)).body).toMatchObject({ planName: null, today: null });
      expect((await agent.get('/api/me/week').expect(200)).body.days).toEqual([]);
    });

    it('keeps roles apart', async () => {
      const { agent } = await setupClient('Hal');
      await trainer.get('/api/me/today').expect(403);
      await agent.get('/api/dashboard').expect(403);
      await agent.get('/api/templates').expect(403);
    });

    it('locks the client out after the trainer archives them', async () => {
      const { agent, clientId } = await setupClient('Ivy');
      await trainer.delete(`/api/clients/${clientId}`).expect(204);
      await agent.get('/api/me/today').expect(403);
    });
  });

  describe('adherence and dashboard', () => {
    /** Writes check-ins for every scheduled item on each of the past `daysBack` days. */
    async function completePastDays(clientId: string, days: PlanDay[], daysBack: number) {
      const docs = [];
      for (let back = 1; back <= daysBack; back++) {
        const date = addDays(today(), -back);
        for (const itemId of itemIdsOf(days[weekdayOf(date)])) {
          docs.push({
            clientId: new Types.ObjectId(clientId),
            planId: new Types.ObjectId(),
            date,
            itemId,
            itemType: 'meal',
            completedAt: new Date(`${date}T12:00:00Z`),
          });
        }
      }
      await checkIns.insertMany(docs);
    }

    it('reports on-track, behind and no-plan clients in one dashboard call', async () => {
      const good = await setupClient('Zed Good');
      const bad = await setupClient('Zed Bad');
      await setupClient('Zed None', null);
      await completePastDays(good.clientId, good.days, 6);
      await completePastDays(bad.clientId, bad.days, 1);

      const adherence = (await trainer.get(`/api/clients/${good.clientId}/adherence`).expect(200)).body;
      expect(adherence).toMatchObject({ status: 'on-track', ratio: 1 });
      expect(adherence.days).toHaveLength(7);

      const dash = (await trainer.get('/api/dashboard').expect(200)).body as DashboardDto;
      expect(dash).toMatchObject({ tier: 'unlimited', clientLimit: null });
      const byName = Object.fromEntries(dash.clients.map((c) => [c.name, c]));
      expect(byName['Zed Good'].adherence.status).toBe('on-track');
      expect(byName['Zed Good'].lastActivity).toBe(`${addDays(today(), -1)}T12:00:00.000Z`);
      expect(byName['Zed Good']).toMatchObject({ planName: 'Base plan', hasLogin: true });
      expect(byName['Zed Bad'].adherence.status).toBe('behind');
      expect(byName['Zed None'].adherence.status).toBe('no-plan');
      expect(byName['Zed None'].lastActivity).toBeNull();

      const total = Object.values(dash.counts).reduce((a, b) => a + b, 0);
      expect(total).toBe(dash.clients.length);
    });

    it('keeps each trainer dashboard and adherence private', async () => {
      const { clientId } = await setupClient('Private');
      const other = t.agent();
      await signupTrainer(other);
      await other.get(`/api/clients/${clientId}/adherence`).expect(404);
      const dash = (await other.get('/api/dashboard').expect(200)).body as DashboardDto;
      expect(dash.clients).toEqual([]);
    });
  });
});
