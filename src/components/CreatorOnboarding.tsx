import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowLeft, ArrowRight, Sparkles, Film, Rocket, Check, Clock2, Heart } from 'lucide-react';

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
      <div className="bg-white rounded-[20px] max-w-md w-full p-6 shadow-[0_1px_4px_rgba(44,44,44,0.06),0_4px_16px_rgba(44,44,44,0.04)]">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all ${
                s === step ? 'w-8 bg-[#C4674A]' : 'w-1.5 bg-[rgba(44,44,44,0.1)]'
              }`}
            />
          ))}
        </div>

        {/* Step 1: How it works */}
        {step === 1 && (
          <div className="text-center">
            <Sparkles className="w-10 h-10 text-[#C4674A] mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-[#2C2C2C] mb-3">Welcome to Nayba!</h2>
            <p className="text-[rgba(44,44,44,0.45)] text-sm leading-relaxed mb-6">
              Discover amazing local businesses, claim exclusive offers, and create authentic content
              that showcases what makes them special.
            </p>
            <div className="space-y-3 text-left bg-[#E8EDE8] rounded-[16px] p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-[10px] bg-[#C4674A] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                  1
                </div>
                <div>
                  <p className="font-semibold text-sm text-[#2C2C2C]">Browse & Claim</p>
                  <p className="text-xs text-[rgba(44,44,44,0.45)]">Find offers that match your vibe</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-[10px] bg-[#C4674A] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                  2
                </div>
                <div>
                  <p className="font-semibold text-sm text-[#2C2C2C]">Visit & Experience</p>
                  <p className="text-xs text-[rgba(44,44,44,0.45)]">Show your QR code at the business</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-[10px] bg-[#C4674A] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                  3
                </div>
                <div>
                  <p className="font-semibold text-sm text-[#2C2C2C]">Create & Post</p>
                  <p className="text-xs text-[rgba(44,44,44,0.45)]">Share your authentic experience</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: What's expected */}
        {step === 2 && (
          <div className="text-center">
            <Film className="w-10 h-10 text-[#C4674A] mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-[#2C2C2C] mb-3">What We Expect</h2>
            <p className="text-[rgba(44,44,44,0.45)] text-sm leading-relaxed mb-6">
              Creating authentic content is key to building trust with businesses and your audience.
            </p>
            <div className="space-y-3 text-left">
              <div className="p-4 rounded-[14px] bg-[#E8EDE8]">
                <div className="flex items-center gap-2 mb-1">
                  <Check className="w-4 h-4 text-[#C4674A]" />
                  <p className="font-semibold text-sm text-[#2C2C2C]">Genuine Feature</p>
                </div>
                <p className="text-xs text-[rgba(44,44,44,0.45)] ml-6">
                  Your reel must genuinely showcase the business, product, or experience
                </p>
              </div>
              <div className="p-4 rounded-[14px] bg-[#E8EDE8]">
                <div className="flex items-center gap-2 mb-1">
                  <Clock2 className="w-4 h-4 text-[#C4674A]" />
                  <p className="font-semibold text-sm text-[#2C2C2C]">48-Hour Window</p>
                </div>
                <p className="text-xs text-[rgba(44,44,44,0.45)] ml-6">
                  Post your reel within 48 hours of redeeming your pass
                </p>
              </div>
              <div className="p-4 rounded-[14px] bg-[#E8EDE8]">
                <div className="flex items-center gap-2 mb-1">
                  <Heart className="w-4 h-4 text-[#C4674A]" />
                  <p className="font-semibold text-sm text-[#2C2C2C]">Authentic Voice</p>
                </div>
                <p className="text-xs text-[rgba(44,44,44,0.45)] ml-6">
                  Keep it real — your honest perspective is what makes it valuable
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Platform stats */}
        {step === 3 && (
          <div className="text-center">
            <Rocket className="w-10 h-10 text-[#C4674A] mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-[#2C2C2C] mb-3">You're Ready!</h2>
            <p className="text-[rgba(44,44,44,0.45)] text-sm leading-relaxed mb-6">
              Join a growing community of creators and businesses making authentic connections.
            </p>
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="p-4 rounded-[14px] bg-[#E8EDE8]">
                <p className="text-3xl font-bold mb-1 text-[#2C2C2C]">{businessCount}</p>
                <p className="text-xs font-medium text-[rgba(44,44,44,0.45)]">Active Businesses</p>
              </div>
              <div className="p-4 rounded-[14px] bg-[#E8EDE8]">
                <p className="text-3xl font-bold mb-1 text-[#2C2C2C]">{offerCount}</p>
                <p className="text-xs font-medium text-[rgba(44,44,44,0.45)]">Live Offers</p>
              </div>
            </div>
            <p className="text-xs text-[rgba(44,44,44,0.25)]">
              Start exploring and claim your first offer to get the ball rolling!
            </p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6 pt-6 border-t border-[rgba(44,44,44,0.1)]">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="flex items-center gap-2 px-4 py-2 rounded-[12px] text-sm font-semibold text-[#2C2C2C] hover:bg-[#E8EDE8] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-[13px] text-sm font-semibold bg-[#C4674A] text-white hover:bg-[#b35a3f] transition-colors ml-auto"
            >
              Next <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleComplete}
              className="px-5 py-2.5 rounded-[13px] text-sm font-semibold bg-[#C4674A] text-white hover:bg-[#b35a3f] transition-colors ml-auto"
            >
              Got it!
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
