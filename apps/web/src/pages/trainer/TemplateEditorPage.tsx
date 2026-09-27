import { emptyWeek, type PlanDay, type TemplateDto, templateSchema } from '@coachdesk/shared';
import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { Button, Card, ErrorState, Field, FormError, Input, Modal, Skeleton, Textarea } from '../../components/ui';
import { WeekEditor } from '../../components/WeekEditor';
import { useDeleteTemplate, useSaveTemplate, useTemplate } from '../../lib/queries';
import { useUnsavedWarning } from '../../lib/useUnsavedWarning';
import { dayErrors, type FormErrors, serverErrors, validate } from '../../lib/validation';
import { AssignTemplateModal } from './AssignTemplateModal';

export function TemplateEditorPage() {
  const { id } = useParams();
  const template = useTemplate(id);

  if (id && template.isPending) return <Skeleton className="h-96" />;
  if (id && template.isError) return <ErrorState error={template.error} onRetry={() => void template.refetch()} />;
  return <TemplateForm key={id ?? 'new'} template={id ? template.data : undefined} />;
}

function TemplateForm({ template }: { template?: TemplateDto }) {
  const navigate = useNavigate();
  const location = useLocation();
  const save = useSaveTemplate(template?.id);
  const [name, setName] = useState(template?.name ?? '');
  const [description, setDescription] = useState(template?.description ?? '');
  const [days, setDays] = useState<PlanDay[]>(template?.days ?? emptyWeek());
  const [errors, setErrors] = useState<FormErrors>({});
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(Boolean((location.state as { justSaved?: boolean } | null)?.justSaved));
  const [assigning, setAssigning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  useUnsavedWarning(dirty);

  const edit =
    <T,>(setter: (v: T) => void) =>
    (value: T) => {
      setter(value);
      setDirty(true);
      setSaved(false);
    };

  const onSave = (e: React.FormEvent) => {
    e.preventDefault();
    const result = validate(templateSchema, { name, description, days });
    if (result.errors) return setErrors(result.errors);
    setErrors({});
    save.mutate(result.data, {
      onSuccess: (savedTemplate) => {
        setDirty(false);
        setSaved(true);
        if (!template) navigate(`/app/templates/${savedTemplate.id}`, { replace: true, state: { justSaved: true } });
      },
      onError: (err) => setErrors(serverErrors(err) ?? {}),
    });
  };

  const errorCount = Object.keys(errors).length;

  return (
    <form onSubmit={onSave} noValidate className="flex flex-col gap-6">
      <div>
        <Link to="/app/templates" className="text-sm font-medium text-ink-muted hover:text-ink">
          ← Templates
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{template ? 'Edit template' : 'New template'}</h1>
          <div className="flex flex-wrap items-center gap-2">
            {saved && !dirty && (
              <span role="status" className="text-sm text-on-track">
                Saved
              </span>
            )}
            {template && (
              <>
                <Button variant="ghost" onClick={() => setDeleting(true)}>
                  Delete
                </Button>
                <Button
                  variant="secondary"
                  disabled={dirty}
                  onClick={() => setAssigning(true)}
                  title={dirty ? 'Save first' : undefined}
                >
                  Assign
                </Button>
              </>
            )}
            <Button type="submit" loading={save.isPending}>
              Save
            </Button>
          </div>
        </div>
      </div>

      {errorCount > 0 && (
        <FormError
          message={`Please fix ${errorCount} field${errorCount === 1 ? '' : 's'}. Days with problems have a red dot.`}
        />
      )}
      <FormError message={save.error && !serverErrors(save.error) ? save.error.message : null} />

      <Card className="grid gap-4 p-5 sm:grid-cols-2">
        <Field label="Template name" error={errors.name}>
          {(a) => (
            <Input
              {...a}
              value={name}
              placeholder="e.g. Beginner strength, 3 days"
              onChange={(e) => edit(setName)(e.target.value)}
            />
          )}
        </Field>
        <Field label="Description (optional)" error={errors.description}>
          {(a) => (
            <Textarea
              {...a}
              rows={1}
              value={description}
              placeholder="Who is it for?"
              onChange={(e) => edit(setDescription)(e.target.value)}
            />
          )}
        </Field>
      </Card>

      <Card className="p-4 sm:p-5">
        <WeekEditor days={days} onChange={edit(setDays)} errors={dayErrors(errors)} />
      </Card>

      {assigning && template && <AssignTemplateModal templateId={template.id} onClose={() => setAssigning(false)} />}
      {deleting && template && <DeleteTemplateModal template={template} onClose={() => setDeleting(false)} />}
    </form>
  );
}

function DeleteTemplateModal({ template, onClose }: { template: TemplateDto; onClose: () => void }) {
  const remove = useDeleteTemplate(template.id);
  const navigate = useNavigate();
  return (
    <Modal title={`Delete "${template.name}"?`} onClose={onClose}>
      <p className="text-sm text-ink-muted">
        Clients who already got this template keep their plan. Only the template itself is deleted.
      </p>
      {remove.error && <p className="mt-3 text-sm text-behind">{remove.error.message}</p>}
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="danger"
          loading={remove.isPending}
          onClick={() => remove.mutate(undefined, { onSuccess: () => navigate('/app/templates', { replace: true }) })}
        >
          Delete template
        </Button>
      </div>
    </Modal>
  );
}
