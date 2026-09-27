import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  ADHERENCE_STATUSES,
  ADHERENCE_WINDOW_DAYS,
  type AdherenceDto,
  type AdherenceStatus,
  type ClientDayDto,
  type DashboardDto,
  type ItemType,
  type PlanDay,
  type TodayDto,
  TIERS,
  type WeekDto,
} from '@coachdesk/shared';
import { Model, mongo, type Types } from 'mongoose';
import type { RequestUser } from '../auth/request-user';
import { Client } from '../clients/client.schema';
import { ClientsService } from '../clients/clients.service';
import { ClientPlan } from '../plans/client-plan.schema';
import { PlansService } from '../plans/plans.service';
import { User } from '../users/user.schema';
import { computeAdherence } from './adherence';
import { CheckIn } from './check-in.schema';
import { addDays, mondayOf, todayIn, weekdayOf } from './dates';

type ClientLean = Client & { _id: Types.ObjectId };
type PlanLean = ClientPlan & { _id: Types.ObjectId };

@Injectable()
export class ProgressService {
  constructor(
    @InjectModel(CheckIn.name) private readonly checkIns: Model<CheckIn>,
    @InjectModel(Client.name) private readonly clients: Model<Client>,
    @InjectModel(ClientPlan.name) private readonly plans: Model<ClientPlan>,
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly clientsService: ClientsService,
    private readonly plansService: PlansService,
  ) {}

  // ---------- Client side ----------

  async getToday(user: RequestUser): Promise<TodayDto> {
    const { client, plan, today } = await this.clientContext(user);
    const trainer = await this.users.findById(client.trainerId, { name: 1 }).lean();
    const done = plan ? await this.doneByDate(client._id, [today]) : new Map<string, string[]>();
    return {
      trainerName: trainer?.name ?? 'Your trainer',
      planName: plan?.name ?? null,
      planStartDate: plan?.startDate ?? null,
      editableDates: editableDates(today),
      today: plan ? dayView(plan, today, done) : null,
    };
  }

  async getWeek(user: RequestUser): Promise<WeekDto> {
    const { client, plan, today } = await this.clientContext(user);
    const monday = mondayOf(today);
    const dates = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
    const done = plan ? await this.doneByDate(client._id, dates) : new Map<string, string[]>();
    return {
      planName: plan?.name ?? null,
      planStartDate: plan?.startDate ?? null,
      today,
      editableDates: editableDates(today),
      days: plan ? dates.map((date) => dayView(plan, date, done)) : [],
    };
  }

  async check(user: RequestUser, date: string, itemId: string): Promise<void> {
    const { client, plan, itemType } = await this.editableItem(user, date, itemId);
    try {
      await this.checkIns.updateOne(
        { clientId: client._id, date, itemId },
        {
          $setOnInsert: {
            planId: plan._id,
            itemType,
            completedAt: new Date(),
            ...(client.expiresAt ? { expiresAt: client.expiresAt } : {}),
          },
        },
        { upsert: true },
      );
    } catch (err) {
      // Two taps at the same moment: the unique index lets one insert win, the other is already done.
      if (!(err instanceof mongo.MongoServerError && err.code === 11000)) throw err;
    }
  }

  async uncheck(user: RequestUser, date: string, itemId: string): Promise<void> {
    const { client } = await this.editableItem(user, date, itemId);
    await this.checkIns.deleteOne({ clientId: client._id, date, itemId });
  }

  // ---------- Trainer side ----------

  async adherenceFor(trainer: RequestUser, clientId: Types.ObjectId): Promise<AdherenceDto> {
    const client = await this.clientsService.findOwned(trainer, clientId);
    const plan = await this.plansService.findActive(client._id);
    const today = todayIn(client.timezone);
    const checkIns = await this.checkIns
      .find({ clientId: client._id, date: { $gte: addDays(today, -ADHERENCE_WINDOW_DAYS), $lte: today } })
      .select({ date: 1, itemId: 1 })
      .lean();
    return computeAdherence({ plan, checkIns, today });
  }

