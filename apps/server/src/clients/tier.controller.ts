import { Body, ConflictException, Controller, Patch } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { type AuthUser, TIERS, type UpdateTierInput, updateTierSchema } from '@coachdesk/shared';
import { Model } from 'mongoose';
import { CurrentUser, Roles } from '../auth/decorators';
import { type RequestUser, toAuthUser } from '../auth/request-user';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { User } from '../users/user.schema';
import { ClientsService } from './clients.service';

/** Switching plans is free and instant: this is a demo of pricing, there is no payment. */
@Roles('trainer')
@Controller('me/tier')
export class TierController {
  constructor(
    private readonly clients: ClientsService,
    @InjectModel(User.name) private readonly users: Model<User>,
  ) {}

  @Patch()
  async update(
    @CurrentUser() trainer: RequestUser,
    @Body(new ZodValidationPipe(updateTierSchema)) { tier }: UpdateTierInput,
  ): Promise<AuthUser> {
    const { maxClients, name } = TIERS[tier];
    const active = await this.clients.countActive(trainer._id);
    if (active > maxClients) {
      throw new ConflictException(
        `You have ${active} active clients and the ${name} plan includes ${maxClients}. Archive some clients first.`,
      );
    }
    await this.users.updateOne({ _id: trainer._id }, { $set: { tier } });
    return toAuthUser({ ...trainer, tier });
  }
}
