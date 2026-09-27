import { Spinner } from './ui';

export function FullPageLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" className="flex min-h-dvh items-center justify-center gap-3 text-ink-muted">
      <Spinner className="size-5" />
      <span className="text-sm">{label}…</span>
    </div>
  );
}
