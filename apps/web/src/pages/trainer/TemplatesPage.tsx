import { useState } from 'react';
import { Link } from 'react-router';
import { Button, buttonClass, EmptyState, ErrorState, LoadingRows } from '../../components/ui';
import { timeAgo, weekSummary } from '../../lib/format';
import { useTemplates } from '../../lib/queries';
import { AssignTemplateModal } from './AssignTemplateModal';

export function TemplatesPage() {
  const templates = useTemplates();
  const [assigning, setAssigning] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
          <p className="mt-1 text-sm text-ink-muted">Build a week once, then give each client their own copy.</p>
        </div>
        <Link to="/app/templates/new" className={buttonClass()}>
          New template
        </Link>
      </div>

      {templates.isPending && <LoadingRows rows={3} label="Loading templates" />}
      {templates.isError && <ErrorState error={templates.error} onRetry={() => void templates.refetch()} />}
      {templates.data &&
        (templates.data.length === 0 ? (
          <EmptyState
            title="No templates yet"
            text="A template is a week of workouts and meals you can reuse for many clients."
            action={
              <Link to="/app/templates/new" className={buttonClass()}>
                Create your first template
              </Link>
            }
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {templates.data.map((t) => (
              <li key={t.id} className="card flex flex-col gap-3 p-5">
                <div className="flex-1">
                  <Link to={`/app/templates/${t.id}`} className="font-semibold hover:text-accent">
                    {t.name}
                  </Link>
                  {t.description && <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{t.description}</p>}
                  <p className="mt-2 text-sm text-ink-muted">
                    {weekSummary(t.days)} · edited {timeAgo(t.updatedAt)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link to={`/app/templates/${t.id}`} className={buttonClass('secondary', 'sm')}>
                    Edit
                  </Link>
                  <Button size="sm" variant="ghost" onClick={() => setAssigning(t.id)}>
                    Assign to client
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ))}

      {assigning && <AssignTemplateModal templateId={assigning} onClose={() => setAssigning(null)} />}
    </div>
  );
}
