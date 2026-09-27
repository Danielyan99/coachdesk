import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClientsModule } from '../clients/clients.module';
import { ClientPlan, ClientPlanSchema } from './client-plan.schema';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: ClientPlan.name, schema: ClientPlanSchema }]), ClientsModule],
  controllers: [PlansController],
  providers: [PlansService],
  exports: [PlansService, MongooseModule],
})
export class PlansModule {}
