import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { AppModule } from '../app.module';
import { loadConfig } from '../config/configuration';
import { User } from '../users/user.schema';
import { DemoService } from './demo.service';

// `npm run seed`: a permanent copy of the demo data in your LOCAL database, with logins you can type.
// These are local development logins only, never used anywhere else.
const TRAINER_EMAIL = 'trainer@coachdesk.local';
const CLIENT_EMAIL = 'ana@coachdesk.local';
const PASSWORD = 'coachdesk-local';

async function main() {
  try {
    process.loadEnvFile();
  } catch {
    // no .env: use the environment
  }
  const config = loadConfig();
  const host = new URL(config.mongoUri.replace(/^mongodb(\+srv)?:/, 'http:')).hostname;
  if (!['localhost', '127.0.0.1'].includes(host) && process.env.SEED_ALLOW_REMOTE !== '1') {
    throw new Error(`Refusing to seed ${host}: known passwords must not reach a shared database.`);
  }

  const app = await NestFactory.createApplicationContext(AppModule.forRoot(config), { logger: ['error', 'warn'] });
  try {
    const users = app.get<Model<User>>(getModelToken(User.name));
    if (await users.exists({ email: TRAINER_EMAIL })) {
      console.log(`Already seeded. Log in as ${TRAINER_EMAIL} or ${CLIENT_EMAIL} (password: ${PASSWORD}).`);
      return;
    }
    await app
      .get(DemoService)
      .createSandbox({ trainerEmail: TRAINER_EMAIL, clientEmail: CLIENT_EMAIL, password: PASSWORD });
    console.log(`Seeded. Log in as trainer ${TRAINER_EMAIL} or client ${CLIENT_EMAIL} (password: ${PASSWORD}).`);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
