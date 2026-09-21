/**
 * Client HTTP unique du front. Toutes les requêtes passent par /api (proxy Next → NestJS).
 * Sur un 401, on tente UN refresh (cookie httpOnly) puis on rejoue la requête.
 */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly issues?: { path: string; message: string }[],
  ) {
    super(message);
  }
}

let refreshing: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  // Mutualise les refresh concurrents (plusieurs requêtes 401 en même temps)
  refreshing ??= fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
    .then((r) => r.ok)
    .finally(() => setTimeout(() => (refreshing = null), 0));
  return refreshing;
}

type Query = Record<string, string | number | boolean | undefined | null>;

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  query?: Query;
  /** Ne pas tenter de refresh (utilisé par les routes d'auth elles-mêmes). */
  skipRefresh?: boolean;
}

function buildUrl(path: string, query?: Query): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  }
  const s = qs.toString();
  return `/api${path}${s ? `?${s}` : ''}`;
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { body, query, skipRefresh, headers, ...init } = opts;
  const doFetch = () =>
    fetch(buildUrl(path, query), {
      ...init,
      credentials: 'include',
      headers: {
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  let res = await doFetch();
  if (res.status === 401 && !skipRefresh && (await refreshSession())) {
    res = await doFetch();
  }

  if (res.status === 401 && !skipRefresh && typeof window !== 'undefined') {
    // Session morte : on nettoie les cookies (sinon le proxy Next nous renverrait
    // vers l'app en boucle) puis retour au login.
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    const next = encodeURIComponent(window.location.pathname);
    window.location.href = `/login?next=${next}`;
  }

  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as {
      message?: string | string[];
      issues?: { path: string; message: string }[];
    } | null;
    const message = Array.isArray(data?.message) ? data.message.join(', ') : data?.message;
    throw new ApiError(res.status, message ?? res.statusText, data?.issues);
  }

  if (res.status === 204) return undefined as T;
  const type = res.headers.get('content-type') ?? '';
  return (type.includes('application/json') ? res.json() : res.text()) as Promise<T>;
}
