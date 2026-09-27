import { type ClientDto, type ClientPlanDto, clientPlanSchema, emptyWeek, type PlanDay } from '@coachdesk/shared';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Button, Card, ErrorState, Field, FormError, Input, Skeleton } from '../../components/ui';
import { WeekEditor } from '../../components/WeekEditor';
import { localToday } from '../../lib/format';
import { useClient, useClientPlan, useSavePlan } from '../../lib/queries';
import { useUnsavedWarning } from '../../lib/useUnsavedWarning';
import { dayErrors, type FormErrors, serverErrors, validate } from '../../lib/validation';

/** Edits one client's own copy of their plan (never the template it came from). */
export function PlanEditorPage() {
  const { id = '' } = useParams();
  const client = useClient(id);
  const plan = useClientPlan(id);

  if (client.isPending || plan.isPending) return <Skeleton className="h-96" />;
  if (client.isError) return <ErrorState error={client.error} onRetry={() => void client.refetch()} />;
  if (plan.isError) return <ErrorState error={plan.error} onRetry={() => void plan.refetch()} />;
  return <PlanForm client={client.data} plan={plan.data} />;
}

function PlanForm({ client, plan }: { client: ClientDto; plan: ClientPlanDto | null }) {
  const navigate = useNavigate();
  const save = useSavePlan(client.id);
  const [name, setName] = useState(plan?.name ?? `${client.name.split(' ')[0]}'s plan`);
  const [startDate, setStartDate] = useState(plan?.startDate ?? localToday());
  const [days, setDays] = useState<PlanDay[]>(plan?.days ?? emptyWeek());
  const [errors, setErrors] = useState<FormErrors>({});
  const [dirty, setDirty] = useState(false);
  useUnsavedWarning(dirty);

  const edit =
    <T,>(setter: (v: T) => void) =>
    (value: T) => {
      setter(value);
      setDirty(true);
    };

  const onSave = (e: React.FormEvent) => {
    e.preventDefault();
    const result = validate(clientPlanSchema, { name, startDate, days });
    if (result.errors) return setErrors(result.errors);
    setErrors({});
    save.mutate(result.data, {
      onSuccess: () => {
        setDirty(false);
        navigate(`/app/clients/${client.id}`);
      },
      onError: (err) => setErrors(serverErrors(err) ?? {}),
    });
  };

  const errorCount = Object.keys(errors).length;

  return (
    <form onSubmit={onSave} noValidate className="flex flex-col gap-6">
      <div>
        <Link to={`/app/clients/${client.id}`} className="text-sm font-medium text-ink-muted hover:text-ink">
          ← {client.name}
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{plan ? 'Edit plan' : 'New plan'}</h1>
            <p className="mt-1 text-sm text-ink-muted">
              Changes here are only for {client.name.split(' ')[0]}. Your templates stay the same.
            </p>
          </div>
          <Button type="submit" loading={save.isPending}>
            Save plan
          </Button>
        </div>
      </div>

      {errorCount > 0 && (
        <FormError
          message={`Please fix ${errorCount} field${errorCount === 1 ? '' : 's'}. Days with problems have a red dot.`}
        />
      )}
      <FormError message={save.error && !serverErrors(save.error) ? save.error.message : null} />

      <Card className="grid gap-4 p-5 sm:grid-cols-2">
        <Field label="Plan name" error={errors.name}>
          {(a) => <Input {...a} value={name} onChange={(e) => edit(setName)(e.target.value)} />}
        </Field>
        <Field
          label="Start date"
          error={errors.startDate}
          hint="Check-offs and the on-track status count from this day."
        >
          {(a) => <Input {...a} type="date" value={startDate} onChange={(e) => edit(setStartDate)(e.target.value)} />}
        </Field>
      </Card>

      <Card className="p-4 sm:p-5">
        <WeekEditor days={days} onChange={edit(setDays)} errors={dayErrors(errors)} />
      </Card>
    </form>
  );
}
