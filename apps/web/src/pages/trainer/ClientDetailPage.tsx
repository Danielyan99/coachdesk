import { type AdherenceDto, type ClientDto, type ClientPlanDto, DAY_NAMES } from '@coachdesk/shared';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Button, buttonClass, Card, cx, ErrorState, Input, Modal, Skeleton, StatusChip } from '../../components/ui';
import { percent, plural, shortDate, weekdayShort } from '../../lib/format';
import { useAdherence, useArchiveClient, useClient, useClientPlan, useCreateInvite } from '../../lib/queries';
import { AssignTemplateModal } from './AssignTemplateModal';
import { ClientFormModal } from './ClientFormModal';

export function ClientDetailPage() {
  const { id = '' } = useParams();
  const client = useClient(id);
  const [editing, setEditing] = useState(false);
  const [archiving, setArchiving] = useState(false);

  if (client.isPending) return <DetailSkeleton />;
  if (client.isError) return <ErrorState error={client.error} onRetry={() => void client.refetch()} />;
  const c = client.data;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/app" className="text-sm font-medium text-ink-muted hover:text-ink">
          ← All clients
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{c.name}</h1>
          {!c.archived && (
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                Edit profile
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setArchiving(true)}>
                Archive
              </Button>
            </div>
          )}
        </div>
        {c.archived && (
          <p className="mt-3 rounded-xl bg-ink/5 px-3 py-2 text-sm text-ink-muted">
            This client is archived. Their history is kept, but they can no longer log in.
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <AdherenceCard clientId={c.id} />
          <PlanCard client={c} />
        </div>
        <div className="flex flex-col gap-6">
          {!c.archived && <LoginCard client={c} />}
          <ProfileCard client={c} />
        </div>
      </div>

      {editing && <ClientFormModal client={c} onClose={() => setEditing(false)} />}
      {archiving && <ArchiveModal client={c} onClose={() => setArchiving(false)} />}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div role="status" aria-label="Loading client" className="flex flex-col gap-6">
      <Skeleton className="h-10 w-64" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-64 lg:col-span-2" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}

function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold">{children}</h2>
      {action}
    </div>
  );
}

// ---------- Adherence ----------

function AdherenceCard({ clientId }: { clientId: string }) {
  const adherence = useAdherence(clientId);
  return (
    <Card className="p-5">
      <SectionTitle
        action={
          adherence.data && (
            <StatusChip
              status={adherence.data.status}
              detail={adherence.data.ratio !== null ? percent(adherence.data.ratio) : undefined}
            />
          )
        }
      >
        Last 7 days
      </SectionTitle>
      {adherence.isPending && <Skeleton className="h-28" />}
      {adherence.isError && <p className="text-sm text-behind">{adherence.error.message}</p>}
      {adherence.data && <AdherenceBars data={adherence.data} />}
    </Card>
  );
}

