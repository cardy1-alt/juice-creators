import { useState } from 'react';

const ITEMS = [
  {
    q: 'What size/format are the ads?',
    a: 'Bronze is a classified-style block at the bottom (headline + copy + link). Silver is a feature block with a 600px-wide photo. Gold is the primary placement at the top — logo, photo, headline, copy, link. Examples are in the media kit linked from the footer.',
  },
  {
    q: 'When do I submit my creative?',
    a: 'At checkout if you have it ready, or any time via your sponsor dashboard up to 48 hours before the issue sends. Tuesdays at 8pm is the hard cutoff for a Thursday issue.',
  },
  {
    q: 'Can I change my creative between placements?',
    a: 'Yes. Your sponsor dashboard link is emailed after checkout. You can upload a new headline, copy, photo, or link for each booked Thursday up to the 48-hour cutoff.',
  },
  {
    q: 'What is the refund policy?',
    a: 'Pack credits stay on file for six months from purchase. We do not issue cash refunds once a pack has been purchased, but you can reassign credits to any available Thursday during that window.',
  },
  {
    q: 'Who do I contact for bespoke deals?',
    a: 'Email jacob@buryjuice.com. Anything custom — video features, exclusive category sponsorships, long-horizon buys — is a conversation, not a storefront transaction.',
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
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
        Good questions
      </div>
      <h2 style={{ fontSize: 'clamp(32px, 4vw, 48px)', marginBottom: 32 }}>FAQ</h2>
      <div style={{ borderTop: '1px solid var(--bj-charcoal)' }}>
        {ITEMS.map((item, i) => {
          const isOpen = open === i;
          return (
            <div key={item.q} style={{ borderBottom: '1px solid var(--bj-charcoal)' }}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '18px 0',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontFamily: 'inherit',
                }}
              >
                <span style={{ fontSize: 18, fontWeight: 700 }}>{item.q}</span>
                <span
                  style={{
                    fontSize: 22,
                    fontWeight: 900,
                    color: 'var(--bj-crimson)',
                    transform: isOpen ? 'rotate(45deg)' : 'none',
                    transition: 'transform 0.15s ease',
                  }}
                  aria-hidden
                >
                  +
                </span>
              </button>
              {isOpen && (
                <div style={{ paddingBottom: 20, maxWidth: 720, lineHeight: 1.6, color: 'var(--bj-mid)' }}>
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
