export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer
      style={{
        borderTop: '1px solid var(--border-color)',
        padding: '32px 32px',
        marginTop: 48,
      }}
    >
      <div
        style={{
          maxWidth: 1040,
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          color: 'var(--ink-60)',
          fontSize: 13,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--ink)', fontWeight: 500 }}>Bury Juice</span>
          <span style={{ color: 'var(--ink-35)' }}>·</span>
          <span>Bury St Edmunds · © {year}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <a
            href="mailto:jacob@buryjuice.com"
            style={{ color: 'var(--ink-60)', textDecoration: 'none' }}
          >
            jacob@buryjuice.com
          </a>
          <span style={{ color: 'var(--ink-35)' }}>·</span>
          <span style={{ color: 'var(--ink-35)' }}>Powered by Nayba</span>
        </div>
      </div>
    </footer>
  );
}
