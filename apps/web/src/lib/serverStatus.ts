import { useSyncExternalStore } from 'react';

/**
 * The API runs on Render's free plan, which sleeps after 15 minutes without traffic; the first request then
 * takes 30-50 seconds. The app pings /api/health as soon as it opens: if there is no answer within a couple of
 * seconds the status becomes "waking" and the UI explains the wait instead of showing a frozen spinner.
 */
export type ServerStatus = 'checking' | 'waking' | 'ready' | 'down';

const SLOW_AFTER_MS = 2500;
const GIVE_UP_AFTER_MS = 120_000;
const RETRY_EVERY_MS = 3000;

let status: ServerStatus = 'checking';
let startedAt = 0;
const listeners = new Set<() => void>();

function set(next: ServerStatus) {
  if (status === next) return;
  status = next;
  listeners.forEach((l) => l());
}

/** Any successful API response proves the server is up. */
export function markServerReady() {
  set('ready');
}

export function useServerStatus(): ServerStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
  );
}

/** Resolves once the server answers (at once if it already did); rejects if it never wakes up. */
export function whenServerReady(): Promise<void> {
  if (status === 'ready' || !startedAt) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const check = () => {
      if (status === 'ready' || status === 'down') {
        listeners.delete(check);
        if (status === 'ready') resolve();
        else reject(new Error("The server isn't answering. Please try again in a minute."));
      }
    };
    listeners.add(check);
    check();
  });
}

/** Seconds since the first ping, for the "waking up" message. */
export function secondsWaiting(): number {
  return startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0;
}

async function ping(): Promise<boolean> {
  try {
    const res = await fetch('/api/health', { signal: AbortSignal.timeout(15_000) });
    return res.ok;
  } catch {
    return false;
  }
}

/** Starts the health check once; later calls do nothing. */
export async function wakeServer(): Promise<void> {
  if (startedAt) return;
  startedAt = Date.now();
  const slow = setTimeout(() => status === 'checking' && set('waking'), SLOW_AFTER_MS);
  while (status !== 'ready') {
    if (await ping()) {
      set('ready');
      break;
    }
    if (Date.now() - startedAt > GIVE_UP_AFTER_MS) {
      set('down');
      break;
    }
    if (status === 'checking') set('waking');
    await new Promise((r) => setTimeout(r, RETRY_EVERY_MS));
  }
  clearTimeout(slow);
}

/** For tests: pretend a health check is running ("waking") or has not started ("checking"). */
export function resetServerStatus(next: ServerStatus = 'checking') {
  status = next;
  startedAt = next === 'checking' ? 0 : Date.now();
  listeners.forEach((l) => l());
}
