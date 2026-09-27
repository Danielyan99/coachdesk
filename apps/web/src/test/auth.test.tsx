import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoginPage, safeNext } from '../pages/auth/LoginPage';
import { mockApi, renderPage } from './utils';

describe('LoginPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows validation messages from the shared schema without calling the API', async () => {
    const fetchMock = mockApi({ 'GET /api/auth/me': () => ({ status: 401, body: {} }) });
    renderPage(<LoginPage />, { route: '/login', path: '/login' });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Log in' }));
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByText('Enter your password')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1); // only /auth/me
  });

  it('shows the server message on wrong credentials', async () => {
    mockApi({
      'GET /api/auth/me': () => ({ status: 401, body: {} }),
      'POST /api/auth/login': () => ({ status: 401, body: { message: 'Email or password is incorrect' } }),
    });
    renderPage(<LoginPage />, { route: '/login', path: '/login' });
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('Email'), 'kim@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect');
  });

  it('sends a trainer to their dashboard after login, with a trimmed lowercase email', async () => {
    const fetchMock = mockApi({
      'GET /api/auth/me': () => ({ status: 401, body: {} }),
      'POST /api/auth/login': () => ({
        id: '1',
        email: 'kim@example.com',
        name: 'Kim',
        role: 'trainer',
        tier: 'starter',
        demo: false,
      }),
    });
    renderPage(<LoginPage />, { route: '/login', path: '/login' });
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('Email'), '  Kim@Example.com ');
    await user.type(screen.getByLabelText('Password'), 'right-password');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Other page')).toBeInTheDocument();
    const login = fetchMock.mock.calls.find(([url]) => url === '/api/auth/login');
    expect(JSON.parse(String(login?.[1]?.body))).toEqual({ email: 'kim@example.com', password: 'right-password' });
  });
});

describe('safeNext', () => {
  it('only allows paths on this site', () => {
    expect(safeNext('/app/clients/1')).toBe('/app/clients/1');
    expect(safeNext('https://evil.example')).toBeNull();
    expect(safeNext('//evil.example')).toBeNull();
    expect(safeNext(null)).toBeNull();
  });
});
