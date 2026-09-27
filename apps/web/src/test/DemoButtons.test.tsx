import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DemoButtons } from '../components/DemoButtons';
import { mockApi, renderPage } from './utils';

describe('DemoButtons', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('starts a trainer demo and opens the app', async () => {
    const fetchMock = mockApi({
      'POST /api/auth/demo': (body) => ({
        id: 't1',
        email: 'x@demo',
        name: 'Alex Morgan',
        role: (body as { role: string }).role,
        tier: 'pro',
        demo: true,
      }),
    });
    renderPage(<DemoButtons />, { route: '/', path: '/' });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try as a trainer' }));

    expect(await screen.findByText('Other page')).toBeInTheDocument();
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ role: 'trainer' });
  });

  it('explains a failure, e.g. the hourly limit', async () => {
    mockApi({
      'POST /api/auth/demo': () => ({ status: 429, body: { message: 'ThrottlerException: Too Many Requests' } }),
    });
    renderPage(<DemoButtons />, { route: '/', path: '/' });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try as a client' }));
    expect(await screen.findByText(/Couldn't start the demo: Too many tries/)).toBeInTheDocument();
  });
});
