// Testimonials from Bury Juice sponsors + one reader. Mix on purpose
// — sponsor quotes confirm the service, the reader quote confirms
// audience engagement (which is what the next sponsor actually buys).

interface Testimonial {
  quote: string;
  name: string;
  role: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "I recently sponsored Bury Juice's newsletter, and the experience was fantastic! The service was seamless and Jacob was incredibly friendly and knowledgeable. It's a great way to reach thousands of their engaged subscribers. I highly recommend it!",
    name: 'Pia',
    role: 'Toddle About Suffolk',
  },
  {
    quote:
      "We are incredibly grateful to The Bury Juice for including us in their exceptional newsletter. The passion behind their project is clear and this support is vital for small but mighty businesses like ours. Connection and community is key, and this is exactly what Bury Juice provides — it has made a massive difference to us.",
    name: 'Nicki',
    role: 'Joy Connection',
  },
  {
    quote:
      "This newsletter gives me the info to get out there and be involved and be happy! Thanks for what you do!",
    name: 'Jennifer',
    role: 'Subscriber',
  },
];

export function Testimonials() {
  return (
    <section style={{ maxWidth: 840, margin: '0 auto', padding: '36px 24px 0' }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          textAlign: 'center',
          color: 'var(--terra)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          marginBottom: 20,
        }}
      >
        In their words
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 14,
        }}
      >
        {TESTIMONIALS.map((t) => (
          <figure
            key={t.name}
            style={{
              margin: 0,
              padding: 18,
              background: 'var(--card)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--r-card)',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <span
              aria-hidden
              style={{
                fontFamily: 'Georgia, serif',
                fontSize: 36,
                lineHeight: 0.8,
                color: 'var(--terra)',
                fontWeight: 700,
                marginBottom: -10,
              }}
            >
              &ldquo;
            </span>
            <blockquote
              style={{
                margin: 0,
                fontSize: 14,
                lineHeight: 1.55,
                color: 'var(--ink)',
              }}
            >
              {t.quote}
            </blockquote>
            <figcaption
              style={{
                marginTop: 'auto',
                fontSize: 13,
                color: 'var(--ink-60)',
                borderTop: '1px solid var(--border-color)',
                paddingTop: 10,
              }}
            >
              <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>{t.name}</strong>
              <span style={{ marginLeft: 6 }}>· {t.role}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
