import { assignTemplateSchema } from '@coachdesk/shared';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button, Field, FormError, Input, Modal, Select } from '../../components/ui';
import { localToday, weekSummary } from '../../lib/format';
import { useAssignTemplate, useClients, useTemplates } from '../../lib/queries';
import { type FormErrors, validate } from '../../lib/validation';

/**
 * Copies a template into a client's plan. Opened from a template (pick the client)
 * or from a client (pick the template).
 */
export function AssignTemplateModal({
  templateId: fixedTemplate,
  clientId: fixedClient,
  onClose,
}: {
  templateId?: string;
  clientId?: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const templates = useTemplates();
  const clients = useClients();
  const assign = useAssignTemplate();
  const [templateId, setTemplateId] = useState(fixedTemplate ?? '');
  const [clientId, setClientId] = useState(fixedClient ?? '');
  const [startDate, setStartDate] = useState(localToday());
  const [errors, setErrors] = useState<FormErrors>({});

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = validate(assignTemplateSchema, { clientId, startDate });
    const next: FormErrors = { ...(result.errors ?? {}) };
    if (!templateId) next.templateId = 'Pick a template';
    setErrors(next);
    if (!result.data || next.templateId) return;
    assign.mutate(
      { templateId, ...result.data },
      {
        onSuccess: (plan) => {
          onClose();
          if (!fixedClient) navigate(`/app/clients/${plan.clientId}`);
        },
      },
    );
  };

  const noTemplates = templates.isSuccess && templates.data.length === 0;
  const noClients = clients.isSuccess && clients.data.length === 0;

  return (
    <Modal title="Assign a template" onClose={onClose}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormError message={assign.error?.message} />
        {!fixedTemplate && (
          <Field label="Template" error={errors.templateId}>
            {(a) =>
              noTemplates ? (
                <p className="text-sm text-ink-muted">
                  You have no templates yet. Create one on the Templates page, or build this client's plan from scratch.
                </p>
              ) : (
                <Select
                  {...a}
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  disabled={templates.isPending}
                >
                  <option value="">{templates.isPending ? 'Loading…' : 'Choose a template'}</option>
                  {templates.data?.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({weekSummary(t.days)})
                    </option>
                  ))}
                </Select>
              )
            }
          </Field>
        )}
        {!fixedClient && (
          <Field label="Client" error={errors.clientId}>
            {(a) =>
              noClients ? (
                <p className="text-sm text-ink-muted">Add a client first.</p>
              ) : (
                <Select
                  {...a}
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  disabled={clients.isPending}
                >
                  <option value="">{clients.isPending ? 'Loading…' : 'Choose a client'}</option>
                  {clients.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              )
            }
          </Field>
        )}
        <Field label="Start date" error={errors.startDate}>
          {(a) => <Input {...a} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />}
        </Field>
        <p className="text-sm text-ink-muted">
          The client gets their own copy, so you can adjust it for them later. If they already have a plan, this one
          replaces it (their past check-offs are kept).
        </p>
        <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={assign.isPending} disabled={noTemplates || noClients}>
            Assign
          </Button>
        </div>
      </form>
    </Modal>
  );
}
