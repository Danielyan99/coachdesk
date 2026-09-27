import type { TodayDto } from '@coachdesk/shared';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TodayPage } from '../pages/client/TodayPage';
import { mockApi, renderPage } from './utils';

const DATE = '2026-09-28';

function todayDto(done: string[] = []): TodayDto {
  return {
    trainerName: 'Coach Kim',
    planName: 'Base plan',
    planStartDate: '2026-09-01',
    editableDates: ['2026-09-27', DATE],
    today: {
      date: DATE,
      weekday: 0,
      beforeStart: false,
      done,
      workout: {
        title: 'Legs',
        exercises: [
          { id: 'ex-1', name: 'Squat', sets: 3, reps: '8-10', restSec: 90 },
          { id: 'ex-2', name: 'Lunge', sets: 3, reps: '12' },
        ],
      },
      meals: [{ id: 'meal-1', name: 'Breakfast', time: '08:00', description: 'Oats', kcal: 450 }],
    },
  };
}

const me = () => ({ id: 'u1', email: 'sam@x.io', name: 'Sam Lee', role: 'client', clientId: 'c1', demo: false });

describe('TodayPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows the day with progress, workout details and meals', async () => {
    mockApi({ 'GET /api/auth/me': me, 'GET /api/me/today': () => todayDto(['meal-1']) });
    renderPage(<TodayPage />);

    expect(await screen.findByRole('img', { name: '1 of 3 done' })).toBeInTheDocument();
    expect(screen.getByText('3 × 8-10 · 90 s rest')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Breakfast/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Squat/ })).not.toBeChecked();
  });

  it('checking an item updates progress at once, before the server answers', async () => {
    let finishPut: () => void = () => undefined;
    let serverDone: string[] = [];
    const fetchMock = mockApi({
      'GET /api/auth/me': me,
      'GET /api/me/today': () => todayDto(serverDone),
      [`PUT /api/me/checkins/${DATE}/ex-1`]: () => ({ status: 204 }),
    });
    // Hold the PUT until the test lets it finish.
    const realFetch = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        await new Promise<void>((resolve) => (finishPut = resolve));
        serverDone = ['ex-1'];
      }
      return realFetch(url, init);
    });

    renderPage(<TodayPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('checkbox', { name: /Squat/ }));

    // Optimistic: already ticked and counted while the request is still pending.
    expect(screen.getByRole('checkbox', { name: /Squat/ })).toBeChecked();
    expect(screen.getByRole('img', { name: '1 of 3 done' })).toBeInTheDocument();

    finishPut();
    expect(await screen.findByRole('img', { name: '1 of 3 done' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(`/api/me/checkins/${DATE}/ex-1`, expect.objectContaining({ method: 'PUT' }));
  });

  it('rolls back and explains when saving fails', async () => {
    mockApi({
      'GET /api/auth/me': me,
      'GET /api/me/today': () => todayDto(),
      [`PUT /api/me/checkins/${DATE}/ex-2`]: () => ({ status: 500, body: { message: 'Server error' } }),
    });
    renderPage(<TodayPage />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('checkbox', { name: /Lunge/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't save that: Server error");
    expect(screen.getByRole('checkbox', { name: /Lunge/ })).not.toBeChecked();
    expect(screen.getByRole('img', { name: '0 of 3 done' })).toBeInTheDocument();
  });

  it('unchecking sends DELETE', async () => {
    const fetchMock = mockApi({
      'GET /api/auth/me': me,
      'GET /api/me/today': () => todayDto(['meal-1']),
      [`DELETE /api/me/checkins/${DATE}/meal-1`]: () => ({ status: 204 }),
    });
    renderPage(<TodayPage />);
    await userEvent.setup().click(await screen.findByRole('checkbox', { name: /Breakfast/ }));
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/me/checkins/${DATE}/meal-1`,
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('tells the client when the plan has not started or does not exist', async () => {
    const future = todayDto();
    future.today!.beforeStart = true;
    future.planStartDate = '2026-10-05';
    mockApi({ 'GET /api/auth/me': me, 'GET /api/me/today': () => future });
    const { unmount } = renderPage(<TodayPage />);
    expect(await screen.findByText('Your plan starts Mon, Oct 5')).toBeInTheDocument();
    unmount();

    mockApi({ 'GET /api/auth/me': me, 'GET /api/me/today': () => ({ ...todayDto(), today: null, planName: null }) });
    renderPage(<TodayPage />);
    expect(await screen.findByText('Your plan is on its way')).toBeInTheDocument();
  });
});
