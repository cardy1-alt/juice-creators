import { BJ_STATS } from '../../../lib/bury-juice/pricing';

interface Stat {
  label: string;
  value: string;
}

const STATS: Stat[] = [
  { value: BJ_STATS.subscribers.toLocaleString('en-GB'), label: 'Subscribers' },
  { value: `${Math.round(BJ_STATS.open_rate * 100)}%`, label: 'Open rate' },
  { value: `${(BJ_STATS.ctr * 100).toFixed(1)}%`, label: 'Click-through' },
  { value: `${Math.round(BJ_STATS.effective_reach / 1000)}k+`, label: 'Weekly reach' },
];

export function StatsBand() {
  return (
    <section className="bj-section" style={{ paddingTop: 0 }}>
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--r-card)',
          padding: 24,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: 16,
        }}
      >
        {STATS.map((s) => (
          <div key={s.label}>
            <div
              style={{
                fontWeight: 600,
                fontSize: 28,
                lineHeight: 1.1,
                color: 'var(--ink)',
                letterSpacing: '-0.02em',
              }}
            >
              {s.value}
            </div>
            <div
              style={{
                fontSize: 13,
                marginTop: 4,
                color: 'var(--ink-60)',
              }}
            >
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
