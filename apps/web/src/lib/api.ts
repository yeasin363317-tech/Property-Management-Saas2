export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: any) {
    super(message);
  }
}

const BASE = '/api/v1';

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<{ data: T; meta?: any }> {
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? 'GET',
    credentials: 'same-origin',
    headers: { 'X-Requested-With': 'XMLHttpRequest', ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 204) return { data: undefined as T };
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event('auth:expired'));
    throw new ApiError(res.status, json?.error?.code ?? 'ERROR', json?.error?.message ?? 'Request failed', json?.error?.details);
  }
  return json;
}

export const qs = (params: Record<string, unknown>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};
