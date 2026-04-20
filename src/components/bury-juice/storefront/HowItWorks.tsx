const STEPS = [
  { n: '01', title: 'Pick your placement', body: 'Bronze, Silver, or Gold — three formats, one per newsletter.' },
  { n: '02', title: 'Choose your dates', body: 'Book a single issue or grab a 4- or 12-pack at a discount.' },
  { n: '03', title: 'Upload, pay, done', body: 'Drop in your creative and pay. Jacob takes it from there.' },
];

export function HowItWorks() {
  return (
    <section className="bj-section">
      <div
        style={{
          fontSize: 10,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--bj-crimson)',
          fontWeight: 700,
          marginBottom: 16,
        }}
      >
        How it works
      </div>
      <h2 style={{ fontSize: 'clamp(32px, 4vw, 48px)', maxWidth: 720, marginBottom: 40 }}>
        Three steps. No back-and-forth. No calendar wrangling.
      </h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 32,
        }}
      >
        {STEPS.map((s) => (
          <div
            key={s.n}
            style={{ borderTop: '1px solid var(--bj-charcoal)', paddingTop: 18 }}
          >
            <div style={{ fontWeight: 900, fontSize: 22, color: 'var(--bj-crimson)' }}>
              {s.n}
            </div>
            <h3 style={{ fontSize: 20, marginTop: 10, marginBottom: 8 }}>{s.title}</h3>
            <p style={{ color: 'var(--bj-mid)', lineHeight: 1.55, margin: 0 }}>{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
