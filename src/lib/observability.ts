/**
 * Lazy-loaded error tracking. Sentry SDK is ~150kb gzipped, so we only load
 * and initialize it when VITE_SENTRY_DSN is set (i.e., production with
 * monitoring enabled). Otherwise this module is a no-op with zero runtime cost.
 *
 * To enable:
 * 1. Create a Sentry project (https://sentry.io/)
 * 2. Copy the DSN from Project Settings → Client Keys
 * 3. Add VITE_SENTRY_DSN=https://... to Vercel env vars
 * 4. Redeploy — errors start flowing to Sentry automatically
 */

type SentryModule = typeof import('@sentry/react');

let sentryPromise: Promise<SentryModule | null> | null = null;

async function loadSentry(): Promise<SentryModule | null> {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return null;
  if (sentryPromise) return sentryPromise;

  sentryPromise = import('@sentry/react').then(mod => {
    mod.init({
      dsn,
      environment: import.meta.env.MODE,
      tracesSampleRate: 0.1,
      beforeSend(event, hint) {
        const err = hint.originalException as Error | undefined;
        const msg = err?.message || '';
        // Skip noisy/expected errors
        if (msg.includes('NetworkError') || msg.includes('Failed to fetch')) return null;
        if (msg.includes('ResizeObserver loop')) return null;
        return event;
      },
    });
    return mod;
  }).catch(err => {
    console.warn('[observability] Failed to load Sentry:', err);
    return null;
  });

  return sentryPromise;
}

export function initObservability() {
  if (!import.meta.env.VITE_SENTRY_DSN) {
    if (!import.meta.env.PROD) {
      console.info('[observability] Sentry not configured — set VITE_SENTRY_DSN to enable');
    }
    return;
  }
  // Fire and forget — let the chunk load in the background, not blocking render
  loadSentry();
}

/** Capture an exception. No-op if Sentry isn't configured. */
export async function captureException(err: unknown, context?: Record<string, unknown>) {
  const sentry = await loadSentry();
  if (sentry) sentry.captureException(err, context ? { extra: context } : undefined);
}
