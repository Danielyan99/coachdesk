import type { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import type { Connection } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../app.module';
import type { AppConfig } from '../config/configuration';
import { configureApp } from '../configure-app';

export interface TestApp {
  app: INestApplication;
  config: AppConfig;
  /** A supertest agent keeps cookies between requests, like one browser. */
  agent: () => ReturnType<typeof request.agent>;
  close: () => Promise<void>;
}

/**
 * The real app on the in-memory MongoDB from global-setup.ts, with a fresh database.
 * One per test file (or describe block); call close() in afterAll.
 */
export async function createTestApp(overrides: Partial<AppConfig> = {}): Promise<TestApp> {
  const baseUri = process.env.MONGO_TEST_URI;
  if (!baseUri) throw new Error('MONGO_TEST_URI is not set: run the tests with jest (see global-setup.ts)');
  const dbName = `test-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const config: AppConfig = {
    port: 0,
    mongoUri: `${baseUri.replace(/\/$/, '')}/${dbName}`,
    jwtSecret: 'test-secret-that-is-long-enough-for-hs256',
    webOrigin: 'http://localhost:5173',
    secureCookies: false,
    trustProxyHops: 0,
    rateLimitPerMinute: 1000,
    authRateLimitPerMinute: 1000,
    demoRateLimitPerHour: 1000,
    demoGlobalLimitPerHour: 1000,
    ...overrides,
  };

  const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(config)] }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app, config);
  await app.init();
  // Mongoose builds indexes in the background. On a fresh database, wait for them, or a test can
  // beat the unique email index and see a duplicate signup succeed.
  const connection = app.get<Connection>(getConnectionToken());
  await Promise.all(Object.values(connection.models).map((model) => model.init()));

  return {
    app,
    config,
    agent: () => request.agent(app.getHttpServer()),
    close: async () => {
      await app.get<Connection>(getConnectionToken()).dropDatabase();
      await app.close();
    },
  };
}

let seq = 0;

/** Signs up a new trainer on the agent and returns the credentials. */
export async function signupTrainer(agent: ReturnType<typeof request.agent>, name = 'Test Trainer') {
  seq += 1;
  const credentials = { name, email: `trainer${seq}@example.com`, password: 'correct-horse-battery' };
  await agent.post('/api/auth/signup').send(credentials).expect(201);
  return credentials;
}
