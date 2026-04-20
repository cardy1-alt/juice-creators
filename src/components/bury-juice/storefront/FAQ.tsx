import { useState } from 'react';

const ITEMS = [
  {
    q: 'What size and format are the ads?',
    a: 'Classified is a block at the bottom with headline, copy and a link. Feature is a middle-of-newsletter slot with a 600px-wide photo. Primary is the top-of-newsletter placement with a logo, photo, headline, copy and a link.',
  },
  {
    q: 'When do I submit my creative?',
    a: 'At checkout if you have it ready, or any time via your sponsor dashboard up to 48 hours before the issue sends. Tuesdays at 8pm is the hard cutoff for a Thursday issue.',
  },
  {
    q: 'Can I change my creative between placements?',
    a: 'Yes. Your dashboard link is emailed after checkout. Update headline, copy, photo or link for each booked Thursday any time before the 48-hour cutoff.',
  },
  {
    q: 'What is the refund policy?',
    a: 'Pack credits stay on file for six months from purchase. We don’t issue cash refunds, but you can reassign credits to any available Thursday during that window.',
  },
  {
    q: 'Who do I contact for bespoke deals?',
    a: 'Email jacob@buryjuice.com. Anything custom — video features, category sponsorship, long-horizon buys — is a conversation, not a storefront transaction.',
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="bj-section" style={{ paddingTop: 32 }}>
      <h2 style={{ fontSize: 22, marginBottom: 16 }}>Questions</h2>
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--r-card)',
          overflow: 'hidden',
        }}
      >
        {ITEMS.map((item, i) => {
          const isOpen = open === i;
          const isLast = i === ITEMS.length - 1;
          return (
            <div
              key={item.q}
              style={{ borderBottom: isLast ? 'none' : '1px solid var(--border-color)' }}
            >
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '16px 20px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontFamily: 'inherit',
                  color: 'var(--ink)',
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 500 }}>{item.q}</span>
                <span
                  style={{
                    fontSize: 18,
                    color: 'var(--terra)',
                    transform: isOpen ? 'rotate(45deg)' : 'none',
                    transition: 'transform 0.15s ease',
                    flexShrink: 0,
                    marginLeft: 12,
                  }}
                  aria-hidden
                >
                  +
                </span>
              </button>
              {isOpen && (
                <div
                  style={{
                    padding: '0 20px 18px',
                    lineHeight: 1.55,
                    color: 'var(--ink-60)',
                    fontSize: 14,
                    maxWidth: 720,
                  }}
                >
                  {item.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
