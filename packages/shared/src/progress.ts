import type { ClientDto } from './clients';
import type { Tier } from './tiers';
import type { Workout, Meal } from './plans';

export const ADHERENCE_STATUSES = ['on-track', 'at-risk', 'behind', 'no-data', 'no-plan'] as const;
export type AdherenceStatus = (typeof ADHERENCE_STATUSES)[number];

/** Done / scheduled over the last 7 days: at least 80% is on track, at least 50% at risk, below that behind. */
export const ADHERENCE_THRESHOLDS = { onTrack: 0.8, atRisk: 0.5 } as const;
export const ADHERENCE_WINDOW_DAYS = 7;

export const ADHERENCE_LABELS: Record<AdherenceStatus, string> = {
  'on-track': 'On track',
  'at-risk': 'At risk',
  behind: 'Behind',
  'no-data': 'Just started',
  'no-plan': 'No plan',
};

export interface AdherenceDayDto {
  date: string;
  scheduled: number;
  done: number;
  /** The plan had not started yet on this day (not counted). */
  beforeStart: boolean;
  /** Today counts only in the client's favour: its open items are not "missed" yet. */
  isToday: boolean;
}

export interface AdherenceDto {
  status: AdherenceStatus;
  done: number;
  scheduled: number;
  /** 0..1, or null when nothing was scheduled. */
  ratio: number | null;
  /** Oldest first, ends with today. */
  days: AdherenceDayDto[];
}

export type ItemType = 'exercise' | 'meal';

export interface ClientDayDto {
  date: string;
  /** 0 = Monday. */
  weekday: number;
  workout: Workout | null;
  meals: Meal[];
  /** Item ids the client checked off on this date. */
  done: string[];
  /** Before the plan's start date: nothing to do yet. */
  beforeStart: boolean;
}

/** GET /me/today */
export interface TodayDto {
  trainerName: string;
  planName: string | null;
  planStartDate: string | null;
  /** Yesterday can still be checked off (for "I forgot to tick it last night"). */
  editableDates: string[];
  today: ClientDayDto | null;
}

/** GET /me/week: Monday to Sunday of the current week in the client's time zone. */
export interface WeekDto {
  planName: string | null;
  planStartDate: string | null;
  today: string;
  editableDates: string[];
  days: ClientDayDto[];
}

export interface DashboardClientDto extends Pick<ClientDto, 'id' | 'name' | 'goals' | 'hasLogin' | 'inviteExpiresAt'> {
  planName: string | null;
  adherence: Omit<AdherenceDto, 'days'>;
  /** Last check-off (ISO), or null. */
  lastActivity: string | null;
}

/** GET /dashboard: everything the trainer's home screen needs in one call. */
export interface DashboardDto {
  tier: Tier;
  clientLimit: number | null;
  clients: DashboardClientDto[];
  counts: Record<AdherenceStatus, number>;
}
