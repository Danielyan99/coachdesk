import type { ClientDayDto, TodayDto, WeekDto } from '@coachdesk/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

// Not under ['me', ...]: that key is the logged-in user, and logging in as someone else must drop these.
export const clientKeys = {
  today: ['client-today'] as const,
  week: ['client-week'] as const,
};

export function useToday() {
  return useQuery({ queryKey: clientKeys.today, queryFn: () => api<TodayDto>('/me/today') });
}

export function useWeek() {
  return useQuery({ queryKey: clientKeys.week, queryFn: () => api<WeekDto>('/me/week') });
}

export interface CheckOff {
  date: string;
  itemId: string;
  done: boolean;
}

function toggleDay(day: ClientDayDto, { date, itemId, done }: CheckOff): ClientDayDto {
  if (day.date !== date) return day;
  const without = day.done.filter((id) => id !== itemId);
  return { ...day, done: done ? [...without, itemId] : without };
}

/**
 * Checks or unchecks an item with an optimistic update: the tick shows at once, before the server answers.
 * If the request fails, both views roll back to what they were and the error is returned to the caller.
 */
export function useCheckOff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ date, itemId, done }: CheckOff) =>
      api<void>(`/me/checkins/${date}/${encodeURIComponent(itemId)}`, { method: done ? 'PUT' : 'DELETE' }),
    onMutate: async (change) => {
      await Promise.all([
        qc.cancelQueries({ queryKey: clientKeys.today }),
        qc.cancelQueries({ queryKey: clientKeys.week }),
      ]);
      const previous = {
        today: qc.getQueryData<TodayDto>(clientKeys.today),
        week: qc.getQueryData<WeekDto>(clientKeys.week),
      };
      qc.setQueryData<TodayDto>(clientKeys.today, (old) =>
        old?.today ? { ...old, today: toggleDay(old.today, change) } : old,
      );
      qc.setQueryData<WeekDto>(clientKeys.week, (old) =>
        old ? { ...old, days: old.days.map((d) => toggleDay(d, change)) } : old,
      );
      return previous;
    },
    onError: (_err, _change, previous) => {
      qc.setQueryData(clientKeys.today, previous?.today);
      qc.setQueryData(clientKeys.week, previous?.week);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: clientKeys.today });
      void qc.invalidateQueries({ queryKey: clientKeys.week });
    },
  });
}
