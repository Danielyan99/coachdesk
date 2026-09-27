import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClientFormModal } from '../pages/trainer/ClientFormModal';
import { mockApi, renderPage } from './utils';

describe('ClientFormModal', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends empty stats as null (not 0) and the chosen time zone', async () => {
    const fetchMock = mockApi({
      'POST /api/clients': () => ({ status: 201, body: { id: 'c1' } }),
    });
    renderPage(<ClientFormModal onClose={() => undefined} />, { route: '/', path: '/' });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Name'), 'Sam Lee');
    await user.type(screen.getByLabelText('Weight (kg)'), '80.5');
    await user.selectOptions(screen.getByLabelText("Client's time zone"), 'Asia/Yerevan');
    await user.click(screen.getByRole('button', { name: 'Add client' }));

    await screen.findByText('Other page'); // navigated to the new client
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body).toMatchObject({
      name: 'Sam Lee',
      timezone: 'Asia/Yerevan',
      stats: { weightKg: 80.5, heightCm: null, bodyFatPct: null },
    });
  });

  it('explains the client limit and links to pricing', async () => {
    mockApi({
      'POST /api/clients': () => ({
        status: 403,
        body: {
          code: 'CLIENT_LIMIT',
          limit: 10,
          message: 'Your Starter plan includes up to 10 clients. Switch plan to add more.',
        },
      }),
    });
    renderPage(<ClientFormModal onClose={() => undefined} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Name'), 'Eleventh');
    await user.click(screen.getByRole('button', { name: 'Add client' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Starter plan includes up to 10 clients');
    expect(screen.getByRole('link', { name: 'See plans' })).toHaveAttribute('href', '/pricing');
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    renderPage(<ClientFormModal onClose={onClose} />);
    await userEvent.setup().keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});