export function AdherenceBars({ data }: { data: AdherenceDto }) {
  if (data.status === 'no-plan') {
    return <p className="text-sm text-ink-muted">No plan yet. Assign a template to start tracking.</p>;
  }
  return (
    <>
      <ol className="grid grid-cols-7 gap-2" aria-label="Done items per day">
        {data.days.map((d) => {
          const ratio = d.planned ? d.done / d.planned : 0;
          const label = d.beforeStart
            ? 'before the plan started'
            : d.isToday
              ? `${d.done} of ${d.planned} done so far`
              : d.planned
                ? `${d.done} of ${d.planned} done`
                : 'rest day';
          return (
            <li key={d.date} className="flex flex-col items-center gap-1.5">
              <div
                className={cx(
                  'relative flex h-20 w-full items-end overflow-hidden rounded-lg',
                  d.beforeStart ? 'bg-ink/[0.03]' : 'bg-ink/[0.06]',
                  d.isToday && 'ring-2 ring-accent/40',
                )}
                title={`${shortDate(d.date)}: ${label}`}
              >
                {!d.beforeStart && d.planned > 0 && (
                  <div
                    className={cx(
                      'w-full rounded-lg',
                      // Today is still in progress: neutral colour, not a verdict.
                      d.isToday
                        ? 'bg-accent/60'
                        : ratio >= 0.8
                          ? 'bg-on-track'
                          : ratio >= 0.5
                            ? 'bg-at-risk'
                            : 'bg-behind',
                    )}
                    style={{ height: `${Math.max(ratio * 100, 4)}%` }}
                  />
                )}
              </div>
              <span className={cx('text-xs', d.isToday ? 'font-semibold text-ink' : 'text-ink-muted')}>
                {d.isToday ? 'Today' : weekdayShort(d.date)}
              </span>
              <span className="sr-only">
                {shortDate(d.date)}: {label}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-4 text-sm text-ink-muted">
        {data.status === 'no-data'
          ? 'Nothing to measure yet. The plan just started.'
          : `${data.done} of ${data.scheduled} planned items done. Today counts only what is already done.`}
      </p>
    </>
  );
}

// ---------- Plan ----------

function PlanCard({ client }: { client: ClientDto }) {
  const plan = useClientPlan(client.id);
  const [assigning, setAssigning] = useState(false);

  return (
    <Card className="p-5">
      <SectionTitle
        action={
          plan.data &&
          !client.archived && (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setAssigning(true)}>
                Use a template
              </Button>
              <Link to={`/app/clients/${client.id}/plan`} className={buttonClass('secondary', 'sm')}>
                Edit plan
              </Link>
            </div>
          )
        }
      >
        Weekly plan
      </SectionTitle>
      {plan.isPending && <Skeleton className="h-48" />}
      {plan.isError && <p className="text-sm text-behind">{plan.error.message}</p>}
      {plan.isSuccess &&
        (plan.data ? (
          <PlanOverview plan={plan.data} />
        ) : (
          <div className="flex flex-col items-start gap-3 rounded-xl bg-ink/[0.03] p-4">
            <p className="text-sm text-ink-muted">
              {client.name.split(' ')[0]} has no plan yet. Start from one of your templates or build one just for them.
            </p>
            {!client.archived && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setAssigning(true)}>
                  Assign a template
                </Button>
                <Link to={`/app/clients/${client.id}/plan`} className={buttonClass('secondary', 'sm')}>
                  Build from scratch
                </Link>
              </div>
            )}
          </div>
        ))}
      {assigning && <AssignTemplateModal clientId={client.id} onClose={() => setAssigning(false)} />}
    </Card>
  );
}

function PlanOverview({ plan }: { plan: ClientPlanDto }) {
  return (
    <div>
      <p className="font-medium">{plan.name}</p>
      <p className="text-sm text-ink-muted">Started {shortDate(plan.startDate)}</p>
      <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
        {plan.days.map((day, i) => (
          <li key={DAY_NAMES[i]} className="flex items-baseline gap-3 px-3 py-2.5 text-sm">
            <span className="w-10 shrink-0 font-medium text-ink-muted">{DAY_NAMES[i].slice(0, 3)}</span>
            <span className="min-w-0 flex-1 truncate">
              {day.workout ? (
                <>
                  <span className="font-medium">{day.workout.title}</span>
                  <span className="text-ink-muted"> · {plural(day.workout.exercises.length, 'exercise')}</span>
                </>
              ) : (
                <span className="text-ink-muted">Rest day</span>
              )}
            </span>
            <span className="shrink-0 text-ink-muted">{plural(day.meals.length, 'meal')}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- Login / invite ----------

function LoginCard({ client }: { client: ClientDto }) {
  const invite = useCreateInvite(client.id);
  const [copied, setCopied] = useState(false);

  if (client.hasLogin) {
    return (
      <Card className="p-5">
        <SectionTitle>Client login</SectionTitle>
        <p className="text-sm text-ink-muted">
          <span className="font-medium text-on-track">✓ Active.</span> {client.name.split(' ')[0]} logs in to see
          today's plan and check items off.
        </p>
      </Card>
    );
  }

  const link = invite.data;
  const copy = async () => {
    if (!link) return;
    await navigator.clipboard?.writeText(link.url).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="p-5">
      <SectionTitle>Client login</SectionTitle>
      {link ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-muted">
            Send this link to {client.name.split(' ')[0]}. It works once, until {shortDate(link.expiresAt.slice(0, 10))}
            .
          </p>
          <Input readOnly value={link.url} aria-label="Invite link" onFocus={(e) => e.currentTarget.select()} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void copy()}>
              {copied ? 'Copied!' : 'Copy link'}
            </Button>
            <a
              className={buttonClass('secondary', 'sm')}
              href={`https://wa.me/?text=${encodeURIComponent(`Your training plan is ready on Coachdesk: ${link.url}`)}`}
              target="_blank"
              rel="noreferrer"
            >
              Share on WhatsApp
            </a>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-ink-muted">
            {client.inviteExpiresAt
              ? `An invite link is open until ${shortDate(client.inviteExpiresAt.slice(0, 10))}. A new link replaces it.`
              : `${client.name.split(' ')[0]} can't log in yet. Create a one-time link and send it on WhatsApp or email.`}
          </p>
          {invite.error && <p className="text-sm text-behind">{invite.error.message}</p>}
          <Button
            size="sm"
            variant={client.inviteExpiresAt ? 'secondary' : 'primary'}
            loading={invite.isPending}
            onClick={() => invite.mutate()}
          >
            {client.inviteExpiresAt ? 'Create a new link' : 'Create invite link'}
          </Button>
        </div>
      )}
    </Card>
  );
}

// ---------- Profile ----------

function ProfileCard({ client }: { client: ClientDto }) {
  const { weightKg, heightCm, bodyFatPct } = client.stats;
  const stats = [
    ['Weight', weightKg != null ? `${weightKg} kg` : null],
    ['Height', heightCm != null ? `${heightCm} cm` : null],
    ['Body fat', bodyFatPct != null ? `${bodyFatPct}%` : null],
  ] as const;
  return (
    <Card className="p-5">
      <SectionTitle>Profile</SectionTitle>
      <dl className="flex flex-col gap-4 text-sm">
        <div>
          <dt className="text-ink-muted">Goals</dt>
          <dd className="mt-0.5 whitespace-pre-line">{client.goals || '–'}</dd>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {stats.map(([label, value]) => (
            <div key={label}>
              <dt className="text-ink-muted">{label}</dt>
              <dd className="mt-0.5 font-medium tabular-nums">{value ?? '–'}</dd>
            </div>
          ))}
        </div>
        <div>
          <dt className="text-ink-muted">Notes</dt>
          <dd className="mt-0.5 whitespace-pre-line">{client.notes || '–'}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Time zone</dt>
          <dd className="mt-0.5">{client.timezone.replaceAll('_', ' ')}</dd>
        </div>
      </dl>
    </Card>
  );
}

function ArchiveModal({ client, onClose }: { client: ClientDto; onClose: () => void }) {
  const archive = useArchiveClient(client.id);
  const navigate = useNavigate();
  return (
    <Modal title={`Archive ${client.name}?`} onClose={onClose}>
      <p className="text-sm text-ink-muted">
        They disappear from your client list and can no longer log in. Their plan and history are kept, and they no
        longer count toward your plan's client limit.
      </p>
      {archive.error && <p className="mt-3 text-sm text-behind">{archive.error.message}</p>}
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="danger"
          loading={archive.isPending}
          onClick={() => archive.mutate(undefined, { onSuccess: () => navigate('/app', { replace: true }) })}
        >
          Archive client
        </Button>
      </div>
    </Modal>
  );
}
