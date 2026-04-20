// Load Stripe.js on demand via the official CDN. Avoids adding the
// @stripe/stripe-js dependency — we only need initEmbeddedCheckout,
// and the global Stripe constructor is stable across v3.
//
// Stripe recommends loading js.stripe.com synchronously; doing it
// lazily keeps the homepage free of Stripe's connect/script overhead
// until someone actually reaches the checkout step.

type StripeFactory = (key: string) => StripeInstance;

interface StripeInstance {
  initEmbeddedCheckout(opts: { clientSecret: string }): Promise<EmbeddedCheckout>;
}

export interface EmbeddedCheckout {
  mount(el: HTMLElement | string): void;
  unmount(): void;
  destroy(): void;
}

declare global {
  interface Window {
    Stripe?: StripeFactory;
  }
}

let stripeP: Promise<StripeInstance> | null = null;

export function loadStripe(publishableKey: string): Promise<StripeInstance> {
  if (stripeP) return stripeP;
  stripeP = new Promise<StripeInstance>((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Stripe.js requires a browser'));
      return;
    }
    if (window.Stripe) {
      resolve(window.Stripe(publishableKey));
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://js.stripe.com/v3/"]',
    );
    const onLoad = () => {
      if (window.Stripe) resolve(window.Stripe(publishableKey));
      else reject(new Error('Stripe.js loaded but window.Stripe is missing'));
    };
    if (existing) {
      existing.addEventListener('load', onLoad, { once: true });
      existing.addEventListener(
        'error',
        () => reject(new Error('Stripe.js failed to load')),
        { once: true },
      );
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/';
    script.async = true;
    script.onload = onLoad;
    script.onerror = () => reject(new Error('Stripe.js failed to load'));
    document.head.appendChild(script);
  });
  return stripeP;
}
