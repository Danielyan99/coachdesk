import { EmptyState, ErrorState, FormError, Skeleton } from '../../components/ui';
import { useCheckOff, useToday } from '../../lib/clientQueries';
import { shortDate } from '../../lib/format';
import { useMe } from '../../lib/queries';
import { Checklist, doneCount, itemCount, ProgressRing } from './Checklist';

function greeting(): string {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

export function TodayPage() {
  const { data: me } = useMe();
  const today = useToday();
  const checkOff = useCheckOff();
  const firstName = me?.name.split(' ')[0] ?? '';

  if (today.isPending) {
    return (
      <div role="status" aria-label="Loading today" className="flex flex-col gap-4 pt-4">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-24" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    );
  }
  if (today.isError) return <ErrorState error={today.error} onRetry={() => void today.refetch()} />;

  const { today: day, trainerName, planName, planStartDate } = today.data;

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div>
        <p className="text-sm text-ink-muted">{day ? shortDate(day.date) : ''}</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {greeting()}
          {firstName && `, ${firstName}`}
        </h1>
      </div>

      {!day ? (
        <EmptyState
          title="Your plan is on its way"
          text={`${trainerName} hasn't set up your weekly plan yet. Check back soon.`}
        />
      ) : day.beforeStart ? (
        <EmptyState
          title={`Your plan starts ${shortDate(planStartDate!)}`}
          text={`${trainerName} has prepared "${planName}" for you. You can look at the whole week in the Week tab.`}
        />
      ) : (
        <>
          <div className="card px-5 py-4">
            <ProgressRing done={doneCount(day)} total={itemCount(day)} />
          </div>
          <FormError message={checkOff.error ? `Couldn't save that: ${checkOff.error.message}` : null} />
          <Checklist
            day={day}
            editable
            onToggle={(itemId, done) => checkOff.mutate({ date: day.date, itemId, done })}
          />
          <p className="text-center text-xs text-ink-muted">
            Plan by {trainerName} · {planName}
          </p>
        </>
      )}
    </div>
  );
}
