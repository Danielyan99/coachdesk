import { sampleWeek } from '../test-utils/sample-week';
import { createTestApp, signupTrainer, type TestApp } from '../test-utils/test-app';

type Agent = ReturnType<TestApp['agent']>;

const clientBody = { name: 'Mia', timezone: 'Europe/Berlin' };

describe('Templates and plans (e2e)', () => {
  let t: TestApp;
  let trainerA: Agent;
  let trainerB: Agent;

  beforeAll(async () => {
    t = await createTestApp();
    trainerA = t.agent();
    trainerB = t.agent();
    await signupTrainer(trainerA);
    await signupTrainer(trainerB);
  });

  afterAll(() => t.close());

  async function createTemplate(agent: Agent, name = 'Beginner strength') {
    const res = await agent.post('/api/templates').send({ name, days: sampleWeek() }).expect(201);
    return res.body;
  }

  async function createClient(agent: Agent) {
    return (await agent.post('/api/clients').send(clientBody).expect(201)).body.id as string;
  }

  describe('templates', () => {
    it('creates, lists, updates and deletes a template', async () => {
      const created = await createTemplate(trainerA);
      expect(created).toMatchObject({ name: 'Beginner strength', description: '' });
      expect(created.days).toHaveLength(7);
      expect(created.days[0].workout.exercises[0]).toMatchObject({ name: 'Squat', sets: 3, reps: '8-10' });
      expect(created.days[1].workout).toBeNull();

      const list = await trainerA.get('/api/templates').expect(200);
      expect(list.body.map((x: { id: string }) => x.id)).toContain(created.id);

      const renamed = await trainerA.patch(`/api/templates/${created.id}`).send({ name: 'Strength 1' }).expect(200);
      expect(renamed.body.name).toBe('Strength 1');
      expect(renamed.body.days).toEqual(created.days);

      await trainerA.delete(`/api/templates/${created.id}`).expect(204);
      await trainerA.get(`/api/templates/${created.id}`).expect(404);
    });

    it('rejects a week that is not 7 days, and duplicate item ids', async () => {
      const six = await trainerA
        .post('/api/templates')
        .send({ name: 'X', days: sampleWeek().slice(0, 6) })
        .expect(400);
      expect(six.body.fieldErrors.days).toEqual(['A week has 7 days']);

      const days = sampleWeek();
      days[3].meals[0].id = days[0].meals[0].id;
      const dup = await trainerA.post('/api/templates').send({ name: 'X', days }).expect(400);
      expect(dup.body.fieldErrors).toEqual({ 'days.3.meals.0.id': ['Duplicate item id'] });
    });

    it('keeps templates private to their trainer', async () => {
      const { id } = await createTemplate(trainerA);
      await trainerB.get(`/api/templates/${id}`).expect(404);
      await trainerB.patch(`/api/templates/${id}`).send({ name: 'Mine now' }).expect(404);
      await trainerB.delete(`/api/templates/${id}`).expect(404);
      const bClient = await createClient(trainerB);
      await trainerB
        .post(`/api/templates/${id}/assign`)
        .send({ clientId: bClient, startDate: '2026-09-28' })
        .expect(404);
      // Own template, but someone else's client
      await trainerA
        .post(`/api/templates/${id}/assign`)
        .send({ clientId: bClient, startDate: '2026-09-28' })
        .expect(404);
      expect((await trainerB.get(`/api/clients/${bClient}/plan`)).body).toEqual({ plan: null });
      expect((await trainerB.get('/api/templates')).body).toEqual([]);
    });
  });

  describe('assigning and editing plans', () => {
    it('copies the template: later edits on either side never leak to the other', async () => {
      const template = await createTemplate(trainerA);
      const mia = await createClient(trainerA);
      const noah = await createClient(trainerA);

      const assigned = await trainerA
        .post(`/api/templates/${template.id}/assign`)
        .send({ clientId: mia, startDate: '2026-09-28' })
        .expect(201);
      expect(assigned.body).toMatchObject({
        clientId: mia,
        sourceTemplateId: template.id,
        name: template.name,
        startDate: '2026-09-28',
        days: template.days,
      });
      await trainerA.post(`/api/templates/${template.id}/assign`).send({ clientId: noah, startDate: '2026-09-28' });

      // Edit Mia's plan: swap Monday's squat for lunges
      const miaDays = structuredClone(assigned.body.days);
      miaDays[0].workout.exercises[0].name = 'Lunges';
      await trainerA
        .put(`/api/clients/${mia}/plan`)
        .send({ name: 'Mia strength', startDate: '2026-09-28', days: miaDays })
        .expect(200);

      const templateAfter = (await trainerA.get(`/api/templates/${template.id}`)).body;
      expect(templateAfter.days[0].workout.exercises[0].name).toBe('Squat');
      const noahPlan = (await trainerA.get(`/api/clients/${noah}/plan`)).body.plan;
      expect(noahPlan.days[0].workout.exercises[0].name).toBe('Squat');
      const miaPlan = (await trainerA.get(`/api/clients/${mia}/plan`)).body.plan;
      expect(miaPlan).toMatchObject({ id: assigned.body.id, name: 'Mia strength' });
      expect(miaPlan.days[0].workout.exercises[0].name).toBe('Lunges');

      // Edit the template: plans stay as they were
      const templateDays = structuredClone(template.days);
      templateDays[2].workout = null;
      await trainerA.patch(`/api/templates/${template.id}`).send({ days: templateDays }).expect(200);
      expect((await trainerA.get(`/api/clients/${noah}/plan`)).body.plan.days[2].workout).not.toBeNull();

      // Delete the template: plans stay too
      await trainerA.delete(`/api/templates/${template.id}`).expect(204);
      expect((await trainerA.get(`/api/clients/${mia}/plan`)).body.plan.name).toBe('Mia strength');
    });

    it('assigning again replaces the active plan', async () => {
      const first = await createTemplate(trainerA, 'First');
      const second = await createTemplate(trainerA, 'Second');
      const client = await createClient(trainerA);
      await trainerA
        .post(`/api/templates/${first.id}/assign`)
        .send({ clientId: client, startDate: '2026-09-01' })
        .expect(201);
      await trainerA
        .post(`/api/templates/${second.id}/assign`)
        .send({ clientId: client, startDate: '2026-09-28' })
        .expect(201);

      const { plan } = (await trainerA.get(`/api/clients/${client}/plan`)).body;
      expect(plan).toMatchObject({ name: 'Second', startDate: '2026-09-28' });
    });

    it('returns plan null before anything is assigned, and PUT creates a plan from scratch', async () => {
      const client = await createClient(trainerA);
      expect((await trainerA.get(`/api/clients/${client}/plan`).expect(200)).body).toEqual({ plan: null });

      const created = await trainerA
        .put(`/api/clients/${client}/plan`)
        .send({ name: 'Custom', startDate: '2026-09-28', days: sampleWeek() })
        .expect(200);
      expect(created.body).toMatchObject({ name: 'Custom', sourceTemplateId: null });
    });

    it('keeps plans private and refuses archived clients', async () => {
      const client = await createClient(trainerA);
      const template = await createTemplate(trainerA);
      await trainerB.get(`/api/clients/${client}/plan`).expect(404);
      await trainerB
        .put(`/api/clients/${client}/plan`)
        .send({ name: 'X', startDate: '2026-09-28', days: sampleWeek() })
        .expect(404);

      await trainerA.delete(`/api/clients/${client}`).expect(204);
      await trainerA
        .post(`/api/templates/${template.id}/assign`)
        .send({ clientId: client, startDate: '2026-09-28' })
        .expect(409);
    });

    it('validates the start date', async () => {
      const client = await createClient(trainerA);
      const template = await createTemplate(trainerA);
      const res = await trainerA
        .post(`/api/templates/${template.id}/assign`)
        .send({ clientId: client, startDate: '2026-02-30' })
        .expect(400);
      expect(Object.keys(res.body.fieldErrors)).toEqual(['startDate']);
    });
  });
});
