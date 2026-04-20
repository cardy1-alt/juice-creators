// Shared helpers for the Bury Juice serverless routes. Kept tiny so
// each handler stays self-contained — we don't ship the @supabase/
// supabase-js dep into the edge runtime; plain fetch against the
// PostgREST endpoint is fine for the handful of calls we make.

import type { VercelResponse } from '@vercel/node';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export function supabaseUrl(): string {
  return required(process.env.SUPABASE_URL ? 'SUPABASE_URL' : 'VITE_SUPABASE_URL');
}

export function serviceRoleKey(): string {
  return required('SUPABASE_SERVICE_ROLE_KEY');
}

export async function supabaseFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${supabaseUrl()}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey(),
      Authorization: `Bearer ${serviceRoleKey()}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}

export function jsonError(res: VercelResponse, status: number, message: string) {
  res.status(status).json({ error: message });
}

export function generateDashboardToken(): string {
  // 22-byte base64url token — enough entropy for a magic link.
  const bytes = new Uint8Array(22);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).crypto.getRandomValues(bytes);
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}

// Hits the Stripe REST API with form-encoded bodies (Stripe's
// preferred wire format). We only need checkout.sessions.create here,
// so a real SDK dep is overkill.
export async function stripeCall<T = unknown>(
  path: string,
  form: Record<string, string | number>,
): Promise<T> {
  const secret = required('STRIPE_SECRET_KEY');
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(form)) body.append(k, String(v));
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stripe ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

export function priceIdFor(
  tier: 'classified' | 'feature' | 'primary',
  size: 1 | 4 | 12,
): string {
  const key =
    size === 1
      ? `STRIPE_PRICE_${tier.toUpperCase()}_SINGLE`
      : `STRIPE_PRICE_${tier.toUpperCase()}_PACK${size}`;
  return required(key);
}

export function adminPasswordOk(req: { headers: Record<string, string | string[] | undefined> }): boolean {
  const expected = process.env.BJ_ADMIN_PASSWORD;
  if (!expected) return false;
  const got = req.headers['x-bj-admin-password'];
  return typeof got === 'string' && got === expected;
}
