import type { AdherenceStatus } from '@coachdesk/shared';
import { computeAdherence } from '../progress/adherence';
import { todayIn } from '../progress/dates';
import { DEMO_CLIENTS, DEMO_TEMPLATES, demoCheckIns, demoPlanStart } from './demo-data';

const EXPECTED: Record<string, AdherenceStatus> = {
  'Ana Petrosyan': 'on-track',
  'Mark Chen': 'on-track',
  'Sofia Rossi': 'at-risk',
  'James Walker': 'at-risk',
  'Lena Müller': 'behind',
  'Omar Haddad': 'behind',
  'Nina Ivanova': 'no-data',
  'David Kim': 'no-plan',
};

function statusOf(name: string, now: Date): AdherenceStatus {
  const client = DEMO_CLIENTS.find((c) => c.name === name)!;
  if (!client.template)
    return computeAdherence({ plan: null, checkIns: [], today: todayIn(client.timezone, now) }).status;
  const days = DEMO_TEMPLATES.find((t) => t.key === client.template)!.days();
  client.customize?.(days);
  return computeAdherence({
    plan: { startDate: demoPlanStart(client, now), days },
    checkIns: demoCheckIns(client, days, now),
    today: todayIn(client.timezone, now),
  }).status;
}

describe('demo data', () => {
  // Every weekday and a few times of day: the demo must look the same whenever a recruiter opens it.
  const moments = Array.from(
    { length: 7 * 4 },
    (_, i) => new Date(Date.UTC(2026, 8, 28 + Math.floor(i / 4), (i % 4) * 6 + 1)),
  );

  it.each(Object.entries(EXPECTED))('%s is always %s', (name, expected) => {
    for (const now of moments)
      expect({ now: now.toISOString(), status: statusOf(name, now) }).toEqual({
        now: now.toISOString(),
        status: expected,
      });
  });

  it('covers every status', () => {
    expect(new Set(Object.values(EXPECTED))).toEqual(new Set(['on-track', 'at-risk', 'behind', 'no-data', 'no-plan']));
  });

  it('builds templates with 7 days and unique item ids', () => {
    for (const t of DEMO_TEMPLATES) {
      const days = t.days();
      expect(days).toHaveLength(7);
      const ids = days.flatMap((d) => [...(d.workout?.exercises ?? []), ...d.meals].map((x) => x.id));
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('never puts a check-in in the future', () => {
    const now = new Date('2026-10-01T06:00:00Z');
    for (const client of DEMO_CLIENTS.filter((c) => c.template)) {
      const days = DEMO_TEMPLATES.find((t) => t.key === client.template)!.days();
      for (const c of demoCheckIns(client, days, now)) {
        expect(c.completedAt.getTime()).toBeLessThanOrEqual(now.getTime());
        expect(c.date <= todayIn(client.timezone, now)).toBe(true);
      }
    }
  });
});
