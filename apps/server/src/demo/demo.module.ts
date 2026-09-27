import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ClientsModule } from '../clients/clients.module';
import { PlansModule } from '../plans/plans.module';
import { ProgressModule } from '../progress/progress.module';
import { TemplatesModule } from '../templates/templates.module';
import { UsersModule } from '../users/users.module';
import { DemoController } from './demo.controller';
import { DemoService } from './demo.service';

@Module({
  imports: [UsersModule, ClientsModule, TemplatesModule, PlansModule, ProgressModule, AuthModule],
  controllers: [DemoController],
  providers: [DemoService],
  exports: [DemoService],
})
export class DemoModule {}
