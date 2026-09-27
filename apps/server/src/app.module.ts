import { type DynamicModule, Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthGuard } from './auth/auth.guard';
import { AuthModule } from './auth/auth.module';
import { AUTH_RATE_LIMIT } from './auth/decorators';
import { RolesGuard } from './auth/roles.guard';
import { SESSION_TTL_MS } from './auth/session-cookie';
import { ClientsModule } from './clients/clients.module';
import { APP_CONFIG, type AppConfig } from './config/configuration';
import { HealthController } from './health.controller';
import { PlansModule } from './plans/plans.module';
import { TemplatesModule } from './templates/templates.module';
import { UsersModule } from './users/users.module';

/** Makes APP_CONFIG injectable in every module. */
@Global()
@Module({})
class ConfigModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: ConfigModule,
      providers: [{ provide: APP_CONFIG, useValue: config }],
      exports: [APP_CONFIG],
    };
  }
}

@Module({})
export class AppModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot(config),
        MongooseModule.forRoot(config.mongoUri),
        JwtModule.register({
          global: true,
          secret: config.jwtSecret,
          signOptions: { expiresIn: SESSION_TTL_MS / 1000 },
        }),
        ThrottlerModule.forRoot([
          { name: 'default', ttl: 60_000, limit: config.rateLimitPerMinute },
          {
            name: 'auth',
            ttl: 60_000,
            limit: config.authRateLimitPerMinute,
            // Only routes marked @AuthRateLimit() count against this stricter limit.
            skipIf: (ctx) => !Reflect.getMetadata(AUTH_RATE_LIMIT, ctx.getHandler()),
          },
        ]),
        UsersModule,
        AuthModule,
        ClientsModule,
        PlansModule,
        TemplatesModule,
      ],
      controllers: [HealthController],
      providers: [
        // Order matters: rate limit first, then "who are you", then "may you do this".
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    };
  }
}
