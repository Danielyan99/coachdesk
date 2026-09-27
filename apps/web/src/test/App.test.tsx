import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { mockApi } from './utils';

function renderApp(route: string) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[route]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('App routing', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows the landing page', () => {
    renderApp('/');
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('sends a logged-out visitor from a trainer page to login', async () => {
    mockApi({ 'GET /api/auth/me': () => ({ status: 401, body: {} }) });
    renderApp('/app/templates');
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
  });

  it('keeps a client out of trainer pages', async () => {
    mockApi({
      'GET /api/auth/me': () => ({
        id: '1',
        email: 'c@x.io',
        name: 'Sam',
        role: 'client',
        clientId: 'c1',
        demo: false,
      }),
      'GET /api/me/today': () => ({
        trainerName: 'Kim',
        planName: null,
        planStartDate: null,
        editableDates: [],
        today: null,
      }),
      'GET /api/me/week': () => ({
        planName: null,
        planStartDate: null,
        today: '2026-09-28',
        editableDates: [],
        days: [],
      }),
    });
    renderApp('/app');
    expect(await screen.findByText(/plan/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Clients' })).not.toBeInTheDocument();
  });

  it('shows a 404 page for unknown paths', () => {
    renderApp('/nope');
    expect(screen.getByRole('heading', { name: "This page doesn't exist" })).toBeInTheDocument();
  });
});
