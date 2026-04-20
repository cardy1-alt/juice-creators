const STEPS = [
  { n: '1', title: 'Pick your placement', body: 'Classified, Feature, or Primary — three formats, one per issue.' },
  { n: '2', title: 'Choose your Thursdays', body: 'Book a single issue, or a 4- or 12-pack at a discount.' },
  { n: '3', title: 'Upload and pay', body: "Drop in your creative, pay securely — Jacob handles the rest." },
];

export function HowItWorks() {
  return (
    <section className="bj-section" style={{ paddingTop: 32 }}>
      <h2 style={{ fontSize: 22, marginBottom: 20 }}>How it works</h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
        }}
      >
        {STEPS.map((s) => (
          <div
            key={s.n}
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--r-card)',
              padding: 20,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 999,
                background: 'var(--terra-light)',
                color: 'var(--terra)',
                fontWeight: 600,
                fontSize: 14,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {s.n}
            </div>
            <h3 style={{ fontSize: 17, marginTop: 12, marginBottom: 4 }}>{s.title}</h3>
            <p style={{ color: 'var(--ink-60)', lineHeight: 1.5, margin: 0, fontSize: 14 }}>{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
