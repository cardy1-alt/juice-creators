// Friendly error messages for auth + signup flows.
//
// Key principle: never swallow the real error. If we don't recognise it,
// pass the raw message through so support can actually help, and log it
// to the console for devtools inspection.

const ERROR_MAP: Array<{ match: RegExp; friendly: string }> = [
  { match: /invalid login credentials/i, friendly: 'Incorrect email or password' },
  { match: /email already registered|user already registered|already.*registered|already.*exists/i,
    friendly: 'An account with this email already exists — try signing in instead.' },
  { match: /password should be at least (\d+) characters/i,
    friendly: 'Password must be at least 8 characters' },
  { match: /weak.*password|password.*weak/i,
    friendly: 'Please choose a stronger password (at least 8 characters).' },
  { match: /over_email_send_rate_limit|email rate limit|rate.*exceeded/i,
    friendly: 'Too many signup attempts in a short window — please wait a few minutes and try again.' },
  { match: /invalid email|email.*invalid|email_address_invalid/i,
    friendly: 'That email address looks invalid — please double-check it.' },
  { match: /duplicate key.*instagram_handle|instagram_handle.*duplicate/i,
    friendly: 'That Instagram handle is already registered — please check it or contact hello@nayba.app.' },
  { match: /duplicate key|23505/i,
    friendly: 'An account with this email or Instagram handle already exists — please sign in instead.' },
  { match: /row.*level.*security|rls|42501/i,
    friendly: 'Permissions error creating your profile. Please contact hello@nayba.app.' },
  { match: /network|failed to fetch|fetch failed/i,
    friendly: 'Network error — please check your connection and try again.' },
];

const SUPPORT_SUFFIX = ' If this keeps happening, contact hello@nayba.app.';

export function friendlyError(raw: string | undefined | null): string {
  if (!raw) return 'Something went wrong.' + SUPPORT_SUFFIX;
  // Always log the raw error to the console so devtools can see what
  // actually happened — invaluable for debugging pilot issues.
  try { console.error('[auth] raw error:', raw); } catch { /* ignore */ }
  for (const { match, friendly } of ERROR_MAP) {
    if (match.test(raw)) return friendly;
  }
  // Unknown error: show a trimmed version of the raw message rather than a
  // completely generic fallback. Users and support can at least see it.
  const trimmed = raw.replace(/\s+/g, ' ').trim().slice(0, 200);
  return `${trimmed}${SUPPORT_SUFFIX}`;
}
