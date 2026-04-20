export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer style={{ background: 'var(--bj-crimson)', color: 'var(--bj-white)', padding: '40px 32px' }}>
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div
          style={{
            fontWeight: 900,
            fontSize: 22,
            textTransform: 'uppercase',
            letterSpacing: '-0.02em',
          }}
        >
          Bury Juice
        </div>
        <div style={{ fontSize: 13, opacity: 0.85 }}>© {year} Bury Juice · Bury St Edmunds</div>
        <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
          <a href="mailto:jacob@buryjuice.com" style={{ color: 'var(--bj-white)', textDecoration: 'underline' }}>
            jacob@buryjuice.com
          </a>
        </div>
      </div>
    </footer>
  );
}
