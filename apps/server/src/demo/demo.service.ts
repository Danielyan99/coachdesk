import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { PlanDay } from '@coachdesk/shared';
import { createHash, randomBytes } from 'node:crypto';
import { Model, Types } from 'mongoose';
import { hashPassword } from '../auth/password';
import { type RequestUser, toRequestUser } from '../auth/request-user';
import { Client } from '../clients/client.schema';
import { INVITE_TTL_MS } from '../clients/clients.service';
import { ClientPlan } from '../plans/client-plan.schema';
import { CheckIn } from '../progress/check-in.schema';
import { Template } from '../templates/template.schema';
import { User } from '../users/user.schema';
import { DEMO_CLIENTS, DEMO_TEMPLATES, demoCheckIns, demoPlanStart } from './demo-data';

export const DEMO_TTL_MS = 24 * 60 * 60 * 1000;

type UserSeed = User & { _id: Types.ObjectId };

export interface SandboxOptions {
  /** Everything is deleted by MongoDB TTL indexes at this time. Omit for a permanent seed. */
  expiresAt?: Date;
  /** Fixed logins for `npm run seed`; demo sandboxes get random emails and unusable passwords. */
  trainerEmail?: string;
  clientEmail?: string;
  password?: string;
}

export interface Sandbox {
  trainer: RequestUser;
  /** The client "Try as a client" logs in as (Ana, on track, with history). */
  client: RequestUser;
}

/**
 * Builds a complete, private copy of the demo data (one trainer, 8 clients, 3 templates, plans, ~2.5 weeks of
 * check-ins) with bulk inserts. Every document carries `expiresAt`, so the whole sandbox disappears together.
 */
@Injectable()
export class DemoService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(Client.name) private readonly clients: Model<Client>,
    @InjectModel(Template.name) private readonly templates: Model<Template>,
    @InjectModel(ClientPlan.name) private readonly plans: Model<ClientPlan>,
    @InjectModel(CheckIn.name) private readonly checkIns: Model<CheckIn>,
  ) {}

  /** Demo sandboxes started in the last hour (one demo trainer each). */
  sandboxesInLastHour(): Promise<number> {
    return this.users.countDocuments({
      role: 'trainer',
      expiresAt: { $exists: true },
      createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
    });
  }

  async createSandbox(options: SandboxOptions = {}): Promise<Sandbox> {
    const now = new Date();
    const tag = randomBytes(6).toString('hex');
    const expiry = options.expiresAt ? { expiresAt: options.expiresAt } : {};
    // Lean bulk inserts skip Mongoose's automatic timestamps, so set them here.
    const stamps = { createdAt: now, updatedAt: now };
    // A random password nobody knows: demo accounts are only reachable through the demo cookie.
    const passwordHash = await hashPassword(options.password ?? randomBytes(24).toString('hex'));

    const trainerId = new Types.ObjectId();
    const trainer: UserSeed = {
      _id: trainerId,
      email: options.trainerEmail ?? `trainer.${tag}@demo.coachdesk.app`,
      passwordHash,
      role: 'trainer',
      name: 'Alex Morgan',
      tier: 'pro',
      ...stamps,
      ...expiry,
    };

    const templateDays = new Map(DEMO_TEMPLATES.map((t) => [t.key, t.days()]));
    const templates = DEMO_TEMPLATES.map((t) => ({
      _id: new Types.ObjectId(),
      trainerId,
      name: t.name,
      description: t.description,
      days: templateDays.get(t.key)!,
      ...stamps,
      ...expiry,
    }));
    const templateIdByKey = new Map(DEMO_TEMPLATES.map((t, i) => [t.key, templates[i]._id]));

    const clientDocs: object[] = [];
    const clientUsers: UserSeed[] = [];
    const planDocs: object[] = [];
    const checkInDocs: object[] = [];

    for (const demo of DEMO_CLIENTS) {
      const clientId = new Types.ObjectId();
      const first = demo.name.split(' ')[0].toLowerCase();
      let userId: Types.ObjectId | undefined;
      if (demo.login) {
        userId = new Types.ObjectId();
        const isMain = clientUsers.length === 0;
        clientUsers.push({
          _id: userId,
          email: isMain && options.clientEmail ? options.clientEmail : `${first}.${tag}@demo.coachdesk.app`,
          passwordHash,
          role: 'client',
          name: demo.name,
          trainerId,
          clientId,
          ...stamps,
          ...expiry,
        });
      }
      clientDocs.push({
        _id: clientId,
        trainerId,
        name: demo.name,
        goals: demo.goals,
        notes: demo.notes,
        stats: demo.stats,
        timezone: demo.timezone,
        archived: false,
        ...(userId ? { userId } : {}),
        ...(demo.invited
          ? {
              // The link itself is never shown; the trainer sees "Invite sent" and can make a new one.
              inviteTokenHash: createHash('sha256').update(randomBytes(32)).digest('hex'),
              inviteExpiresAt: new Date(now.getTime() + INVITE_TTL_MS),
            }
          : {}),
        ...stamps,
        ...expiry,
      });

      if (!demo.template) continue;
      const days: PlanDay[] = structuredClone(templateDays.get(demo.template)!);
      demo.customize?.(days);
      const planId = new Types.ObjectId();
      const template = DEMO_TEMPLATES.find((t) => t.key === demo.template)!;
      planDocs.push({
        _id: planId,
        trainerId,
        clientId,
        sourceTemplateId: templateIdByKey.get(demo.template),
        name: demo.planName ?? template.name,
        startDate: demoPlanStart(demo, now),
        days,
        active: true,
        ...stamps,
        ...expiry,
      });
      for (const c of demoCheckIns(demo, days, now)) checkInDocs.push({ ...c, clientId, planId, ...expiry });
    }

    // Plain bulk inserts: the data is built and checked above (demo-data.spec.ts), so skip per-document validation.
    await this.users.insertMany([trainer, ...clientUsers], { lean: true });
    await Promise.all([
      this.templates.insertMany(templates, { lean: true }),
      this.clients.insertMany(clientDocs, { lean: true }),
      this.plans.insertMany(planDocs, { lean: true }),
      this.checkIns.insertMany(checkInDocs, { lean: true }),
    ]);

    return { trainer: toRequestUser(trainer), client: toRequestUser(clientUsers[0]) };
  }
}
