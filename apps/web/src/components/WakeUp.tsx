import { useEffect, useState } from 'react';
import { secondsWaiting, useServerStatus } from '../lib/serverStatus';
import { Logo } from './Logo';
import { Button, Spinner } from './ui';

function useSeconds() {
  const [seconds, setSeconds] = useState(secondsWaiting);
  useEffect(() => {
    const timer = setInterval(() => setSeconds(secondsWaiting()), 1000);
    return () => clearInterval(timer);
  }, []);
  return seconds;
}

/** Full page, shown instead of a spinner while the free server boots. */
export function WakeUpScreen() {
  const status = useServerStatus();
  const seconds = useSeconds();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <Logo />
      {status === 'down' ? (
        <div className="flex max-w-sm flex-col items-center gap-3">
          <h1 className="text-xl font-semibold">The server isn't answering</h1>
          <p className="text-sm text-ink-muted">It may be restarting. Please try again in a minute.</p>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Try again
          </Button>
        </div>
      ) : (
        <div role="status" className="flex max-w-sm flex-col items-center gap-3">
          <Spinner className="size-6 text-accent" />
          <h1 className="text-xl font-semibold">Waking up the server…</h1>
          <p className="text-sm text-ink-muted">
            This demo runs on free hosting that sleeps when nobody uses it. The first load can take up to a minute;
            after that everything is fast.
          </p>
          <p className="text-xs text-ink-faint tabular-nums">{seconds} s</p>
        </div>
      )}
    </main>
  );
}

/** Small notice on public pages, which work without the server, while it boots in the background. */
export function WakeUpBanner() {
  const status = useServerStatus();
  if (status !== 'waking') return null;
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-white shadow-lg"
    >
      <Spinner className="size-4 shrink-0" />
      <span>Waking up the free server. The demo will be ready in about half a minute.</span>
    </div>
  );
}
