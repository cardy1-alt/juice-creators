const ERROR_MAP: Record<string, string> = {
  'Invalid login credentials': 'Incorrect email or password',
  'Email already registered': 'An account with this email already exists. Try signing in instead.',
  'Password should be at least 6 characters': 'Password must be at least 6 characters',
};

const FALLBACK = 'Something went wrong. Please try again or contact hello@nayba.app';

export function friendlyError(raw: string | undefined | null): string {
  if (!raw) return FALLBACK;
  for (const [key, friendly] of Object.entries(ERROR_MAP)) {
    if (raw.includes(key)) return friendly;
  }
  return FALLBACK;
}
