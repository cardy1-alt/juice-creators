import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  LogOut, Plus, ExternalLink, Camera, Bell,
  Package, Users, Film, LayoutDashboard,
  CheckCircle2, XCircle, VideoOff, Flag,
  Sparkles, ClipboardList, Clock, ScanLine,
  Gift, Tag, Star, ChevronLeft, Minus, Info, Video,
  Check
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { getCategoryGradient } from '../lib/categories';
import { getInitials } from '../lib/avatar';
import DisputeModal from './DisputeModal';
import { Logo } from './Logo';

interface Offer {
  id: string;
  description: string;
  monthly_cap: number | null;
  is_live: boolean;
  created_at: string;
  slotsUsed?: number;
  offer_type?: string | null;
  offer_item?: string | null;
  content_type?: string | null;
  specific_ask?: string | null;
  generated_title?: string | null;
}

interface ClaimWithDetails {
  id: string;
  status: string;
  claimed_at: string;
  redeemed_at: string | null;
  reel_url: string | null;
  qr_token: string;
  creators: { name: string; instagram_handle: string; code: string };
  offers?: { description: string; generated_title?: string | null };
}

interface Notification {
  id: string;
  message: string;
  read: boolean;
  created_at: string;
}

// ─── Pulsing live dot animation ───────────────────────────────────────────
const livePulseStyle = `
@keyframes livePulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.75); }
}
`;

// ─── Offer Builder placeholder map ────────────────────────────────────────
function getCategoryPlaceholder(category: string | undefined | null, type: string): string {
  const map: Record<string, Record<string, string>> = {
    'Cafe & Coffee':        { product: 'coffee + pastry',           service: 'barista experience',       experience: 'coffee tasting session' },
    'Food & Drink':         { product: 'meal or drink',             service: 'chef experience',          experience: 'tasting session' },
    'Hair & Beauty':        { product: 'product of your choice',    service: 'express facial',           experience: 'pamper session' },
    'Health & Fitness':     { product: 'supplement of your choice', service: 'personal training session', experience: 'fitness class' },
    'Retail':               { product: 'item of your choice',       service: 'styling session',          experience: 'shopping experience' },
    'Wellness & Spa':       { product: 'product of your choice',    service: '30-minute massage',        experience: 'wellness session' },
    'Arts & Entertainment': { product: 'item of your choice',       service: 'class or lesson',          experience: 'event or show entry' },
    'Pets':                 { product: 'treat or accessory',        service: 'grooming session',         experience: 'pet experience' },
    'Education':            { product: 'resource or material',      service: 'tutoring session',         experience: 'workshop or class' },
  };
  return map[category || '']?.[type] ?? 'your choice';
}

// Keep backward-compatible alias
function getOfferPlaceholder(category: string | undefined | null, offerType: string): string {
  return getCategoryPlaceholder(category, offerType);
}

function QRScanner({ onScan, active }: { onScan: (token: string) => void; active: boolean }) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const startScanner = async () => {
    setCameraError(null);
    try {
      const scanner = new Html5Qrcode('qr-scanner-region');
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          let token = decodedText;
          try {
            const url = new URL(decodedText);
            const redeemParam = url.searchParams.get('redeem');
            if (redeemParam) token = redeemParam;
          } catch {
            // Not a URL — use the raw scanned value
          }
          onScan(token);
          scanner.stop().catch(() => {});
          setScanning(false);
        },
        () => {}
      );
      setScanning(true);
    } catch (err: any) {
      const msg = String(err?.message || err);
      if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
        setCameraError('Camera permission denied. Please allow camera access in your browser settings.');
      } else if (msg.includes('NotFoundError')) {
        setCameraError('No camera found on this device.');
      } else {
        setCameraError('Could not start camera. Use the code field below instead.');
      }
    }
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
      scannerRef.current = null;
    }
    setScanning(false);
  };

  useEffect(() => {
    return () => { stopScanner(); };
  }, []);

  useEffect(() => {
    if (!active && scanning) stopScanner();
  }, [active]);

  if (cameraError) {
    return (
      <div className="p-5 rounded-[20px] bg-amber-50 border border-amber-100 text-center">
        <VideoOff className="w-6 h-6 text-amber-500 mx-auto mb-2" />
        <p className="text-[14px] text-amber-700">{cameraError}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="relative mx-auto" style={{ maxWidth: '280px' }}>
        <div
          id="qr-scanner-region"
          className="rounded-[20px] overflow-hidden"
          style={{ display: scanning ? 'block' : 'none', background: '#222222' }}
        />
        {/* Corner brackets */}
        {scanning && (
          <>
            <svg className="absolute top-2 left-2 w-6 h-6" viewBox="0 0 24 24" fill="none">
              <path d="M2 8V2h6" stroke="var(--terra)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <svg className="absolute top-2 right-2 w-6 h-6" viewBox="0 0 24 24" fill="none">
              <path d="M22 8V2h-6" stroke="var(--terra)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <svg className="absolute bottom-2 left-2 w-6 h-6" viewBox="0 0 24 24" fill="none">
              <path d="M2 16v6h6" stroke="var(--terra)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <svg className="absolute bottom-2 right-2 w-6 h-6" viewBox="0 0 24 24" fill="none">
              <path d="M22 16v6h-6" stroke="var(--terra)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </>
        )}
      </div>
      {scanning && (
        <p className="text-[12px] text-[var(--soft)] text-center mt-3">Point at the creator's QR code</p>
      )}
      {!scanning && (
        <button
          onClick={startScanner}
          className="w-full flex items-center justify-center gap-2 py-[14px] rounded-[50px] font-bold text-[14px] bg-[var(--terra)] text-white hover:bg-[var(--terra-hover)] transition-all min-h-[48px]"
        >
          <Camera className="w-[18px] h-[18px]" /> Open Camera
        </button>
      )}
      {scanning && (
        <button
          onClick={stopScanner}
          className="w-full mt-3 py-[10px] rounded-[50px] font-semibold text-[13px] bg-[var(--bg)] text-[var(--mid)] hover:bg-[#ececec] transition-all border border-[var(--faint)] min-h-[44px]"
        >
          Stop Scanner
        </button>
      )}
    </div>
  );
}

// ─── Offer Builder Wizard ─────────────────────────────────────────────────

interface OfferBuilderProps {
  category: string | undefined | null;
  instagramHandle?: string;
  onComplete: (data: {
    offer_type: string;
    offer_item: string;
    monthly_cap: number;
    specific_ask: string | null;
    generated_title: string;
    // content_type locked to 'reel' at launch — expand to 'story'|'post' later
    content_type: string;
  }) => void;
  onCancel: () => void;
}

