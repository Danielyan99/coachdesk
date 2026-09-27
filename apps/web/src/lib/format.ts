import { type PlanDay } from '@coachdesk/shared';

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/** "just now", "3 hours ago", "yesterday", "5 days ago". */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const seconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return 'just now';
  if (abs < 3600) return relative.format(Math.round(seconds / 60), 'minute');
  if (abs < 86_400) return relative.format(Math.round(seconds / 3600), 'hour');
  if (abs < 30 * 86_400) return relative.format(Math.round(seconds / 86_400), 'day');
  return relative.format(Math.round(seconds / (30 * 86_400)), 'month');
}

/** "Mon, Sep 28" for a "YYYY-MM-DD" date (no time zone shift). */
export function shortDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

/** "Mon" */
export function weekdayShort(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
}

export function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

/** Today as "YYYY-MM-DD" in the browser's time zone (for form defaults only; the server decides "today"). */
export function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function percent(ratio: number | null): string {
  return ratio === null ? '–' : `${Math.round(ratio * 100)}%`;
}

/** "3 workouts · 14 meals" */
export function weekSummary(days: PlanDay[]): string {
  const workouts = days.filter((d) => d.workout).length;
  const meals = days.reduce((n, d) => n + d.meals.length, 0);
  return `${plural(workouts, 'workout')} · ${plural(meals, 'meal')}`;
}

export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

/** Every IANA zone the browser knows, plus UTC (Chrome leaves it out) and `current` if it is an older alias. */
export function allTimeZones(current?: string): string[] {
  const zones = new Set(Intl.supportedValuesOf?.('timeZone') ?? []);
  for (const extra of ['UTC', browserTimeZone(), current]) if (extra) zones.add(extra);
  return [...zones].sort((a, b) => (a === 'UTC' ? -1 : b === 'UTC' ? 1 : a.localeCompare(b)));
}

export function newId(): string {
  return crypto.randomUUID();
}
