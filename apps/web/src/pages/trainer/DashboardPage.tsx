import {
  ADHERENCE_LABELS,
  type AdherenceStatus,
  type DashboardClientDto,
  type DashboardDto,
  TIERS,
} from '@coachdesk/shared';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button, cx, EmptyState, ErrorState, LoadingRows, StatusChip } from '../../components/ui';
import { percent, timeAgo } from '../../lib/format';
import { useDashboard } from '../../lib/queries';
import { ClientFormModal } from './ClientFormModal';

/** Who needs attention comes first. */
const STATUS_ORDER: AdherenceStatus[] = ['behind', 'at-risk', 'no-data', 'no-plan', 'on-track'];

export function sortClients(clients: DashboardClientDto[]): DashboardClientDto[] {
  return [...clients].sort(
    (a, b) =>
      STATUS_ORDER.indexOf(a.adherence.status) - STATUS_ORDER.indexOf(b.adherence.status) ||
      a.name.localeCompare(b.name),
  );
}

export function DashboardPage() {
  const dashboard = useDashboard();
  const [filter, setFilter] = useState<AdherenceStatus | 'all'>('all');
  const [adding, setAdding] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
          {dashboard.data && <CapacityLine data={dashboard.data} />}
        </div>
        <Button onClick={() => setAdding(true)}>Add client</Button>
      </div>

      {dashboard.isPending && <LoadingRows rows={4} label="Loading clients" />}
      {dashboard.isError && <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} />}
      {dashboard.data &&
        (dashboard.data.clients.length === 0 ? (
          <EmptyState
            title="No clients yet"
            text="Add your first client, give them a weekly plan, and send them an invite link."
            action={<Button onClick={() => setAdding(true)}>Add your first client</Button>}
          />
        ) : (
          <>
            <StatusFilter data={dashboard.data} value={filter} onChange={setFilter} />
            <ClientList
              clients={sortClients(dashboard.data.clients).filter(
                (c) => filter === 'all' || c.adherence.status === filter,
              )}
            />
          </>
        ))}

      {adding && <ClientFormModal onClose={() => setAdding(false)} />}
    </div>
  );
}

function CapacityLine({ data }: { data: DashboardDto }) {
  const count = data.clients.length;
  const tier = TIERS[data.tier].name;
  return (
    <p className="mt-1 text-sm text-ink-muted">
      {data.clientLimit === null ? (
        <>
          {count} client{count === 1 ? '' : 's'} · {tier} plan
        </>
      ) : (
        <>
          <span className={cx('font-medium', count >= data.clientLimit ? 'text-at-risk' : 'text-ink')}>
            {count} of {data.clientLimit} clients
          </span>{' '}
          · {tier} plan{' '}
          {count >= data.clientLimit && (
            <Link to="/pricing" className="font-medium text-accent hover:underline">
              Need more?
            </Link>
          )}
        </>
      )}
    </p>
  );
}

function StatusFilter({
  data,
  value,
  onChange,
}: {
  data: DashboardDto;
  value: AdherenceStatus | 'all';
  onChange: (value: AdherenceStatus | 'all') => void;
}) {
  const options: { id: AdherenceStatus | 'all'; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: data.clients.length },
    ...STATUS_ORDER.filter((s) => data.counts[s] > 0).map((s) => ({
      id: s,
      label: ADHERENCE_LABELS[s],
      count: data.counts[s],
    })),
  ];
  return (
    <div
      role="group"
      aria-label="Filter by status"
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
    >
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={cx(
            'min-h-10 shrink-0 rounded-full border px-4 text-sm font-medium transition',
            value === o.id
              ? 'border-ink bg-ink text-white'
              : 'border-line bg-card text-ink-muted hover:border-ink-faint hover:text-ink',
          )}
        >
          {o.label} <span className="tabular-nums opacity-70">{o.count}</span>
        </button>
      ))}
    </div>
  );
}

function ClientList({ clients }: { clients: DashboardClientDto[] }) {
  if (!clients.length) return <p className="py-8 text-center text-sm text-ink-muted">No clients with this status.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {clients.map((c) => (
        <li key={c.id}>
          <Link
            to={`/app/clients/${c.id}`}
            className="card flex flex-col gap-3 px-4 py-4 transition hover:border-ink-faint sm:flex-row sm:items-center sm:gap-6 sm:px-5"
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{c.name}</p>
              <p className="truncate text-sm text-ink-muted">{c.goals || 'No goals written yet'}</p>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-muted sm:justify-end">
              <span className="sm:w-56 sm:truncate">{c.planName ?? 'No plan'}</span>
              <span className="sm:w-36">
                {c.lastActivity ? `Active ${timeAgo(c.lastActivity)}` : <LoginState c={c} />}
              </span>
              <span className="sm:w-44 sm:text-right">
                <StatusChip
                  status={c.adherence.status}
                  detail={c.adherence.ratio !== null ? percent(c.adherence.ratio) : undefined}
                />
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function LoginState({ c }: { c: DashboardClientDto }) {
  if (c.hasLogin) return <>No activity yet</>;
  if (c.inviteExpiresAt) return <>Invite sent</>;
  return <>Not invited yet</>;
}
