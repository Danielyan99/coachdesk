import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClientsModule } from '../clients/clients.module';
import { PlansModule } from '../plans/plans.module';
import { UsersModule } from '../users/users.module';
import { CheckIn, CheckInSchema } from './check-in.schema';
import { MeController } from './me.controller';
import { ProgressService } from './progress.service';
import { TrainerProgressController } from './trainer-progress.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: CheckIn.name, schema: CheckInSchema }]),
    UsersModule,
    ClientsModule,
    PlansModule,
  ],
  controllers: [MeController, TrainerProgressController],
  providers: [ProgressService],
  exports: [MongooseModule],
})
export class ProgressModule {}
