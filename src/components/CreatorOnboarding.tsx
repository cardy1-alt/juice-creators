import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowLeft, ArrowRight } from 'lucide-react';

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
    await supabase
      .from('creators')
      .update({ onboarding_complete: true })
      .eq('id', creatorId);
    onComplete();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-[#FAF8F2] rounded-2xl max-w-md w-full p-6 shadow-2xl">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all ${
                s === step ? 'w-8 bg-[#1A3C34]' : 'w-1.5 bg-[rgba(26,60,52,0.1)]'
              }`}
            />
          ))}
        </div>

        {/* Step 1: How it works */}
        {step === 1 && (
          <div className="text-center">
            <div className="text-5xl mb-4">✨</div>
            <h2 className="text-2xl font-bold text-[#2C2C2C] mb-3" style={{ fontFamily: "'Crimson Pro', serif" }}>Welcome to Nayba!</h2>
            <p className="text-gray-600 text-sm leading-relaxed mb-6">
              Discover amazing local businesses, claim exclusive offers, and create authentic content
              that showcases what makes them special.
            </p>
            <div className="space-y-3 text-left bg-[#E8EDE8] rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#1A3C34] text-[#FAF8F2] flex items-center justify-center font-bold text-sm flex-shrink-0">
                  1
                </div>
                <div>
                  <p className="font-semibold text-sm text-[#2C2C2C]">Browse & Claim</p>
                  <p className="text-xs text-gray-600">Find offers that match your vibe</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#1A3C34] text-[#FAF8F2] flex items-center justify-center font-bold text-sm flex-shrink-0">
                  2
                </div>
                <div>
                  <p className="font-semibold text-sm text-[#2C2C2C]">Visit & Experience</p>
                  <p className="text-xs text-gray-600">Show your QR code at the business</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#1A3C34] text-[#FAF8F2] flex items-center justify-center font-bold text-sm flex-shrink-0">
                  3
                </div>
                <div>
                  <p className="font-semibold text-sm text-[#2C2C2C]">Create & Post</p>
                  <p className="text-xs text-gray-600">Share your authentic experience</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: What's expected */}
        {step === 2 && (
          <div className="text-center">
            <div className="text-5xl mb-4">🎬</div>
            <h2 className="text-2xl font-bold text-[#2C2C2C] mb-3" style={{ fontFamily: "'Crimson Pro', serif" }}>What We Expect</h2>
            <p className="text-gray-600 text-sm leading-relaxed mb-6">
              Creating authentic content is key to building trust with businesses and your audience.
            </p>
            <div className="space-y-3 text-left">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                <p className="font-semibold text-sm text-emerald-700 mb-1">✓ Genuine Feature</p>
                <p className="text-xs text-gray-600">
                  Your reel must genuinely showcase the business, product, or experience
                </p>
              </div>
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-100">
                <p className="font-semibold text-sm text-amber-700 mb-1">⏱ 48-Hour Window</p>
                <p className="text-xs text-gray-600">
                  Post your reel within 48 hours of redeeming your pass
                </p>
              </div>
              <div className="p-4 rounded-xl bg-sky-50 border border-sky-100">
                <p className="font-semibold text-sm text-sky-700 mb-1">🤝 Authentic Voice</p>
                <p className="text-xs text-gray-600">
                  Keep it real — your honest perspective is what makes it valuable
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Platform stats */}
        {step === 3 && (
          <div className="text-center">
            <div className="text-5xl mb-4">🚀</div>
            <h2 className="text-2xl font-bold text-[#2C2C2C] mb-3" style={{ fontFamily: "'Crimson Pro', serif" }}>You're Ready!</h2>
            <p className="text-gray-600 text-sm leading-relaxed mb-6">
              Join a growing community of creators and businesses making authentic connections.
            </p>
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="p-4 rounded-xl bg-gradient-to-br from-[#1A3C34] to-[#2a5c4f] text-white">
                <p className="text-3xl font-bold mb-1">{businessCount}</p>
                <p className="text-xs font-medium opacity-90">Active Businesses</p>
              </div>
              <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
                <p className="text-3xl font-bold mb-1">{offerCount}</p>
                <p className="text-xs font-medium opacity-90">Live Offers</p>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Start exploring and claim your first offer to get the ball rolling!
            </p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6 pt-6 border-t border-[rgba(26,60,52,0.1)]">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 hover:bg-[#E8EDE8] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-[#1A3C34] text-[#FAF8F2] hover:bg-[#15332c] transition-colors ml-auto"
            >
              Next <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleComplete}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-[#1A3C34] text-[#FAF8F2] hover:bg-[#15332c] transition-colors ml-auto"
            >
              Got it!
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
