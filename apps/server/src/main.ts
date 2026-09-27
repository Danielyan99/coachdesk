import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';

async function bootstrap() {
  try {
    process.loadEnvFile(); // apps/server/.env for local development
  } catch {
    // No .env file: rely on the real environment (e.g. Render).
  }
  const port = Number(process.env.PORT ?? 3000);

  const app = await NestFactory.create(AppModule);
  configureApp(app);
  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0');
  Logger.log(`Listening on :${port}`, 'Bootstrap');
}

void bootstrap();
