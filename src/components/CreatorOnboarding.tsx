import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowRight } from 'lucide-react';

interface CreatorOnboardingProps {
  creatorId: string;
  onComplete: () => void;
}

export default function CreatorOnboarding({ creatorId, onComplete }: CreatorOnboardingProps) {
  const [step, setStep] = useState(1);
  const [businessCount, setBusinessCount] = useState(0);
  const [offerCount, setOfferCount] = useState(0);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const { count: bCount } = await supabase
      .from('businesses')
      .select('*', { count: 'exact', head: true })
      .eq('approved', true);

    const { count: oCount } = await supabase
      .from('offers')
      .select('*', { count: 'exact', head: true })
      .eq('is_live', true);

    setBusinessCount(bCount || 0);
    setOfferCount(oCount || 0);
  };

  const handleComplete = async () => {
    try {
      const { error } = await supabase
        .from('creators')
        .update({ onboarding_complete: true })
        .eq('id', creatorId);
      if (error) throw error;
      onComplete();
    } catch (err: any) {
      console.error('Failed to complete onboarding:', err.message);
    }
  };

  // Screen 1: Lavender
  if (step === 1) {
    return (
      <div className="fixed inset-0 z-50 overflow-hidden" style={{ background: '#C8B8F0' }}>
        <div className="relative w-full h-full" style={{ padding: '48px 28px 0' }}>
          {/* Wordmark */}
          <span style={{ fontSize: '26px', fontWeight: 700, color: '#222222', letterSpacing: '-0.3px', fontFamily: "'Libre Baskerville', serif" }}>
            nayba
          </span>

          {/* Squiggle top-right */}
          <svg
            style={{ position: 'absolute', top: 40, right: 20 }}
            width="80" height="60" viewBox="0 0 80 60" fill="none"
          >
            <path d="M5 45 C20 10, 40 55, 60 20 S80 40, 75 15" stroke="#1A3C34" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.3" />
          </svg>

          {/* Tag pill */}
          <div style={{ marginTop: 36 }}>
            <span style={{
              background: 'rgba(255,255,255,0.45)',
              color: '#222222',
              fontSize: '11px',
              fontWeight: 700,
              borderRadius: '50px',
              padding: '6px 14px',
              display: 'inline-block',
            }}>
              Local creators wanted
            </span>
          </div>

          {/* Hero headline */}
          <h1 style={{
            fontSize: '44px',
            fontWeight: 800,
            color: '#222222',
            letterSpacing: '-1.2px',
            lineHeight: 1.05,
            marginTop: 16,
          }}>
            Be a good<br />
            <em style={{ fontStyle: 'italic' }}>nayba.</em>
          </h1>

          {/* Subtitle */}
          <p style={{
            fontSize: '13px',
            fontWeight: 400,
            color: 'rgba(34,34,34,0.55)',
            lineHeight: 1.65,
            maxWidth: '175px',
            marginTop: 14,
          }}>
            Discover local businesses, claim offers, and create authentic content.
          </p>

          {/* CTA */}
          <button
            onClick={() => setStep(2)}
            style={{
              marginTop: 28,
              background: '#222222',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: 700,
              borderRadius: '50px',
              padding: '13px 26px',
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            Get started <ArrowRight size={16} />
          </button>

          {/* Photo blob bottom-right */}
          <div style={{
            position: 'absolute',
            bottom: 0,
            right: 20,
            width: '185px',
            height: '270px',
            borderRadius: '110px 110px 0 0',
            background: 'linear-gradient(180deg, #b5a3e0 0%, #9882d4 100%)',
            overflow: 'hidden',
          }}>
            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(255,255,255,0.3)',
              fontSize: '48px',
              fontWeight: 800,
            }}>
              n
            </div>
          </div>

          {/* Squiggle bottom-left */}
          <svg
            style={{ position: 'absolute', bottom: 60, left: 20 }}
            width="100" height="80" viewBox="0 0 100 80" fill="none"
          >
            <path d="M10 70 C25 30, 50 70, 70 35 S90 55, 95 25" stroke="#F4A8C0" strokeWidth="6" strokeLinecap="round" fill="none" />
          </svg>
        </div>
      </div>
    );
  }

  // Screen 2: Peach
  if (step === 2) {
    return (
      <div className="fixed inset-0 z-50 overflow-hidden" style={{ background: '#F5C4A0' }}>
        <div className="relative w-full h-full" style={{ padding: '48px 28px 0' }}>
          {/* Wordmark */}
          <span style={{ fontSize: '26px', fontWeight: 700, color: '#222222', letterSpacing: '-0.3px', fontFamily: "'Libre Baskerville', serif" }}>
            nayba
          </span>

          {/* Step indicator */}
          <div style={{ marginTop: 36 }}>
            <span style={{
              background: 'rgba(255,255,255,0.5)',
              color: '#222222',
              fontSize: '11px',
              fontWeight: 700,
              borderRadius: '50px',
              padding: '6px 14px',
              display: 'inline-block',
            }}>
              Step 2 of 3
            </span>
          </div>

          {/* Hero headline */}
          <h1 style={{
            fontSize: '44px',
            fontWeight: 800,
            color: '#222222',
            letterSpacing: '-1.2px',
            lineHeight: 1.05,
            marginTop: 16,
          }}>
            Your<br />
            <em style={{ fontStyle: 'italic' }}>local</em><br />
            stage.
          </h1>

          {/* Subtitle */}
          <p style={{
            fontSize: '13px',
            fontWeight: 400,
            color: 'rgba(34,34,34,0.5)',
            lineHeight: 1.65,
            maxWidth: '175px',
            marginTop: 14,
          }}>
            {businessCount} businesses and {offerCount} offers waiting for you.
          </p>

          {/* CTA + Skip */}
          <div style={{ marginTop: 28, display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={() => setStep(3)}
              style={{
                background: '#222222',
                color: '#FFFFFF',
                fontSize: '14px',
                fontWeight: 700,
                borderRadius: '50px',
                padding: '13px 26px',
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              Continue <ArrowRight size={16} />
            </button>
            <button
              onClick={handleComplete}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(34,34,34,0.5)',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Skip
            </button>
          </div>

          {/* Photo blob bottom-right */}
          <div style={{
            position: 'absolute',
            bottom: 0,
            right: 20,
            width: '185px',
            height: '270px',
            borderRadius: '110px 110px 0 0',
            background: 'linear-gradient(180deg, #f0b088 0%, #e89e6e 100%)',
            overflow: 'hidden',
          }}>
            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(255,255,255,0.3)',
              fontSize: '48px',
              fontWeight: 800,
            }}>
              n
            </div>
          </div>

          {/* Squiggle + dots */}
          <svg
            style={{ position: 'absolute', bottom: 80, left: 20 }}
            width="100" height="70" viewBox="0 0 100 70" fill="none"
          >
            <path d="M8 60 C20 25, 45 65, 65 30 S85 50, 92 20" stroke="#F4A8C0" strokeWidth="6" strokeLinecap="round" fill="none" />
            <circle cx="15" cy="15" r="5" fill="var(--terra)" opacity="0.6" />
            <circle cx="80" cy="55" r="4" fill="#1A3C34" opacity="0.4" />
          </svg>
        </div>
      </div>
    );
  }

  // Screen 3: Final (white, ready to go)
  return (
    <div className="fixed inset-0 z-50 overflow-hidden" style={{ background: '#FFFFFF' }}>
      <div className="relative w-full h-full flex flex-col items-center justify-center" style={{ padding: '48px 28px' }}>
        {/* Wordmark */}
        <span style={{ fontSize: '26px', fontWeight: 700, color: '#222222', letterSpacing: '-0.3px', fontFamily: "'Libre Baskerville', serif", marginBottom: 32 }}>
          nayba
        </span>

        {/* Step indicator */}
        <span style={{
          background: 'var(--faint)',
          color: '#222222',
          fontSize: '11px',
          fontWeight: 700,
          borderRadius: '50px',
          padding: '6px 14px',
          display: 'inline-block',
          marginBottom: 20,
        }}>
          Step 3 of 3
        </span>

        <h1 style={{
          fontSize: '44px',
          fontWeight: 800,
          color: '#222222',
          letterSpacing: '-1.2px',
          lineHeight: 1.05,
          textAlign: 'center',
        }}>
          You're<br />
          <em style={{ fontStyle: 'italic' }}>ready.</em>
        </h1>

        <p style={{
          fontSize: '13px',
          fontWeight: 400,
          color: 'rgba(34,34,34,0.5)',
          lineHeight: 1.65,
          textAlign: 'center',
          maxWidth: '220px',
          marginTop: 14,
        }}>
          {businessCount} businesses and {offerCount} live offers are waiting for you to explore.
        </p>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '12px', marginTop: 28 }}>
          <div style={{
            background: 'var(--bg)',
            borderRadius: '14px',
            padding: '16px 20px',
            textAlign: 'center',
            minWidth: '100px',
          }}>
            <p style={{ fontSize: '28px', fontWeight: 800, color: '#222222' }}>{businessCount}</p>
            <p style={{ fontSize: '10px', fontWeight: 500, color: 'var(--mid)' }}>Businesses</p>
          </div>
          <div style={{
            background: 'var(--bg)',
            borderRadius: '14px',
            padding: '16px 20px',
            textAlign: 'center',
            minWidth: '100px',
          }}>
            <p style={{ fontSize: '28px', fontWeight: 800, color: '#222222' }}>{offerCount}</p>
            <p style={{ fontSize: '10px', fontWeight: 500, color: 'var(--mid)' }}>Live Offers</p>
          </div>
        </div>

        <button
          onClick={handleComplete}
          style={{
            marginTop: 32,
            background: 'var(--terra)',
            color: '#FFFFFF',
            fontSize: '14px',
            fontWeight: 700,
            borderRadius: '50px',
            padding: '13px 30px',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Start exploring
        </button>
      </div>
    </div>
  );
}
