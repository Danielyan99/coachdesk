import type { DashboardClientDto, DashboardDto } from '@coachdesk/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DashboardPage } from '../pages/trainer/DashboardPage';
import { mockApi, renderPage } from './utils';

function client(
  name: string,
  status: DashboardClientDto['adherence']['status'],
  ratio: number | null,
): DashboardClientDto {
  return {
    id: name.toLowerCase(),
    name,
    goals: `${name}'s goal`,
    hasLogin: true,
    inviteExpiresAt: null,
    planName: status === 'no-plan' ? null : 'Base plan',
    adherence: { status, ratio, done: 0, scheduled: 0 },
    lastActivity: null,
  };
}

const dashboard: DashboardDto = {
  tier: 'starter',
  clientLimit: 10,
  clients: [
    client('Ana', 'on-track', 0.9),
    client('Ben', 'behind', 0.3),
    client('Cleo', 'at-risk', 0.6),
    client('Dan', 'no-plan', null),
  ],
  counts: { 'on-track': 1, 'at-risk': 1, behind: 1, 'no-data': 0, 'no-plan': 1 },
};

describe('DashboardPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows capacity and lists clients who need attention first', async () => {
    mockApi({ 'GET /api/dashboard': () => dashboard });
    renderPage(<DashboardPage />);

    expect(await screen.findByText('4 of 10 clients')).toBeInTheDocument();
    const names = screen.getAllByRole('link').map((a) => within(a).getByText(/^(Ana|Ben|Cleo|Dan)$/).textContent);
    expect(names).toEqual(['Ben', 'Cleo', 'Dan', 'Ana']);
    expect(screen.getByRole('link', { name: /Ben/ })).toHaveTextContent('Behind· 30%');
  });

  it('filters by status', async () => {
    mockApi({ 'GET /api/dashboard': () => dashboard });
    renderPage(<DashboardPage />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: /At risk/ }));
    expect(screen.getByRole('button', { name: /At risk/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('link').map((a) => a.textContent)).toEqual([expect.stringContaining('Cleo')]);

    await user.click(screen.getByRole('button', { name: /All/ }));
    expect(screen.getAllByRole('link')).toHaveLength(4);
  });

  it('shows an empty state for a new trainer', async () => {
    mockApi({
      'GET /api/dashboard': () => ({ ...dashboard, clients: [], counts: { ...dashboard.counts, 'on-track': 0 } }),
    });
    renderPage(<DashboardPage />);
    expect(await screen.findByText('No clients yet')).toBeInTheDocument();
  });

  it('shows the error with a retry button when loading fails', async () => {
    mockApi({ 'GET /api/dashboard': () => ({ status: 500, body: { message: 'Database is down' } }) });
    renderPage(<DashboardPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Database is down');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
