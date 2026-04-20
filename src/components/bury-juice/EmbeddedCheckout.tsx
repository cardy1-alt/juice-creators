import { useEffect, useRef, useState } from 'react';
import { loadStripe, type EmbeddedCheckout as StripeEmbeddedCheckout } from '../../lib/bury-juice/stripe';

interface Props {
  clientSecret: string;
  onError: (message: string) => void;
}

// Thin wrapper around Stripe's initEmbeddedCheckout. The checkout
// instance is torn down on unmount and whenever the clientSecret
// changes, so retrying a failed session doesn't leak iframes.

export function EmbeddedCheckout({ clientSecret, onError }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
    if (!publishableKey) {
      onError('Stripe is not configured — missing VITE_STRIPE_PUBLISHABLE_KEY.');
      return;
    }
    if (!containerRef.current) return;

    let checkout: StripeEmbeddedCheckout | null = null;
    let cancelled = false;

    loadStripe(publishableKey)
      .then((stripe) => stripe.initEmbeddedCheckout({ clientSecret }))
      .then((instance) => {
        if (cancelled) {
          instance.destroy();
          return;
        }
        checkout = instance;
        if (containerRef.current) {
          instance.mount(containerRef.current);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        onError(msg);
      });

    return () => {
      cancelled = true;
      if (checkout) {
        try {
          checkout.destroy();
        } catch {
          /* ignore — already unmounted */
        }
      }
    };
  }, [clientSecret, onError]);

  return (
    <div>
      {loading && (
        <div style={{ padding: 24, color: 'var(--bj-mid)' }}>Loading secure payment form…</div>
      )}
      <div ref={containerRef} />
    </div>
  );
}