function OfferBuilder({ category, instagramHandle, onComplete, onCancel }: OfferBuilderProps) {
  const [screen, setScreen] = useState(1);
  const [offerType, setOfferType] = useState('');
  const [offerItem, setOfferItem] = useState('');
  const [monthlyCap, setMonthlyCap] = useState(4);
  const [specificAsk, setSpecificAsk] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [discountAmount, setDiscountAmount] = useState('20');
  const [discountUnit, setDiscountUnit] = useState<'%' | '£'>('%');

  const generatedTitle = offerType === 'discount'
    ? (discountUnit === '%' ? `${discountAmount}% off` : `£${discountAmount} off`)
    : `Free ${offerItem}`;

  const tiles = [
    { key: 'product', label: 'Free Product', icon: Gift, sub: 'Coffee, meal, item' },
    { key: 'service', label: 'Free Service', icon: Sparkles, sub: 'Haircut, facial, class' },
    { key: 'discount', label: 'Discount', icon: Tag, sub: '% off or £ off' },
    { key: 'experience', label: 'Experience', icon: Star, sub: 'Tasting, tour, event' },
  ];

  const exampleChips = [
    instagramHandle ? `Please tag us @${instagramHandle}` : 'Please tag us',
    'Mention we\'re dog-friendly',
    'Show the before and after',
  ];

  const handleGoLive = async () => {
    setIsSubmitting(true);
    onComplete({
      offer_type: offerType,
      offer_item: offerType === 'discount' ? `${discountAmount}${discountUnit}` : offerItem,
      monthly_cap: monthlyCap,
      specific_ask: specificAsk.trim() || null,
      generated_title: generatedTitle,
      content_type: 'reel',
    });
  };

  if (showSuccess) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center px-6">
        <CheckCircle2 className="w-14 h-14 text-[var(--terra)] mb-4" />
        <p className="text-[22px] font-extrabold text-[#222222] text-center" style={{ letterSpacing: '-0.4px' }}>Your offer is live!</p>
        <p className="text-[14px] text-[var(--mid)] text-center mt-2">Creators can now discover and claim it</p>
        <button
          onClick={onCancel}
          className="mt-6 px-[28px] py-[13px] rounded-[50px] bg-[var(--terra)] text-white font-bold text-[14px] hover:bg-[var(--terra-hover)] transition-all min-h-[48px]"
        >
          View offer
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col overflow-y-auto">
      <style>{livePulseStyle}</style>

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <button onClick={screen === 1 ? onCancel : () => setScreen(screen - 1)} className="p-2 -ml-2 min-h-[44px] min-w-[44px] flex items-center justify-center">
          <ChevronLeft className="w-5 h-5 text-[#222222]" />
        </button>
        {screen === 4 && (
          <button onClick={() => { setSpecificAsk(''); setScreen(5); }} className="text-[14px] font-semibold text-[var(--mid)] min-h-[44px] flex items-center">
            Skip
          </button>
        )}
      </div>

      {/* Progress bar (screens 1-4) */}
      {screen <= 4 && (
        <div className="px-5 mb-1">
          <div className="flex gap-1.5">
            {[1, 2, 3, 4].map(s => (
              <div key={s} className="flex-1 h-[3px] rounded-[3px]" style={{ background: s <= screen ? 'var(--terra)' : 'var(--bg)' }} />
            ))}
          </div>
          <p className="text-[11px] text-[var(--soft)] text-right mt-1.5">Step {Math.min(screen, 4)} of 4</p>
        </div>
      )}

      <div className="flex-1 px-5 pb-8">
        {/* ── Screen 1: What are you offering? ── */}
        {screen === 1 && (
          <div>
            <h2 className="text-[22px] font-extrabold text-[#222222] mt-4 mb-1" style={{ letterSpacing: '-0.4px' }}>What are you offering?</h2>
            <p className="text-[14px] text-[var(--mid)] mb-6" style={{ lineHeight: '1.6' }}>Choose the type of experience</p>
            <div className="grid grid-cols-2 gap-3">
              {tiles.map(t => (
                <button
                  key={t.key}
                  onClick={() => {
                    setOfferType(t.key);
                    setOfferItem('');
                    setDiscountAmount('20');
                    setDiscountUnit('%');
                    setScreen(2);
                  }}
                  className={`flex flex-col items-center justify-center gap-2.5 rounded-[20px] min-h-[110px] transition-all ${
                    offerType === t.key
                      ? 'border-2 border-[var(--terra)]'
                      : 'border-[1.5px] border-[var(--faint)]'
                  }`}
                  style={{
                    padding: '24px 20px',
                    background: offerType === t.key ? 'rgba(196,103,74,0.04)' : 'white',
                  }}
                >
                  <t.icon className="w-7 h-7 text-[#222222]" />
                  <div className="text-center">
                    <p className="text-[14px] font-bold text-[#222222]">{t.label}</p>
                    <p className="text-[12px] text-[var(--mid)] mt-0.5">{t.sub}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Screen 2: Fill in the blank ── */}
        {screen === 2 && offerType !== 'discount' && (
          <div>
            <h2 className="text-[22px] font-extrabold text-[#222222] mt-4 mb-1" style={{ letterSpacing: '-0.4px' }}>What exactly will you give?</h2>
            <p className="text-[14px] text-[var(--mid)] mb-8" style={{ lineHeight: '1.6' }}>We'll use this to create your offer card</p>

            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-[22px] font-extrabold text-[#222222]">Free</span>
              <input
                type="text"
                value={offerItem}
                onChange={e => setOfferItem(e.target.value.slice(0, 60))}
                placeholder={getCategoryPlaceholder(category, offerType)}
                className="flex-1 text-[22px] font-extrabold text-[#222222] border-b-2 border-[var(--terra)] bg-transparent outline-none placeholder:text-[var(--soft)] placeholder:font-extrabold"
                autoFocus
              />
            </div>
            <p className="text-[11px] text-[var(--soft)] text-right mb-4">{offerItem.length}/60</p>

            <p className="text-[13px] text-[var(--mid)]">
              Creators will see: <span className="font-semibold">Free {offerItem || getCategoryPlaceholder(category, offerType)}</span>
            </p>

            <button
              onClick={() => setScreen(3)}
              disabled={offerItem.trim().length < 3}
              className={`w-full mt-8 py-[14px] rounded-[50px] font-bold text-[14px] transition-all min-h-[52px] ${
                offerItem.trim().length >= 3
                  ? 'bg-[var(--terra)] text-white hover:bg-[var(--terra-hover)]'
                  : 'bg-[var(--bg)] text-[var(--soft)]'
              }`}
            >
              Next
            </button>
          </div>
        )}

        {/* ── Screen 2 (Discount): Amount + unit toggle ── */}
        {screen === 2 && offerType === 'discount' && (
          <div>
            <h2 className="text-[22px] font-extrabold text-[#222222] mt-4 mb-1" style={{ letterSpacing: '-0.4px' }}>What's the discount?</h2>
            <p className="text-[14px] text-[var(--mid)] mb-8" style={{ lineHeight: '1.6' }}>Set the amount creators will receive</p>

            <div className="flex justify-center mb-4">
              <input
                type="number"
                value={discountAmount}
                onChange={e => {
                  const max = discountUnit === '%' ? 100 : 999;
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  if (val === '' || (parseInt(val) >= 1 && parseInt(val) <= max)) {
                    setDiscountAmount(val);
                  }
                }}
                min={1}
                max={discountUnit === '%' ? 100 : 999}
                className="text-[48px] font-extrabold text-[#222222] border-b-2 border-[var(--terra)] bg-transparent outline-none text-center"
                style={{ width: '120px' }}
                autoFocus
              />
            </div>

            <div className="flex justify-center gap-2 mb-6">
              <button
                onClick={() => {
                  setDiscountUnit('%');
                  if (parseInt(discountAmount) > 100) setDiscountAmount('100');
                }}
                className="px-5 py-2 rounded-[50px] text-[15px] font-bold transition-all"
                style={{
                  background: discountUnit === '%' ? '#222222' : 'var(--bg)',
                  color: discountUnit === '%' ? 'white' : 'var(--mid)',
                }}
              >
                %
              </button>
              <button
                onClick={() => setDiscountUnit('£')}
                className="px-5 py-2 rounded-[50px] text-[15px] font-bold transition-all"
                style={{
                  background: discountUnit === '£' ? '#222222' : 'var(--bg)',
                  color: discountUnit === '£' ? 'white' : 'var(--mid)',
                }}
              >
                £
              </button>
            </div>

            <p className="text-[13px] text-[var(--mid)] text-center">
              Creators will see: <span className="font-semibold">{discountUnit === '%' ? `${discountAmount || '0'}% off` : `£${discountAmount || '0'} off`}</span>
            </p>

            <button
              onClick={() => setScreen(3)}
              disabled={!discountAmount || parseInt(discountAmount) < 1}
              className={`w-full mt-8 py-[14px] rounded-[50px] font-bold text-[14px] transition-all min-h-[52px] ${
                discountAmount && parseInt(discountAmount) >= 1
                  ? 'bg-[var(--terra)] text-white hover:bg-[var(--terra-hover)]'
                  : 'bg-[var(--bg)] text-[var(--soft)]'
              }`}
            >
              Next
            </button>
          </div>
        )}

        {/* ── Screen 3: How many slots? ── */}
        {screen === 3 && (
          <div>
            <h2 className="text-[22px] font-extrabold text-[#222222] mt-4 mb-1" style={{ letterSpacing: '-0.4px' }}>How many creators?</h2>
            <p className="text-[14px] text-[var(--mid)] mb-10" style={{ lineHeight: '1.6' }}>Each slot is one creator visit</p>

            <div className="flex items-center justify-center gap-6 mb-4">
              <button
                onClick={() => setMonthlyCap(Math.max(1, monthlyCap - 1))}
                className="w-14 h-14 rounded-full border-[1.5px] border-[var(--faint)] flex items-center justify-center bg-white min-h-[44px]"
              >
                <Minus className="w-5 h-5 text-[#222222]" />
              </button>
              <span className="text-[64px] font-extrabold text-[#222222] min-w-[80px] text-center" style={{ lineHeight: 1 }}>
                {monthlyCap}
              </span>
              <button
                onClick={() => setMonthlyCap(Math.min(20, monthlyCap + 1))}
                className="w-14 h-14 rounded-full bg-[var(--terra)] flex items-center justify-center min-h-[44px]"
              >
                <Plus className="w-5 h-5 text-white" />
              </button>
            </div>
            <p className="text-[13px] text-[var(--soft)] text-center mb-8">We recommend starting with 4</p>

            <div className="bg-[var(--bg)] rounded-[12px] p-[14px] flex items-start gap-2.5 mb-8">
              <Info className="w-[14px] h-[14px] text-[var(--soft)] mt-0.5 flex-shrink-0" />
              <p className="text-[12px] text-[var(--soft)]">Each creator visits in person and posts within 48 hours</p>
            </div>

            <button
              onClick={() => setScreen(4)}
              className="w-full py-[14px] rounded-[50px] font-bold text-[14px] bg-[var(--terra)] text-white hover:bg-[var(--terra-hover)] transition-all min-h-[52px]"
            >
              Next
            </button>
          </div>
        )}

        {/* ── Screen 4: Any specific ask? ── */}
        {screen === 4 && (
          <div>
            <h2 className="text-[22px] font-extrabold text-[#222222] mt-4 mb-1" style={{ letterSpacing: '-0.4px' }}>Anything specific?</h2>
            <p className="text-[14px] text-[var(--mid)] mb-6" style={{ lineHeight: '1.6' }}>Optional — most businesses skip this</p>

            <textarea
              value={specificAsk}
              onChange={e => setSpecificAsk(e.target.value.slice(0, 100))}
              placeholder="e.g. Please show the latte art, or mention our new seasonal menu"
              className="w-full px-4 py-4 rounded-[14px] bg-[var(--bg)] border-[1.5px] border-transparent focus:border-[var(--terra)] text-[15px] text-[#222222] placeholder:text-[var(--soft)] outline-none resize-none"
              style={{ minHeight: '100px' }}
            />
            <p className="text-[11px] text-[var(--soft)] text-right mt-1 mb-4">{specificAsk.length}/100</p>

            <div className="flex flex-wrap gap-2 mb-8">
              {exampleChips.map((chip, i) => (
                <button
                  key={i}
                  onClick={() => setSpecificAsk(chip.slice(0, 100))}
                  className="px-3 py-1.5 rounded-[50px] bg-[var(--bg)] text-[var(--mid)] text-[12px] font-semibold hover:bg-[#ececec] transition-colors"
                >
                  {chip}
                </button>
              ))}
            </div>

            <button
              onClick={() => setScreen(5)}
              className="w-full py-[14px] rounded-[50px] font-bold text-[14px] bg-[var(--terra)] text-white hover:bg-[var(--terra-hover)] transition-all min-h-[52px]"
            >
              Next
            </button>
          </div>
        )}

        {/* ── Screen 5: Preview ── */}
        {screen === 5 && (
          <div>
            <h2 className="text-[22px] font-extrabold text-[#222222] mt-4 mb-1" style={{ letterSpacing: '-0.4px' }}>Your offer</h2>
            <p className="text-[14px] text-[var(--mid)] mb-6" style={{ lineHeight: '1.6' }}>This is exactly what creators will see</p>

            {/* Offer card preview */}
            <div className="rounded-[20px] overflow-hidden border border-[var(--faint)] shadow-[0_1px_4px_rgba(34,34,34,0.05)] mb-6">
              {/* Image area */}
              <div
                className="relative flex items-center justify-center"
                style={{ height: '120px', background: getCategoryGradient(category) }}
              >
                <span className="text-[28px] font-extrabold text-white/80">{getInitials('Offer')}</span>
                <span className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-[50px] text-[11px] font-bold text-[#222222]" style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(4px)' }}>
                  <Video className="w-[10px] h-[10px]" /> Reel
                </span>
              </div>
              {/* Body */}
              <div className="p-4">
                <p className="text-[15px] font-extrabold text-[#222222]">Your business</p>
                <p className="text-[14px] font-semibold text-[#222222] mt-0.5">{generatedTitle}</p>
                <div className="flex items-center gap-1 mt-1.5">
                  <Video className="w-[13px] h-[13px] text-[var(--terra)]" />
                  <span className="text-[13px] text-[var(--mid)]">Instagram Reel</span>
                </div>
                <p className="text-[13px] text-[var(--mid)] mt-1">{monthlyCap} slots available</p>
                {specificAsk.trim() && (
                  <div className="mt-3 p-3 rounded-[12px]" style={{ background: 'rgba(196,103,74,0.06)' }}>
                    <p className="text-[14px] text-[rgba(26,26,26,0.75)]" style={{ lineHeight: '1.6' }}>{specificAsk}</p>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setScreen(1)}
              className="text-[13px] font-semibold text-[var(--mid)] mb-6 flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Edit offer
            </button>

            <button
              onClick={async () => {
                await handleGoLive();
                setShowSuccess(true);
              }}
              disabled={isSubmitting}
              className="w-full py-[14px] rounded-[50px] font-bold text-[15px] bg-[var(--terra)] text-white hover:bg-[var(--terra-hover)] disabled:opacity-50 transition-all min-h-[52px]"
              style={{ boxShadow: '0 4px 16px rgba(196,103,74,0.3)' }}
            >
              {isSubmitting ? 'Publishing...' : 'Go live'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Time-aware greeting ──────────────────────────────────────────────────
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ─── Main Component ──────────────────────────────────────────────────────

export default function BusinessPortal() {
  const { userProfile, signOut } = useAuth();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [claims, setClaims] = useState<ClaimWithDetails[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [view, setView] = useState<'home' | 'offers' | 'claims' | 'content' | 'scan' | 'notifications'>(
    new URLSearchParams(window.location.search).get('redeem') ? 'scan' : 'home'
  );
  const [showOfferBuilder, setShowOfferBuilder] = useState(false);
  const [scanCode, setScanCode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('redeem') || '';
  });
  const [scanResult, setScanResult] = useState<{ type: 'success' | 'error'; message: string; creatorName?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [disputeClaimId, setDisputeClaimId] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [offersLoaded, setOffersLoaded] = useState(false);
  const [claimsFilter, setClaimsFilter] = useState<string>('all');

  // Clean redeem param from URL after reading it
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('redeem')) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (userProfile?.approved) {
      fetchOffers();
      fetchClaims();
      fetchNotifications();
    }
  }, [userProfile]);

  // Realtime subscriptions for claims and notifications
  useEffect(() => {
    if (!userProfile?.approved) return;

    const channel = supabase
      .channel('business-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'claims', filter: `business_id=eq.${userProfile.id}` },
        () => { fetchClaims(); }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userProfile.id}` },
        () => { fetchNotifications(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userProfile]);

  const fetchOffers = async () => {
    const { data, error } = await supabase.from('offers').select('*').eq('business_id', userProfile.id).order('created_at', { ascending: false });
    if (error) { setFetchError('Failed to load offers.'); return; }
    if (data) {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const offersWithSlots = await Promise.all(
        data.map(async (offer) => {
          const { count } = await supabase
            .from('claims')
            .select('*', { count: 'exact', head: true })
            .eq('offer_id', offer.id)
            .eq('month', currentMonth);
          return { ...offer, slotsUsed: count || 0 };
        })
      );
      setOffers(offersWithSlots as Offer[]);
    }
    setOffersLoaded(true);
  };

  const fetchClaims = async () => {
    const { data, error } = await supabase.from('claims').select('*, creators(name, instagram_handle, code), offers(description, generated_title)').eq('business_id', userProfile.id).order('claimed_at', { ascending: false });
    if (error) { setFetchError('Failed to load claims.'); return; }
    if (data) setClaims(data as ClaimWithDetails[]);
  };

  const fetchNotifications = async () => {
    const { data, error } = await supabase.from('notifications').select('*').eq('user_id', userProfile.id).order('created_at', { ascending: false }).limit(20);
    if (error) return;
    if (data) setNotifications(data);
  };

  const markNotificationRead = async (id: string) => {
    try {
      const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
      if (error) throw error;
      fetchNotifications();
    } catch (err: any) {
      console.error('Failed to mark notification read:', err.message);
    }
  };

  const handleCreateOffer = async (data: {
    offer_type: string;
    offer_item: string;
    monthly_cap: number;
    specific_ask: string | null;
    generated_title: string;
    content_type: string;
  }) => {
    try {
      const { error } = await supabase.from('offers').insert({
        business_id: userProfile.id,
        description: data.generated_title,
        monthly_cap: data.monthly_cap,
        is_live: true,
        offer_type: data.offer_type,
        offer_item: data.offer_item,
        content_type: data.content_type,
        specific_ask: data.specific_ask,
        generated_title: data.generated_title,
      });
      if (error) throw error;
      fetchOffers();
    } catch (error: any) {
      console.error('Failed to create offer:', error.message);
    }
  };

  const handleToggleOffer = async (offerId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase.from('offers').update({ is_live: !currentStatus }).eq('id', offerId);
      if (error) throw error;
      fetchOffers();
    } catch (err: any) {
      console.error('Failed to toggle offer:', err.message);
    }
  };

  const handleScanCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setScanResult(null);
    try {
      const { data: claim } = await supabase.from('claims').select('*, creators(name, code)').eq('qr_token', scanCode).eq('business_id', userProfile.id).maybeSingle();
      if (!claim) { setScanResult({ type: 'error', message: 'Code not recognised. Check and try again.' }); setScanCode(''); return; }
      if (claim.status !== 'active') {
        setScanResult({ type: 'error', message: claim.status === 'redeemed' ? 'This pass has already been used.' : `This pass is ${claim.status}. Cannot redeem.` });
        setScanCode('');
        return;
      }
      if (new Date(claim.qr_expires_at) < new Date()) { setScanResult({ type: 'error', message: 'QR code expired. Ask the creator to refresh it.' }); setScanCode(''); return; }
      const redeemedAt = new Date();
      const reelDueAt = new Date(redeemedAt.getTime() + 48 * 60 * 60 * 1000);
      const { error } = await supabase.from('claims').update({ status: 'redeemed', redeemed_at: redeemedAt.toISOString(), reel_due_at: reelDueAt.toISOString() }).eq('id', claim.id);
      if (error) throw error;
      setScanResult({ type: 'success', message: 'Visit confirmed', creatorName: claim.creators.name });
      setScanCode('');
      fetchClaims();
    } catch (error: any) {
      setScanResult({ type: 'error', message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  const activeClaimsCount = claims.filter(c => c.status === 'active').length;

  if (!userProfile?.approved) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-white">
        <div className="bg-white rounded-[20px] shadow-[0_1px_4px_rgba(34,34,34,0.05)] p-8 max-w-sm text-center border border-[var(--faint)]">
          <Clock className="w-12 h-12 text-[var(--soft)] mx-auto mb-4" />
          <h2 className="text-[18px] font-bold mb-1 text-[#222222]">Pending Approval</h2>
          <p className="text-[14px] text-[var(--mid)] mb-6">Your business account is under review.</p>
          <button onClick={signOut} className="inline-flex items-center gap-2 px-6 py-3 rounded-[50px] text-white font-bold text-[14px] bg-[var(--terra)] hover:bg-[var(--terra-hover)] transition-colors min-h-[48px]">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </div>
    );
  }

  const tabs = [
    { key: 'home' as const, label: 'Home', icon: LayoutDashboard },
    { key: 'offers' as const, label: 'Offers', icon: Package },
    { key: 'scan' as const, label: 'Scan', icon: Camera, badge: activeClaimsCount || undefined },
    { key: 'claims' as const, label: 'Claims', icon: Users },
    { key: 'content' as const, label: 'Content', icon: Film },
    { key: 'notifications' as const, label: 'Alerts', icon: Bell, badge: unreadCount || undefined },
  ];

  const claimStatusStyle = (status: string) => {
    switch (status) {
      case 'active': return 'bg-[var(--terra)] text-white';
      case 'redeemed': return 'bg-[rgba(26,60,52,0.08)] text-[var(--forest)]';
      case 'reel_due': return 'bg-[var(--peach)] text-[#222222]';
      case 'completed': return 'bg-[var(--bg)] text-[var(--soft)]';
      case 'disputed': return 'bg-[var(--terra-15)] text-[var(--terra)]';
      default: return 'bg-[var(--bg)] text-[var(--soft)]';
    }
  };

  const claimStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Active';
      case 'redeemed': return 'Visited';
      case 'reel_due': return 'Reel Due';
      case 'completed': return 'Completed';
      case 'disputed': return 'Disputed';
      default: return status;
    }
  };

  // Filter claims
  const filteredClaims = claimsFilter === 'all'
    ? claims
    : claims.filter(c => c.status === claimsFilter);

  // Stats
  const reelsThisMonth = claims.filter(c => {
    if (!c.reel_url) return false;
    const month = new Date().toISOString().slice(0, 7);
    return c.claimed_at.startsWith(month);
  }).length;

  const totalSlotsLeft = offers.reduce((sum, o) => {
    if (!o.is_live) return sum;
    if (o.monthly_cap === null) return sum + 99; // unlimited
    return sum + Math.max(0, (o.monthly_cap - (o.slotsUsed || 0)));
  }, 0);

  const recentActivity = claims
    .filter(c => c.reel_url)
    .slice(0, 5);

  const liveOffers = offers.filter(o => o.is_live);

  // Filter pill counts
  const filterCounts: Record<string, number> = {
    all: claims.length,
    active: claims.filter(c => c.status === 'active').length,
    redeemed: claims.filter(c => c.status === 'redeemed').length,
    reel_due: claims.filter(c => c.status === 'reel_due').length,
    completed: claims.filter(c => c.status === 'completed').length,
  };

  return (
    <div className="min-h-screen bg-white">
      <style>{livePulseStyle}</style>

      {disputeClaimId && (
        <DisputeModal
          claimId={disputeClaimId}
          reporterRole="business"
          onClose={() => setDisputeClaimId(null)}
        />
      )}

      {showOfferBuilder && (
        <OfferBuilder
          category={userProfile.category}
          instagramHandle={userProfile.instagram_handle}
          onComplete={async (data) => {
            await handleCreateOffer(data);
          }}
          onCancel={() => { setShowOfferBuilder(false); }}
        />
      )}

      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="bg-white border-b border-[var(--faint)]" style={{ padding: '20px 20px 14px' }}>
          <div className="flex items-center justify-between">
            <Logo />
            <div className="text-right">
              <p className="text-[13px] font-semibold text-[#222222]">{userProfile.name}</p>
              <span className="inline-block bg-[var(--bg)] text-[var(--mid)] text-[11px] font-bold rounded-[20px] px-[10px] py-[3px] mt-0.5">
                Business
              </span>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex bg-white border-b border-[var(--faint)] overflow-x-auto px-[20px]">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => { setView(tab.key); setScanResult(null); }}
              className={`flex items-center gap-[5px] px-[14px] py-[10px] pb-[12px] text-[11px] font-semibold whitespace-nowrap transition-all relative min-h-[44px] ${
                view === tab.key ? 'text-[var(--terra)]' : 'text-[var(--soft)]'
              }`}
            >
              <div className="relative">
                <tab.icon className="w-[18px] h-[18px]" />
                {tab.badge ? (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-[var(--terra)] text-white text-[9px] font-bold flex items-center justify-center">
                    {tab.badge}
                  </span>
                ) : null}
              </div>
              {tab.label}
              {view === tab.key && <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-[var(--terra)] rounded-[1px]" />}
            </button>
          ))}
        </div>

        <div className="p-[20px]">
          {fetchError && (
            <div className="mb-4 p-3 rounded-[12px] bg-rose-50 border border-rose-200 text-[14px] text-rose-700 font-medium">
              {fetchError}
            </div>
          )}

          {/* ═══ HOME ═══ */}
          {view === 'home' && (
            <div>
              {/* Greeting */}
              <h2 className="text-[20px] font-extrabold text-[#222222]" style={{ letterSpacing: '-0.4px' }}>
                {getGreeting()}, {userProfile.name}
              </h2>
              <p className="text-[13px] text-[var(--mid)] mb-6">
                {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>

              {/* Stats row */}
              <div className="flex gap-[10px] mb-7">
                <div className="flex-1 bg-white border border-[var(--faint)] rounded-[16px] p-4">
                  <p className="text-[24px] font-extrabold text-[var(--terra)]">{activeClaimsCount}</p>
                  <p className="text-[11px] font-semibold text-[var(--mid)]">Active</p>
                </div>
                <div className="flex-1 bg-white border border-[var(--faint)] rounded-[16px] p-4">
                  <p className="text-[24px] font-extrabold text-[#222222]">{reelsThisMonth}</p>
                  <p className="text-[11px] font-semibold text-[var(--mid)]">Reels</p>
                </div>
                <div className="flex-1 bg-white border border-[var(--faint)] rounded-[16px] p-4">
                  <p className="text-[24px] font-extrabold text-[#222222]">{totalSlotsLeft > 98 ? '∞' : totalSlotsLeft}</p>
                  <p className="text-[11px] font-semibold text-[var(--mid)]">Slots left</p>
                </div>
              </div>

              {/* Recent creator activity */}
              <div className="mb-7">
                <h3 className="text-[18px] font-extrabold text-[#222222] mb-[14px]">Recent creator activity</h3>
                {recentActivity.length === 0 ? (
                  <div className="flex flex-col items-center py-8 px-4">
                    <Sparkles className="w-10 h-10 text-[var(--soft)] mb-3" />
                    <p className="text-[14px] text-[var(--mid)] text-center">Your first creator visit will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-[10px]">
                    {recentActivity.map(claim => (
                      <div key={claim.id} className="bg-white border border-[var(--faint)] rounded-[16px] p-[16px] flex gap-3 items-start">
                        <div
                          className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-[13px] flex-shrink-0"
                          style={{ background: getCategoryGradient(userProfile.category) }}
                        >
                          {getInitials(claim.creators.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-bold text-[#222222]">{claim.creators.name}</p>
                          <p className="text-[13px] text-[var(--mid)] truncate">
                            posted a reel for {claim.offers?.generated_title || claim.offers?.description || 'your offer'}
                          </p>
                          <p className="text-[12px] text-[var(--soft)] mt-0.5">{timeAgo(claim.claimed_at)}</p>
                          {claim.reel_url && (
                            <a
                              href={claim.reel_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center mt-2 px-3 py-1 rounded-[50px] text-[12px] font-semibold text-[var(--terra)]"
                              style={{ background: 'rgba(196,103,74,0.08)' }}
                            >
                              View reel →
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Live offers strip */}
              {liveOffers.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-[14px]">
                    <h3 className="text-[18px] font-extrabold text-[#222222]">Live offers</h3>
                    <button onClick={() => setView('offers')} className="text-[12px] font-semibold text-[var(--terra)]">
                      Manage →
                    </button>
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
                    {liveOffers.map(offer => {
                      const isUnlimited = offer.monthly_cap === null;
                      const slotsUsed = offer.slotsUsed || 0;
                      const pct = isUnlimited ? 0 : Math.min((slotsUsed / (offer.monthly_cap as number)) * 100, 100);
                      return (
                        <div key={offer.id} className="bg-white border border-[var(--faint)] rounded-[14px] flex-shrink-0" style={{ padding: '12px 14px', minWidth: '160px' }}>
                          <p className="text-[13px] font-semibold text-[#222222] truncate">{offer.generated_title || offer.description}</p>
                          <p className="text-[11px] text-[var(--mid)] mt-1">
                            {isUnlimited ? `${slotsUsed} claimed` : `${slotsUsed}/${offer.monthly_cap} claimed`}
                          </p>
                          {!isUnlimited && (
                            <div className="h-[3px] bg-[var(--terra-10)] rounded-[3px] overflow-hidden mt-1.5">
                              <div className="h-full bg-[var(--terra)] rounded-[3px] transition-all" style={{ width: `${pct}%` }} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Sign out */}
              <button
                onClick={signOut}
                className="flex items-center gap-1.5 mt-4 text-[13px] font-medium text-[var(--soft)] hover:text-[var(--mid)] transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign out
              </button>
            </div>
          )}

          {/* ═══ OFFERS ═══ */}
          {view === 'offers' && (
            <div>
              <h2 className="text-[22px] font-extrabold text-[#222222] mb-1" style={{ letterSpacing: '-0.4px' }}>Offers</h2>
              <p className="text-[14px] text-[var(--mid)] mb-5">{offers.length} offer{offers.length !== 1 ? 's' : ''} · {offers.filter(o => o.is_live).length} live</p>

              {offersLoaded && offers.length === 0 && (
                <div className="flex flex-col items-center py-16 px-6">
                  <Sparkles className="w-12 h-12 text-[var(--soft)] mb-4" />
                  <p className="text-[16px] font-bold text-[#222222] mb-1">No offers yet</p>
                  <p className="text-[14px] text-[var(--mid)] text-center mb-5 max-w-[260px]">Create your first offer to start receiving creators</p>
                  <button
                    onClick={() => setShowOfferBuilder(true)}
                    className="inline-flex items-center gap-2 px-[24px] py-[13px] rounded-[50px] bg-[var(--terra)] text-white font-bold text-[14px] hover:bg-[var(--terra-hover)] transition-all min-h-[48px]"
                  >
                    <Plus className="w-4 h-4" /> Create First Offer
                  </button>
                </div>
              )}

              {offers.length > 0 && (
                <button
                  onClick={() => setShowOfferBuilder(true)}
                  className="inline-flex items-center gap-2 px-[24px] py-[13px] rounded-[50px] text-white font-bold bg-[var(--terra)] hover:bg-[var(--terra-hover)] transition-all text-[14px] mb-4 min-h-[48px]"
                >
                  <Plus className="w-4 h-4" /> New Offer
                </button>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                {offers.map((offer) => {
                  const isUnlimited = offer.monthly_cap === null;
                  const slotsUsed = offer.slotsUsed || 0;
                  const slotsLeft = isUnlimited ? null : Math.max(0, (offer.monthly_cap as number) - slotsUsed);
                  const pct = isUnlimited ? 0 : Math.min((slotsUsed / (offer.monthly_cap as number)) * 100, 100);

                  return (
                    <div key={offer.id} className="bg-white rounded-[20px] p-[18px] border border-[var(--faint)] shadow-[0_1px_4px_rgba(34,34,34,0.05)] flex gap-[14px] items-start">
                      {/* 52px thumbnail */}
                      <div
                        className="w-[52px] h-[52px] rounded-[10px] flex items-center justify-center flex-shrink-0"
                        style={{ background: getCategoryGradient(userProfile.category) }}
                      >
                        <span className="text-[20px] font-extrabold text-white/80">{getInitials(userProfile.name)}</span>
                      </div>

                      {/* Right content */}
                      <div className="flex-1 min-w-0">
                        {/* Top: title + status */}
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <p className="text-[15px] font-bold text-[#222222] flex-1 line-clamp-2">{offer.generated_title || offer.description}</p>
                          {offer.is_live ? (
                            <span className="flex-shrink-0 inline-flex items-center gap-[5px] px-[10px] py-1 rounded-[50px] text-[12px] font-bold bg-[rgba(26,60,52,0.08)] text-[var(--forest)]">
                              <span className="w-[7px] h-[7px] rounded-full bg-[var(--forest)]" style={{ animation: 'livePulse 2s infinite' }} />
                              Live
                            </span>
                          ) : (
                            <span className="flex-shrink-0 px-3 py-1 rounded-[50px] text-[12px] font-bold bg-[var(--bg)] text-[var(--soft)]">
                              Paused
                            </span>
                          )}
                        </div>

                        {/* Middle: claims + progress */}
                        <div className="mb-2">
                          <p className="text-[13px] text-[var(--mid)] mb-2">
                            {isUnlimited ? `${slotsUsed} claimed · Unlimited` : `${slotsUsed}/${offer.monthly_cap} claimed`}
                          </p>
                          {!isUnlimited && (
                            <div className="h-[3px] bg-[var(--terra-10)] rounded-[3px] overflow-hidden">
                              <div
                                className="h-full bg-[var(--terra)] rounded-[3px] transition-all duration-300"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          )}
                        </div>

                        {/* Bottom: slots badge + toggle */}
                        <div className="flex items-center justify-between">
                          {isUnlimited ? (
                            <span className="px-3 py-1 rounded-[50px] text-[12px] font-bold bg-[var(--peach)] text-[#222222]">Open</span>
                          ) : slotsLeft === 0 ? (
                            <span className="px-3 py-1 rounded-[50px] text-[12px] font-bold bg-[var(--bg)] text-[var(--soft)]">Full</span>
                          ) : (
                            <span className="px-3 py-1 rounded-[50px] text-[12px] font-bold bg-[var(--peach)] text-[#222222]">{slotsLeft} left</span>
                          )}
                          <button
                            onClick={() => handleToggleOffer(offer.id, offer.is_live)}
                            className={`px-[18px] py-[8px] rounded-[50px] font-semibold text-[13px] transition-all min-h-[36px] ${
                              offer.is_live
                                ? 'bg-[var(--bg)] text-[var(--mid)] border border-[var(--faint)]'
                                : 'bg-[var(--terra)] text-white'
                            }`}
                          >
                            {offer.is_live ? 'Pause' : 'Resume'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ═══ SCAN ═══ */}
          {view === 'scan' && (
            <div className="max-w-sm mx-auto">
              {scanResult ? (
                /* Scan result state */
                <div className="flex flex-col items-center py-8">
                  {scanResult.type === 'success' ? (
                    <>
                      <CheckCircle2 className="w-16 h-16 text-[var(--terra)] mb-4" />
                      {scanResult.creatorName && (
                        <p className="text-[20px] font-extrabold text-[#222222] mb-1">{scanResult.creatorName}</p>
                      )}
                      <p className="text-[16px] font-semibold text-[#222222] mb-1">{scanResult.message}</p>
                      <p className="text-[12px] text-[var(--soft)] mb-6">{new Date().toLocaleString()}</p>
                      <button
                        onClick={() => setScanResult(null)}
                        className="px-[28px] py-[13px] rounded-[50px] bg-[#222222] text-white font-bold text-[14px] hover:bg-[#333] transition-all min-h-[48px]"
                      >
                        Done
                      </button>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-12 h-12 text-[var(--terra)] mb-4" />
                      <p className="text-[16px] font-bold text-[#222222] mb-1 text-center">{scanResult.message}</p>
                      <button
                        onClick={() => setScanResult(null)}
                        className="mt-4 px-[28px] py-[13px] rounded-[50px] bg-[var(--terra)] text-white font-bold text-[14px] hover:bg-[var(--terra-hover)] transition-all min-h-[48px]"
                      >
                        Try again
                      </button>
                    </>
                  )}
                </div>
              ) : (
                /* Scanner UI */
                <>
                  <h2 className="text-[22px] font-extrabold text-[#222222] mb-2" style={{ letterSpacing: '-0.4px' }}>Scan creator pass</h2>
                  <p className="text-[14px] text-[var(--mid)] mb-7">Ask the creator to open their Active tab and show their QR code</p>

                  <QRScanner
                    onScan={(token) => { setScanCode(token); }}
                    active={view === 'scan' && !scanResult}
                  />

                  <div className="mt-6 mb-4 relative">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[var(--faint)]" /></div>
                    <div className="relative flex justify-center"><span className="bg-white px-3 text-[12px] text-[var(--soft)]">or enter code manually</span></div>
                  </div>

                  <form onSubmit={handleScanCode} className="space-y-3">
                    <input
                      type="text"
                      value={scanCode}
                      onChange={(e) => { setScanCode(e.target.value); setScanResult(null); }}
                      placeholder="e.g. SOPHIE101"
                      className="w-full px-4 py-[14px] rounded-[12px] bg-[var(--bg)] border border-[var(--faint)] text-[15px] text-[#222222] placeholder:text-[var(--soft)] focus:outline-none focus:ring-2 focus:ring-[var(--terra-ring)] focus:border-[var(--terra)] min-h-[52px]"
                      required
                    />
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-[13px] rounded-[50px] text-white font-bold bg-[var(--terra)] hover:bg-[var(--terra-hover)] disabled:opacity-50 transition-all text-[14px] min-h-[48px]"
                    >
                      {loading ? 'Verifying...' : 'Verify'}
                    </button>
                  </form>
                </>
              )}
            </div>
          )}

          {/* ═══ CLAIMS ═══ */}
          {view === 'claims' && (
            <div>
              <h2 className="text-[22px] font-extrabold text-[#222222] mb-1" style={{ letterSpacing: '-0.4px' }}>Claims</h2>
              <p className="text-[14px] text-[var(--mid)] mb-4">
                {claims.filter(c => c.status === 'active').length} active · {claims.length} total
              </p>

              {/* Filter pills */}
              <div className="flex gap-2 overflow-x-auto pb-4" style={{ scrollbarWidth: 'none' }}>
                {[
                  { key: 'all', label: 'All' },
                  { key: 'active', label: 'Active' },
                  { key: 'redeemed', label: 'Visited' },
                  { key: 'reel_due', label: 'Reel Due' },
                  { key: 'completed', label: 'Completed' },
                ].map(f => (
                  <button
                    key={f.key}
                    onClick={() => setClaimsFilter(f.key)}
                    className={`px-3 py-1.5 rounded-[50px] text-[12px] font-semibold whitespace-nowrap transition-colors min-h-[32px] ${
                      claimsFilter === f.key
                        ? 'bg-[#222222] text-white'
                        : 'bg-[var(--bg)] text-[var(--mid)]'
                    }`}
                  >
                    {f.label} ({filterCounts[f.key] || 0})
                  </button>
                ))}
              </div>

              {filteredClaims.length === 0 && claims.length === 0 ? (
                <div className="flex flex-col items-center py-16 px-6">
                  <ClipboardList className="w-12 h-12 text-[var(--soft)] mb-4" />
                  <p className="text-[16px] font-bold text-[#222222] mb-1">No claims yet</p>
                  <p className="text-[14px] text-[var(--mid)] text-center max-w-[260px]">Claims will appear here when creators claim your offers</p>
                </div>
              ) : filteredClaims.length === 0 ? (
                <div className="flex flex-col items-center py-12 px-6">
                  <p className="text-[14px] text-[var(--mid)]">No {claimsFilter.replace('_', ' ')} claims</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredClaims.map((claim) => (
                    <div key={claim.id} className="bg-white rounded-[20px] p-[18px] border border-[var(--faint)] shadow-[0_1px_4px_rgba(34,34,34,0.05)]">
                      <div className="flex items-center gap-3">
                        {/* Avatar */}
                        <div
                          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-[14px] flex-shrink-0"
                          style={{ background: getCategoryGradient(userProfile.category || 'Cafe & Coffee') }}
                        >
                          {getInitials(claim.creators.name)}
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[15px] font-bold text-[#222222]">{claim.creators.name}</p>
                          <p className="text-[13px] text-[var(--mid)] truncate">
                            {claim.offers?.generated_title || claim.offers?.description || claim.creators.instagram_handle}
                          </p>
                          <p className="text-[13px] text-[var(--soft)] mt-0.5">{new Date(claim.claimed_at).toLocaleDateString()}</p>
                        </div>
                        {/* Status + actions */}
                        <div className="flex flex-col items-end gap-2">
                          <span className={`px-3 py-1 rounded-[50px] text-[12px] font-bold ${claimStatusStyle(claim.status)}`}>
                            {claimStatusLabel(claim.status)}
                          </span>
                          <button
                            onClick={() => setDisputeClaimId(claim.id)}
                            className="flex items-center gap-1 text-[12px] text-[var(--soft)] hover:text-[var(--terra)] transition-colors"
                          >
                            <Flag className="w-3 h-3" /> Report
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══ CONTENT ═══ */}
          {view === 'content' && (
            <div>
              <h2 className="text-[22px] font-extrabold text-[#222222] mb-1" style={{ letterSpacing: '-0.4px' }}>Creator content</h2>
              <p className="text-[13px] text-[var(--mid)] mb-5">{claims.filter(c => c.reel_url).length} reel{claims.filter(c => c.reel_url).length !== 1 ? 's' : ''} posted about your business</p>

              {claims.filter(c => c.reel_url).length === 0 ? (
                <div className="flex flex-col items-center py-16 px-6">
                  <Film className="w-12 h-12 text-[var(--soft)] mb-4" />
                  <p className="text-[16px] font-bold text-[#222222] mb-1">No content yet</p>
                  <p className="text-[14px] text-[var(--mid)] text-center max-w-[260px]">Reels will appear here once creators post and submit their links</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {claims.filter(c => c.reel_url).map((claim) => (
                    <div key={claim.id} className="bg-white rounded-[20px] overflow-hidden border border-[var(--faint)] shadow-[0_1px_4px_rgba(34,34,34,0.05)]">
                      {/* Gradient strip */}
                      <div
                        className="h-[48px] flex items-center justify-between px-4"
                        style={{ background: getCategoryGradient(userProfile.category || 'Cafe & Coffee') }}
                      >
                        <span className="text-[12px] font-semibold text-white">{getInitials(userProfile.name)}</span>
                        <span className="text-[12px] font-semibold text-white">{claim.creators.name}</span>
                      </div>
                      {/* Body */}
                      <div className="p-4">
                        <p className="text-[14px] font-semibold text-[#222222]">
                          {claim.offers?.generated_title || claim.offers?.description || 'Offer'}
                        </p>
                        <p className="text-[12px] text-[var(--soft)] mt-1">{new Date(claim.claimed_at).toLocaleDateString()}</p>
                        <a
                          href={claim.reel_url!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 mt-3 text-[13px] font-semibold text-[var(--terra)] hover:underline"
                        >
                          <Video className="w-3.5 h-3.5" /> View on Instagram <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══ NOTIFICATIONS ═══ */}
          {view === 'notifications' && (
            <div className="max-w-lg mx-auto">
              <h2 className="text-[22px] font-extrabold text-[#222222] mb-5" style={{ letterSpacing: '-0.4px' }}>Alerts</h2>

              {notifications.length === 0 ? (
                <div className="flex flex-col items-center py-16 px-6">
                  <Bell className="w-12 h-12 text-[var(--soft)] mb-4" />
                  <p className="text-[16px] font-bold text-[#222222] mb-1">No notifications</p>
                  <p className="text-[14px] text-[var(--mid)] text-center max-w-[260px]">You'll be notified when creators claim your offers</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notifications.map((notif) => (
                    <button
                      key={notif.id}
                      onClick={() => !notif.read && markNotificationRead(notif.id)}
                      className={`w-full text-left bg-white rounded-[20px] p-4 shadow-[0_1px_4px_rgba(34,34,34,0.05)] transition-all ${
                        notif.read ? 'border border-[var(--faint)] opacity-50' : 'border border-[var(--terra-20)] bg-[var(--terra-5)]'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${notif.read ? 'bg-[var(--faint)]' : 'bg-[var(--terra)]'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] text-[#222222]">{notif.message}</p>
                          <p className="text-[13px] text-[var(--soft)] mt-1">{new Date(notif.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══ Floating Scan FAB ═══ */}
      {view !== 'scan' && (
        <button
          onClick={() => { setView('scan'); setScanResult(null); }}
          className="fixed z-50 flex items-center gap-2 px-5 py-[14px] rounded-[50px] bg-[var(--terra)] text-white font-bold text-[14px] hover:bg-[var(--terra-hover)] transition-all"
          style={{ bottom: '24px', right: '20px', boxShadow: '0 4px 20px rgba(196,103,74,0.35)' }}
        >
          <div className="relative">
            <ScanLine className="w-[18px] h-[18px]" />
            {activeClaimsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[var(--terra)] border-2 border-white" />
            )}
          </div>
          Scan
        </button>
      )}
    </div>
  );
}
