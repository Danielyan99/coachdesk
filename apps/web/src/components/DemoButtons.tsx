import { useNavigate } from 'react-router';
import { useStartDemo } from '../lib/queries';
import { useServerStatus } from '../lib/serverStatus';
import { Button, cx } from './ui';

/** The two "Try it" buttons: each creates a private sandbox (deleted after 24 hours) and logs in. */
export function DemoButtons({ className }: { className?: string }) {
  const demo = useStartDemo();
  const navigate = useNavigate();
  const start = (role: 'trainer' | 'client') =>
    demo.mutate(role, { onSuccess: () => navigate(role === 'trainer' ? '/app' : '/me') });
  const pendingRole = demo.isPending ? demo.variables : null;
  const server = useServerStatus();

  return (
    <div className={cx('flex flex-col gap-3', className)}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          className="min-h-13 px-6 text-base"
          loading={pendingRole === 'trainer'}
          disabled={demo.isPending}
          onClick={() => start('trainer')}
        >
          Try as a trainer
        </Button>
        <Button
          variant="secondary"
          className="min-h-13 px-6 text-base"
          loading={pendingRole === 'client'}
          disabled={demo.isPending}
          onClick={() => start('client')}
        >
          Try as a client
        </Button>
      </div>
      <p className="text-sm text-ink-muted" aria-live="polite">
        {demo.isPending
          ? server === 'waking'
            ? 'Waking up the free server first. This can take up to a minute…'
            : 'Preparing your private demo…'
          : demo.error
            ? `Couldn't start the demo: ${demo.error.message}`
            : 'No sign-up. You get your own private copy, deleted after 24 hours.'}
      </p>
    </div>
  );
}
