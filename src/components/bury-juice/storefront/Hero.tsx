export function Hero() {
  return (
    <section className="bj-section" style={{ paddingTop: 72, paddingBottom: 24 }}>
      <div
        style={{
          fontSize: 12,
          letterSpacing: 0,
          fontWeight: 600,
          color: 'var(--terra)',
          marginBottom: 12,
        }}
      >
        Bury Juice · Sponsorships
      </div>
      <h1
        style={{
          fontSize: 'clamp(32px, 6vw, 52px)',
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
          color: 'var(--ink)',
          maxWidth: 680,
        }}
      >
        Put your business in front of Bury St Edmunds.
      </h1>
      <p
        style={{
          fontSize: 17,
          lineHeight: 1.55,
          color: 'var(--ink-60)',
          maxWidth: 620,
          marginTop: 14,
          marginBottom: 0,
        }}
      >
        Bury Juice is the weekly local newsletter — pick a placement, pick your Thursdays,
        and be in the next issue.
      </p>
    </section>
  );
}