  /** The trainer home screen in one call: 3 queries for all clients together, no query per client. */
  async dashboard(trainer: RequestUser): Promise<DashboardDto> {
    const clients = await this.clients.find({ trainerId: trainer._id, archived: false }).sort({ name: 1 }).lean();
    const ids = clients.map((c) => c._id);

    // Clients can be in different time zones (up to 26 hours apart), so fetch a slightly wider range
    // of dates and let computeAdherence pick each client's own window.
    const earliest = addDays(todayIn('UTC'), -(ADHERENCE_WINDOW_DAYS + 1));
    const [plans, checkIns, lastActivity] = await Promise.all([
      this.plans.find({ clientId: { $in: ids }, active: true }).lean(),
      this.checkIns
        .find({ clientId: { $in: ids }, date: { $gte: earliest } })
        .select({ clientId: 1, date: 1, itemId: 1 })
        .lean(),
      this.checkIns.aggregate<{ _id: Types.ObjectId; last: Date }>([
        { $match: { clientId: { $in: ids } } },
        { $group: { _id: '$clientId', last: { $max: '$completedAt' } } },
      ]),
    ]);

    const planByClient = new Map(plans.map((p) => [p.clientId.toString(), p]));
    const checkInsByClient = groupBy(checkIns, (c) => c.clientId.toString());
    const lastByClient = new Map(lastActivity.map((a) => [a._id.toString(), a.last]));
    const counts = Object.fromEntries(ADHERENCE_STATUSES.map((s) => [s, 0])) as Record<AdherenceStatus, number>;

    const rows = clients.map((client) => {
      const id = client._id.toString();
      const plan = planByClient.get(id) ?? null;
      const { days, ...adherence } = computeAdherence({
        plan,
        checkIns: checkInsByClient.get(id) ?? [],
        today: todayIn(client.timezone),
      });
      void days;
      counts[adherence.status] += 1;
      const inviteOpen = !client.userId && client.inviteExpiresAt && client.inviteExpiresAt > new Date();
      return {
        id,
        name: client.name,
        goals: client.goals,
        hasLogin: Boolean(client.userId),
        inviteExpiresAt: inviteOpen ? client.inviteExpiresAt!.toISOString() : null,
        planName: plan?.name ?? null,
        adherence,
        lastActivity: lastByClient.get(id)?.toISOString() ?? null,
      };
    });

    const tier = trainer.tier ?? 'starter';
    const limit = TIERS[tier].maxClients;
    return { tier, clientLimit: Number.isFinite(limit) ? limit : null, clients: rows, counts };
  }

  // ---------- Helpers ----------

  /** The logged-in client's record, active plan and today's date in their time zone. */
  private async clientContext(
    user: RequestUser,
  ): Promise<{ client: ClientLean; plan: PlanLean | null; today: string }> {
    const client = user.clientObjectId ? await this.clients.findById(user.clientObjectId).lean() : null;
    if (!client) throw new NotFoundException('Client profile not found');
    if (client.archived) throw new ForbiddenException('Your trainer has closed this account');
    const plan = await this.plansService.findActive(client._id);
    return { client, plan, today: todayIn(client.timezone) };
  }

  /** Checks that `date` is today or yesterday and `itemId` is on the plan that day. */
  private async editableItem(user: RequestUser, date: string, itemId: string) {
    const { client, plan, today } = await this.clientContext(user);
    if (!editableDates(today).includes(date)) {
      throw new ForbiddenException('You can only check off items for today or yesterday');
    }
    if (!plan) throw new NotFoundException('You have no plan yet');
    if (date < plan.startDate) throw new ConflictException(`Your plan starts on ${plan.startDate}`);

    const day = plan.days[weekdayOf(date)] as PlanDay;
    const itemType: ItemType | undefined = day.workout?.exercises.some((e) => e.id === itemId)
      ? 'exercise'
      : day.meals.some((m) => m.id === itemId)
        ? 'meal'
        : undefined;
    if (!itemType) throw new NotFoundException('This item is not on your plan for that day');
    return { client, plan, itemType };
  }

  private async doneByDate(clientId: Types.ObjectId, dates: string[]): Promise<Map<string, string[]>> {
    const rows = await this.checkIns
      .find({ clientId, date: { $in: dates } })
      .select({ date: 1, itemId: 1 })
      .lean();
    const map = new Map<string, string[]>();
    for (const r of rows) map.set(r.date, [...(map.get(r.date) ?? []), r.itemId]);
    return map;
  }
}

/** Yesterday stays editable, for "I did it but forgot to tick it". Older history is fixed. */
function editableDates(today: string): string[] {
  return [addDays(today, -1), today];
}

function dayView(plan: PlanLean, date: string, done: Map<string, string[]>): ClientDayDto {
  const weekday = weekdayOf(date);
  const day = plan.days[weekday] as PlanDay;
  const beforeStart = date < plan.startDate;
  return {
    date,
    weekday,
    workout: day.workout ?? null,
    meals: day.meals,
    done: beforeStart ? [] : (done.get(date) ?? []),
    beforeStart,
  };
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(item);
  }
  return map;
}
