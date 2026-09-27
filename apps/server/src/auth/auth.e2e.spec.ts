import { createTestApp, signupTrainer, type TestApp } from '../test-utils/test-app';

describe('Auth (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(() => t.close());

  it('GET /api/health works without a login', async () => {
    await t.agent().get('/api/health').expect(200, { status: 'ok' });
  });

  it('signup creates a trainer on the Starter tier and logs them in with an httpOnly cookie', async () => {
    const agent = t.agent();
    const res = await agent
      .post('/api/auth/signup')
      .send({ name: '  Anna Coach ', email: ' Anna@Example.com ', password: 'longenough1' })
      .expect(201);

    expect(res.body).toEqual({
      id: expect.any(String),
      email: 'anna@example.com',
      name: 'Anna Coach',
      role: 'trainer',
      tier: 'starter',
      demo: false,
    });
    expect(res.body).not.toHaveProperty('passwordHash');
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/cd_session=/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).toMatch(/Path=\/api/);

    const me = await agent.get('/api/auth/me').expect(200);
    expect(me.body.email).toBe('anna@example.com');
  });

  it('rejects a duplicate email with 409', async () => {
    const agent = t.agent();
    const { email } = await signupTrainer(agent);
    await t.agent().post('/api/auth/signup').send({ name: 'Other', email, password: 'longenough1' }).expect(409);
  });

  it('returns 400 with field errors for an invalid body', async () => {
    const res = await t
      .agent()
      .post('/api/auth/signup')
      .send({ name: '', email: 'nope', password: 'short' })
      .expect(400);
    expect(res.body.fieldErrors).toEqual({
      name: ['Enter your name'],
      email: ['Enter a valid email address'],
      password: ['Use at least 8 characters'],
    });
  });

  it('logs in with the right password, and gives the same 401 for a wrong password or unknown email', async () => {
    const { email, password } = await signupTrainer(t.agent());

    const wrong = await t.agent().post('/api/auth/login').send({ email, password: 'wrong-password' }).expect(401);
    const unknown = await t.agent().post('/api/auth/login').send({ email: 'nobody@example.com', password }).expect(401);
    expect(wrong.body.message).toBe(unknown.body.message);

    const agent = t.agent();
    await agent.post('/api/auth/login').send({ email: email.toUpperCase(), password }).expect(200);
    await agent.get('/api/auth/me').expect(200);
  });

  it('logout clears the cookie', async () => {
    const agent = t.agent();
    await signupTrainer(agent);
    await agent.get('/api/auth/me').expect(200);
    await agent.post('/api/auth/logout').expect(204);
    await agent.get('/api/auth/me').expect(401);
  });

  it('rejects requests without a cookie or with a forged token', async () => {
    await t.agent().get('/api/auth/me').expect(401);
    await t.agent().get('/api/auth/me').set('Cookie', 'cd_session=not.a.jwt').expect(401);
  });

  it('sets security headers (helmet)', async () => {
    const res = await t.agent().get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('Auth rate limit (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp({ authRateLimitPerMinute: 3 });
  });

  afterAll(() => t.close());

  it('blocks login after too many attempts from one IP, but not other routes', async () => {
    const attempt = () => t.agent().post('/api/auth/login').send({ email: 'x@example.com', password: 'whatever' });
    for (let i = 0; i < 3; i++) await attempt().expect(401);
    await attempt().expect(429);
    await t.agent().get('/api/health').expect(200);
  });
});
