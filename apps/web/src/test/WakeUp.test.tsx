import { act, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RequireRole } from '../components/RequireRole';
import { markServerReady, resetServerStatus, whenServerReady } from '../lib/serverStatus';
import { renderPage } from './utils';

describe('waking up the free server', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetServerStatus('ready');
  });

  it('explains the wait instead of showing a bare spinner, then shows the page', async () => {
    resetServerStatus('waking');
    let answer: (r: Response) => void = () => undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>((resolve) => (answer = resolve))),
    );

    renderPage(
      <RequireRole role="trainer">
        <p>Trainer page</p>
      </RequireRole>,
    );
    expect(screen.getByRole('heading', { name: 'Waking up the server…' })).toBeInTheDocument();

    await act(async () =>
      answer(new Response(JSON.stringify({ id: '1', email: 'k@x.io', name: 'Kim', role: 'trainer', demo: false }))),
    );
    expect(await screen.findByText('Trainer page')).toBeInTheDocument();
  });

  it('lets a demo request wait until the server is up', async () => {
    resetServerStatus('waking');
    let resolved = false;
    const wait = whenServerReady().then(() => (resolved = true));
    await new Promise((r) => setTimeout(r, 20));
    expect(resolved).toBe(false);

    markServerReady();
    await wait;
    expect(resolved).toBe(true);
  });
});
