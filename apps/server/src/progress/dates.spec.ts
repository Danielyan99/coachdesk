import { addDays, datesEndingWith, mondayOf, todayIn, weekdayOf } from './dates';

describe('todayIn', () => {
  it('uses the client time zone, not UTC', () => {
    // Sunday 22:30 UTC is already Monday 02:30 in Yerevan (UTC+4)...
    const now = new Date('2026-09-27T22:30:00Z');
    expect(todayIn('UTC', now)).toBe('2026-09-27');
    expect(todayIn('Asia/Yerevan', now)).toBe('2026-09-28');
    // ...and still Sunday afternoon in Los Angeles (UTC-7)
    expect(todayIn('America/Los_Angeles', now)).toBe('2026-09-27');
  });

  it('is behind UTC early in the UTC day for the Americas', () => {
    const now = new Date('2026-09-28T03:00:00Z');
    expect(todayIn('America/Los_Angeles', now)).toBe('2026-09-27');
    expect(todayIn('Asia/Tokyo', now)).toBe('2026-09-28');
  });

  it('handles the daylight saving switch (Berlin, last Sunday of October)', () => {
    // 2026-10-25 01:30 UTC: clocks in Berlin went back at 01:00 UTC, so it is 02:30 local, same day.
    expect(todayIn('Europe/Berlin', new Date('2026-10-25T01:30:00Z'))).toBe('2026-10-25');
    // 22:59 UTC is 23:59 local after the switch (UTC+1), still the 25th; one minute later it is the 26th.
    expect(todayIn('Europe/Berlin', new Date('2026-10-25T22:59:00Z'))).toBe('2026-10-25');
    expect(todayIn('Europe/Berlin', new Date('2026-10-25T23:00:00Z'))).toBe('2026-10-26');
  });

  it('handles a half-hour zone and the date line', () => {
    const now = new Date('2026-09-27T18:45:00Z');
    expect(todayIn('Asia/Kolkata', now)).toBe('2026-09-28'); // UTC+5:30, 00:15 local
    expect(todayIn('Pacific/Kiritimati', new Date('2026-09-27T10:00:00Z'))).toBe('2026-09-28'); // UTC+14
  });
});

describe('date helpers', () => {
  it('adds days across months and years', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('numbers weekdays from Monday = 0', () => {
    expect(weekdayOf('2026-09-28')).toBe(0); // Monday
    expect(weekdayOf('2026-09-27')).toBe(6); // Sunday
  });

  it('finds the Monday of a week', () => {
    expect(mondayOf('2026-09-27')).toBe('2026-09-21');
    expect(mondayOf('2026-09-28')).toBe('2026-09-28');
  });

  it('lists dates ending with a day', () => {
    expect(datesEndingWith('2026-10-02', 3)).toEqual(['2026-09-30', '2026-10-01', '2026-10-02']);
  });
});
