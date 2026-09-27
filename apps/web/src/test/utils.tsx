import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { vi } from 'vitest';

type Handler = (body: unknown) => { status?: number; body?: unknown } | unknown;

/**
 * Replaces fetch with fake API routes, keyed like "GET /api/dashboard".
 * A handler returns the JSON body (status 200), or { status, body } for other statuses.
 * Returns the mock so tests can check which requests were made.
 */
export function mockApi(routes: Record<string, Handler>) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${url}`;
    const handler = routes[key];
    if (!handler) throw new Error(`No mock for ${key}`);
    const result = handler(init?.body ? JSON.parse(String(init.body)) : undefined);
    const { status = 200, body } =
      result && typeof result === 'object' && 'status' in result
        ? (result as { status: number; body?: unknown })
        : { body: result };
    return new Response(status === 204 ? null : JSON.stringify(body), { status });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** Renders a page at `route`, matched by `path`, with a fresh query cache (no retries). */
export function renderPage(ui: ReactElement, { route = '/', path = '*' }: { route?: string; path?: string } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path={path} element={ui} />
          <Route path="*" element={<p>Other page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
