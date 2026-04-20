import { BJ_STATS } from '../../../lib/bury-juice/pricing';

interface Stat {
  label: string;
  value: string;
}

const STATS: Stat[] = [
  { value: BJ_STATS.subscribers.toLocaleString('en-GB'), label: 'Active subscribers' },
  { value: `${Math.round(BJ_STATS.open_rate * 100)}%`, label: 'Average open rate' },
  { value: `${(BJ_STATS.ctr * 100).toFixed(1)}%`, label: 'Click-through rate' },
  { value: `${Math.round(BJ_STATS.effective_reach / 1000)}k+`, label: 'Combined reach' },
];

export function StatsBand() {
  return (
    <section style={{ background: 'var(--bj-charcoal)', color: 'var(--bj-white)', padding: '56px 32px' }}>
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: 24,
        }}
      >
        {STATS.map((s) => (
          <div key={s.label}>
            <div
              style={{
                fontWeight: 900,
                fontSize: 'clamp(36px, 5vw, 72px)',
                lineHeight: 1,
                color: 'var(--bj-gold)',
                letterSpacing: '-0.03em',
              }}
            >
              {s.value}
            </div>
            <div
              style={{
                fontSize: 10,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                marginTop: 10,
                color: 'rgba(255,255,255,0.7)',
                fontWeight: 700,
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
