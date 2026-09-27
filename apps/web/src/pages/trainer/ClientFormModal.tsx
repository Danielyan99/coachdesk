import { type ClientDto, createClientSchema } from '@coachdesk/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { Button, Field, FormError, Input, Modal, Select, Textarea } from '../../components/ui';
import { ApiError, applyFieldErrors } from '../../lib/api';
import { allTimeZones, browserTimeZone } from '../../lib/format';
import { useCreateClient, useUpdateClient } from '../../lib/queries';

/** Empty input means "not known" (null), not 0. */
const optionalNumber = { setValueAs: (v: unknown) => (v === '' || v === null ? null : Number(v)) };

export function ClientFormModal({ client, onClose }: { client?: ClientDto; onClose: () => void }) {
  const navigate = useNavigate();
  const create = useCreateClient();
  const update = useUpdateClient(client?.id ?? '');
  const mutation = client ? update : create;
  const timeZones = useMemo(() => allTimeZones(client?.timezone), [client?.timezone]);

  const form = useForm({
    resolver: zodResolver(createClientSchema),
    defaultValues: {
      name: client?.name ?? '',
      goals: client?.goals ?? '',
      notes: client?.notes ?? '',
      timezone: client?.timezone ?? browserTimeZone(),
      stats: {
        weightKg: client?.stats.weightKg ?? null,
        heightCm: client?.stats.heightCm ?? null,
        bodyFatPct: client?.stats.bodyFatPct ?? null,
      },
    },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    const options = {
      onSuccess: (saved: ClientDto) => {
        onClose();
        if (!client) navigate(`/app/clients/${saved.id}`);
      },
      onError: (err: Error) => applyFieldErrors(err, form.setError),
    };
    if (client) update.mutate(values, options);
    else create.mutate(values, options);
  });

  const error = mutation.error;
  const atLimit = error instanceof ApiError && error.code === 'CLIENT_LIMIT';

  return (
    <Modal title={client ? `Edit ${client.name}` : 'Add a client'} onClose={onClose} wide>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {atLimit ? (
          <div role="alert" className="rounded-xl border border-at-risk/30 bg-at-risk/5 px-3 py-3 text-sm">
            <p className="font-medium text-ink">{error.message}</p>
            <Link to="/pricing" className="mt-1 inline-block font-semibold text-accent hover:underline">
              See plans
            </Link>
          </div>
        ) : (
          <FormError message={error && !Object.keys(errors).length ? error.message : null} />
        )}

        <Field label="Name" error={errors.name?.message}>
          {(a) => <Input {...a} data-autofocus autoComplete="off" {...form.register('name')} />}
        </Field>
        <Field label="Goals" error={errors.goals?.message} hint="What they want to reach, in their words.">
          {(a) => <Textarea {...a} rows={2} {...form.register('goals')} />}
        </Field>

        <fieldset className="grid grid-cols-3 gap-3">
          <legend className="mb-1.5 text-sm font-medium">Stats (optional)</legend>
          <Field label="Weight (kg)" error={errors.stats?.weightKg?.message}>
            {(a) => (
              <Input
                {...a}
                type="number"
                inputMode="decimal"
                step="0.1"
                {...form.register('stats.weightKg', optionalNumber)}
              />
            )}
          </Field>
          <Field label="Height (cm)" error={errors.stats?.heightCm?.message}>
            {(a) => (
              <Input {...a} type="number" inputMode="numeric" {...form.register('stats.heightCm', optionalNumber)} />
            )}
          </Field>
          <Field label="Body fat %" error={errors.stats?.bodyFatPct?.message}>
            {(a) => (
              <Input
                {...a}
                type="number"
                inputMode="decimal"
                step="0.1"
                {...form.register('stats.bodyFatPct', optionalNumber)}
              />
            )}
          </Field>
        </fieldset>

        <Field label="Notes" error={errors.notes?.message} hint="Injuries, restrictions, food preferences.">
          {(a) => <Textarea {...a} {...form.register('notes')} />}
        </Field>
        <Field
          label="Client's time zone"
          error={errors.timezone?.message}
          hint="Their day starts at midnight in this zone."
        >
          {(a) => (
            <Select {...a} {...form.register('timezone')}>
              {timeZones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replaceAll('_', ' ')}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            {client ? 'Save changes' : 'Add client'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
