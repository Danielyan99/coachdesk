// Calendar dates as "YYYY-MM-DD" strings. A plain date has no time zone, which is exactly what a plan day is:
// "Monday" for a client in Yerevan starts at their midnight, not at UTC midnight.

const formatters = new Map<string, Intl.DateTimeFormat>();

/** The calendar date right now for someone in `timeZone` (IANA name). */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  let fmt = formatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
    formatters.set(timeZone, fmt);
  }
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function toUtc(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

export function addDays(date: string, days: number): string {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 0 = Monday ... 6 = Sunday (plan days use this order). */
export function weekdayOf(date: string): number {
  return (toUtc(date).getUTCDay() + 6) % 7;
}

/** The Monday of the week that contains `date`. */
export function mondayOf(date: string): string {
  return addDays(date, -weekdayOf(date));
}

/** `count` consecutive dates ending with `last`, oldest first. */
export function datesEndingWith(last: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(last, i - count + 1));
}
