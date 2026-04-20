export function Hero() {
  return (
    <section className="bj-section" style={{ paddingTop: 72, paddingBottom: 72 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
          gap: 48,
          alignItems: 'end',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--bj-crimson)',
              fontWeight: 700,
              marginBottom: 18,
            }}
          >
            Self-serve sponsorships
          </div>
          <h1
            style={{
              fontSize: 'clamp(56px, 9vw, 128px)',
              lineHeight: 0.9,
              color: 'var(--bj-crimson)',
            }}
          >
            Sponsor<br />Bury Juice
          </h1>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div
            className="bj-wordmark"
            style={{ fontSize: 'clamp(32px, 5vw, 56px)', lineHeight: 1 }}
          >
            BURY<br />JUICE
          </div>
        </div>
      </div>
      <div className="bj-rule" style={{ marginTop: 40, marginBottom: 24 }} />
      <p style={{ fontSize: 20, maxWidth: 720, margin: 0 }}>
        The weekly newsletter read by 7,331 people in Bury St Edmunds.
      </p>
    </section>
  );
}
