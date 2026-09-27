/** An error response from the API, with the server's message and (for 400s) messages per form field. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly fieldErrors: Record<string, string[]> = {},
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Calls the API on the same origin (/api is proxied by Vite locally and by Vercel in production),
 * so the httpOnly session cookie is sent automatically. Nothing auth-related lives in JavaScript.
 */
export async function api<T>(path: string, options: { method?: Method; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: options.method ?? 'GET',
      credentials: 'same-origin',
      headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, 'Could not reach the server. Check your connection and try again.');
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => undefined);
  if (!res.ok) {
    const message =
      res.status === 429
        ? 'Too many tries in a short time. Please wait a minute and try again.'
        : typeof data?.message === 'string'
          ? data.message
          : 'Something went wrong. Please try again.';
    throw new ApiError(res.status, message, data?.fieldErrors ?? {}, data?.code);
  }
  return data as T;
}

/** Puts server field errors into a react-hook-form form (paths like "stats.weightKg" match the field names). */
export function applyFieldErrors(error: unknown, setError: (name: never, error: { message: string }) => void): boolean {
  if (!(error instanceof ApiError) || !Object.keys(error.fieldErrors).length) return false;
  for (const [field, messages] of Object.entries(error.fieldErrors)) {
    setError(field as never, { message: messages[0] });
  }
  return true;
}
