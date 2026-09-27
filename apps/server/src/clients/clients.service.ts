import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  type AcceptInviteInput,
  type ClientDto,
  type ClientLimitErrorBody,
  type CreateClientInput,
  type InviteLinkDto,
  type InvitePreviewDto,
  type Tier,
  TIERS,
  type UpdateClientInput,
} from '@coachdesk/shared';
import { createHash, randomBytes } from 'node:crypto';
import { Model, mongo, type Types } from 'mongoose';
import { hashPassword } from '../auth/password';
import { type RequestUser, toRequestUser } from '../auth/request-user';
import { APP_CONFIG, type AppConfig } from '../config/configuration';
import { User } from '../users/user.schema';
import { Client } from './client.schema';

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type ClientLean = Client & { _id: Types.ObjectId };

export function toClientDto(client: ClientLean): ClientDto {
  const inviteOpen = !client.userId && client.inviteExpiresAt && client.inviteExpiresAt > new Date();
  return {
    id: client._id.toString(),
    name: client.name,
    goals: client.goals,
    stats: client.stats ?? {},
    notes: client.notes,
    timezone: client.timezone,
    archived: client.archived,
    hasLogin: Boolean(client.userId),
    inviteExpiresAt: inviteOpen ? client.inviteExpiresAt!.toISOString() : null,
    createdAt: client.createdAt.toISOString(),
  };
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

const INVALID_INVITE = 'This invite link is invalid or has expired. Ask your trainer for a new one.';

@Injectable()
export class ClientsService {
  constructor(
    @InjectModel(Client.name) private readonly clients: Model<Client>,
    @InjectModel(User.name) private readonly users: Model<User>,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async list(trainer: RequestUser): Promise<ClientDto[]> {
    const clients = await this.clients.find({ trainerId: trainer._id, archived: false }).sort({ name: 1 }).lean();
    return clients.map(toClientDto);
  }

  /** The trainer's client, or 404 (also for another trainer's client: don't reveal that it exists). */
  async findOwned(trainer: RequestUser, id: Types.ObjectId): Promise<ClientLean> {
    const client = await this.clients.findOne({ _id: id, trainerId: trainer._id }).lean();
    if (!client) throw new NotFoundException('Client not found');
    return client;
  }

  countActive(trainerId: Types.ObjectId): Promise<number> {
    return this.clients.countDocuments({ trainerId, archived: false });
  }

  async create(trainer: RequestUser, input: CreateClientInput): Promise<ClientDto> {
    const tier: Tier = trainer.tier ?? 'starter';
    const { maxClients, name } = TIERS[tier];
    // Light enforcement: two requests at the same moment could both pass. Fine for flat pricing.
    if ((await this.countActive(trainer._id)) >= maxClients) {
      const body: ClientLimitErrorBody = {
        statusCode: 403,
        code: 'CLIENT_LIMIT',
        message: `Your ${name} plan includes up to ${maxClients} clients. Switch plan to add more.`,
        limit: maxClients,
      };
      throw new ForbiddenException(body);
    }
    const client = await this.clients.create({
      ...input,
      trainerId: trainer._id,
      // A demo trainer's clients disappear together with the trainer.
      ...(trainer.expiresAt ? { expiresAt: trainer.expiresAt } : {}),
    });
    return toClientDto(client.toObject());
  }

  async update(trainer: RequestUser, id: Types.ObjectId, input: UpdateClientInput): Promise<ClientDto> {
    const client = await this.clients
      .findOneAndUpdate({ _id: id, trainerId: trainer._id }, { $set: input }, { new: true, runValidators: true })
      .lean();
    if (!client) throw new NotFoundException('Client not found');
    return toClientDto(client);
  }

  /** Archive, not delete: history stays, the client drops off the list and any open invite dies. */
  async archive(trainer: RequestUser, id: Types.ObjectId): Promise<void> {
    const result = await this.clients.updateOne(
      { _id: id, trainerId: trainer._id },
      { $set: { archived: true }, $unset: { inviteTokenHash: 1, inviteExpiresAt: 1 } },
    );
    if (result.matchedCount === 0) throw new NotFoundException('Client not found');
  }

  /** A new one-time link. Creating another one replaces (kills) the previous link. */
  async createInvite(trainer: RequestUser, id: Types.ObjectId): Promise<InviteLinkDto> {
    const client = await this.findOwned(trainer, id);
    if (client.archived) throw new ConflictException('This client is archived');
    if (client.userId) throw new ConflictException('This client already has a login');

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    await this.clients.updateOne(
      { _id: client._id },
      { $set: { inviteTokenHash: hashToken(token), inviteExpiresAt: expiresAt } },
    );
    return { url: `${this.config.webOrigin}/invite/${token}`, expiresAt: expiresAt.toISOString() };
  }

  private async findByInvite(token: string): Promise<ClientLean> {
    const client = await this.clients
      .findOne({
        inviteTokenHash: hashToken(token),
        inviteExpiresAt: { $gt: new Date() },
        userId: { $exists: false },
        archived: false,
      })
      .lean();
    if (!client) throw new NotFoundException(INVALID_INVITE);
    return client;
  }

  async previewInvite(token: string): Promise<InvitePreviewDto> {
    const client = await this.findByInvite(token);
    const trainer = await this.users.findById(client.trainerId, { name: 1 }).lean();
    return { clientName: client.name, trainerName: trainer?.name ?? 'Your trainer' };
  }

  async acceptInvite(token: string, input: AcceptInviteInput): Promise<RequestUser> {
    const client = await this.findByInvite(token);

    let user;
    try {
      user = await this.users.create({
        email: input.email,
        passwordHash: await hashPassword(input.password),
        role: 'client',
        name: client.name,
        trainerId: client.trainerId,
        clientId: client._id,
        ...(client.expiresAt ? { expiresAt: client.expiresAt } : {}),
      });
    } catch (err) {
      if (err instanceof mongo.MongoServerError && err.code === 11000) {
        // The link stays valid, so the client can retry with another email.
        throw new ConflictException('An account with this email already exists');
      }
      throw err;
    }

    // Claim the invite atomically: only one accept can win, even if the link is opened twice at once.
    const claimed = await this.clients.updateOne(
      { _id: client._id, inviteTokenHash: client.inviteTokenHash, userId: { $exists: false } },
      { $set: { userId: user._id }, $unset: { inviteTokenHash: 1, inviteExpiresAt: 1 } },
    );
    if (claimed.modifiedCount === 0) {
      await this.users.deleteOne({ _id: user._id });
      throw new NotFoundException(INVALID_INVITE);
    }
    return toRequestUser(user.toObject());
  }
}
