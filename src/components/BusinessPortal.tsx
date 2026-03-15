import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  LogOut, Plus, ExternalLink, Camera, Bell,
  Package, Users, Film, LayoutDashboard,
  CheckCircle2, XCircle, VideoOff, Flag,
  Sparkles, ClipboardList, Clock, ScanLine,
  Gift, Tag, Star, ChevronLeft, Minus, Info, Video,
  Check, Lightbulb, ArrowRight, X, User, Lock, ChevronRight, FileText,
  MoreHorizontal, QrCode, Eye
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { getCategoryGradient } from '../lib/categories';
import { getInitials } from '../lib/avatar';
import DisputeModal from './DisputeModal';
import { uploadAvatar } from '../lib/upload';
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
  offer_photo_url?: string | null;
}

interface ClaimWithDetails {
  id: string;
  status: string;
  claimed_at: string;
  redeemed_at: string | null;
  reel_url: string | null;
  reel_due_at: string | null;
  qr_token: string;
  creators: { name: string; instagram_handle: string; code: string; avatar_url?: string | null };
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
@keyframes tipFadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
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

// ─── Category-aware Screen 2 tip ──────────────────────────────────────────
function getScreen2Tip(category: string | undefined | null, offerType: string): { title: string; body: string } {
  const tips: Record<string, Record<string, { title: string; body: string }>> = {
    'Cafe & Coffee': {
      product:    { title: 'Specific offers get claimed faster', body: "Try \"flat white + almond croissant\" instead of \"free coffee\" \u2014 detail builds excitement." },
      service:    { title: 'Specific offers get claimed faster', body: "Try \"barista masterclass for two\" instead of \"coffee experience\" \u2014 specificity converts." },
      experience: { title: 'Specific offers get claimed faster', body: "Try \"seasonal tasting flight\" instead of \"coffee tasting\" \u2014 unique experiences stand out." },
      discount:   { title: 'Percentage discounts convert well', body: "Try 20\u201325% off \u2014 enough to feel meaningful without underselling your product." },
    },
    'Hair & Beauty': {
      product:    { title: 'Specific offers get claimed faster', body: "Try \"full-size serum of your choice\" instead of \"product\" \u2014 tangible value is more compelling." },
      service:    { title: 'Specific offers get claimed faster', body: "Try \"express facial + brow tidy\" instead of just \"facial\" \u2014 bundled services feel more generous." },
      experience: { title: 'Specific offers get claimed faster', body: "Try \"full pamper session with scalp massage\" \u2014 sensory language drives curiosity." },
      discount:   { title: 'Percentage discounts convert well', body: "Try 20% off \u2014 beauty clients respond well to a clear percentage over a fixed amount." },
    },
    'Health & Fitness': {
      product:    { title: 'Specific offers get claimed faster', body: "Try \"protein shake + energy bar\" instead of \"supplement\" \u2014 concrete products feel real." },
      service:    { title: 'Specific offers get claimed faster', body: "Try \"45-min PT session + programme review\" instead of \"training session\" \u2014 show the full value." },
      experience: { title: 'Specific offers get claimed faster', body: "Try \"HIIT class + post-workout smoothie\" \u2014 pairing experience with product increases appeal." },
      discount:   { title: 'Fixed amounts work well here', body: "Try \u00a310 or \u00a315 off a class pack \u2014 fitness clients respond well to fixed savings on recurring spend." },
    },
    'Retail': {
      product:    { title: 'Specific offers get claimed faster', body: "Try \"any item up to \u00a320\" instead of \"item of your choice\" \u2014 a value ceiling makes the offer feel fair." },
      service:    { title: 'Specific offers get claimed faster', body: "Try \"personal styling session \u2014 up to 1 hour\" \u2014 time-bounded services feel premium." },
      experience: { title: 'Specific offers get claimed faster', body: "Try \"private shopping event for two\" \u2014 exclusive framing drives interest." },
      discount:   { title: 'Percentage discounts convert well', body: "Try 15\u201320% off \u2014 retail discounts work best when they feel like insider access, not a sale." },
    },
    'Wellness & Spa': {
      product:    { title: 'Specific offers get claimed faster', body: "Try \"full-size essential oil of your choice\" \u2014 product specificity helps creators plan their content." },
      service:    { title: 'Specific offers get claimed faster', body: "Try \"60-min deep tissue massage\" instead of \"massage\" \u2014 duration signals premium value." },
      experience: { title: 'Specific offers get claimed faster', body: "Try \"wellness consultation + guided meditation session\" \u2014 multi-part experiences create richer content." },
      discount:   { title: 'Percentage discounts convert well', body: "Try 25% off \u2014 wellness clients appreciate meaningful discounts on higher-ticket treatments." },
    },
    'Arts & Entertainment': {
      product:    { title: 'Specific offers get claimed faster', body: "Try \"signed print or artwork up to \u00a330\" \u2014 a value ceiling reassures businesses while feeling generous." },
      service:    { title: 'Specific offers get claimed faster', body: "Try \"90-min private lesson\" instead of \"class\" \u2014 duration and privacy signal premium quality." },
      experience: { title: 'Specific offers get claimed faster', body: "Try \"VIP entry + one drink\" \u2014 event access plus a tangible extra creates compelling content." },
      discount:   { title: 'Fixed amounts work well here', body: "Try \u00a310 off entry or a class pack \u2014 clear savings on creative experiences feel straightforward." },
    },
    'Pets': {
      product:    { title: 'Specific offers get claimed faster', body: "Try \"premium treat pack + toy\" instead of \"pet product\" \u2014 bundles feel more generous." },
      service:    { title: 'Specific offers get claimed faster', body: "Try \"full groom + bandana\" instead of \"grooming\" \u2014 the finishing touch makes it memorable." },
      experience: { title: 'Specific offers get claimed faster', body: "Try \"puppy socialisation class + treat pack\" \u2014 pet owners love experiences for their pets." },
      discount:   { title: 'Percentage discounts convert well', body: "Try 20% off \u2014 pet owners are loyal customers and respond well to rewards for that loyalty." },
    },
    'Education': {
      product:    { title: 'Specific offers get claimed faster', body: "Try \"course workbook + resource pack\" instead of \"materials\" \u2014 named resources feel more tangible." },
      service:    { title: 'Specific offers get claimed faster', body: "Try \"1-hour 1:1 tutoring session\" instead of \"tutoring\" \u2014 time-bound and personal is more compelling." },
      experience: { title: 'Specific offers get claimed faster', body: "Try \"full-day workshop + certificate\" \u2014 outcome-oriented framing drives sign-ups." },
      discount:   { title: 'Percentage discounts convert well', body: "Try 25% off \u2014 education purchases are considered, so meaningful discounts matter more." },
    },
    'Food & Drink': {
      product:    { title: 'Specific offers get claimed faster', body: "Try \"starter + main course\" instead of \"meal\" \u2014 specificity builds anticipation." },
      service:    { title: 'Specific offers get claimed faster', body: "Try \"chef\u2019s table experience for two\" \u2014 exclusive framing creates compelling content." },
      experience: { title: 'Specific offers get claimed faster', body: "Try \"cocktail masterclass + tasting menu\" \u2014 multi-part experiences stand out." },
      discount:   { title: 'Percentage discounts convert well', body: "Try 20% off the bill \u2014 food and drink discounts feel generous when applied to the full experience." },
    },
  };
  return tips[category || '']?.[offerType] ?? {
    title: 'Specific offers get claimed faster',
    body: 'Add detail to your offer \u2014 the more specific you are, the more excited creators get about visiting.',
  };
}

// ─── Scarcity colour shift helper ─────────────────────────────────────────
function getSlotsBadgeStyle(slotsLeft: number, totalSlots: number) {
  if (slotsLeft === 0) {
    return { background: 'rgba(34,34,34,0.07)', color: 'rgba(34,34,34,0.4)', text: 'Full' };
  }
  if (slotsLeft === 1) {
    return { background: 'rgba(196,103,74,0.15)', color: '#C4674A', text: 'Last slot' };
  }
  if (slotsLeft <= 2) {
    return { background: 'rgba(196,103,74,0.15)', color: '#C4674A', text: `${slotsLeft} left` };
  }
  return { background: '#F5C4A0', color: '#222222', text: `${slotsLeft} left` };
}

// ─── Offer quality indicator ──────────────────────────────────────────────
function getOfferQuality(offerItem: string, specificAsk: string | null) {
  let score = 0;
  if (offerItem && offerItem.length > 15) score += 1;
  if (offerItem && offerItem.includes('+')) score += 1;
  if (offerItem && offerItem !== 'your choice') score += 1;
  if (specificAsk && specificAsk.length > 10) score += 2;
  if (score >= 4) return 'excellent';
  if (score >= 2) return 'great';
  return 'good';
}

function QRScanner({ onScan, active }: { onScan: (token: string) => void; active: boolean }) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const regionRef = useRef<HTMLDivElement>(null);

  const extractToken = (decodedText: string) => {
    try {
      const url = new URL(decodedText);
      const redeemParam = url.searchParams.get('redeem');
      if (redeemParam) return redeemParam;
    } catch {
      // Not a URL — use raw value
    }
    return decodedText;
  };

  const startScanner = async () => {
    setCameraError(null);
    // Ensure the DOM element is ready
    await new Promise(r => setTimeout(r, 100));
    if (!document.getElementById('qr-scanner-region')) {
      setCameraError('Scanner not ready. Try again.');
      return;
    }
    try {
      // Stop any existing scanner first
      if (scannerRef.current) {
        try { await scannerRef.current.stop(); } catch {}
        scannerRef.current = null;
      }
      const scanner = new Html5Qrcode('qr-scanner-region');
      scannerRef.current = scanner;

      // Request camera permission explicitly on iOS
      try {
        await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
          .then(stream => { stream.getTracks().forEach(t => t.stop()); });
      } catch {
        // Will be caught by scanner.start below
      }

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 200, height: 200 }, aspectRatio: 1 },
        (decodedText) => {
          onScan(extractToken(decodedText));
          scanner.stop().catch(() => {});
          setScanning(false);
        },
        () => {}
      );
      setScanning(true);
    } catch (err: any) {
      const msg = String(err?.message || err);
      if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
        setCameraError('Camera permission denied. Allow camera access in your browser settings, then try again.');
      } else if (msg.includes('NotFoundError') || msg.includes('DevicesNotFound')) {
        setCameraError('No camera found on this device.');
      } else if (msg.includes('NotReadableError') || msg.includes('TrackStartError')) {
        setCameraError('Camera is in use by another app. Close it and try again.');
      } else {
        setCameraError(`Could not start camera. ${msg.slice(0, 80)}`);
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

  return (
    <div>
      {cameraError && (
        <div className="p-4 rounded-[16px] bg-amber-50 border border-amber-100 text-center mb-4">
          <VideoOff className="w-5 h-5 text-amber-500 mx-auto mb-2" />
          <p className="text-[13px] text-amber-700 mb-3">{cameraError}</p>
          <button
            onClick={() => { setCameraError(null); startScanner(); }}
            className="text-[13px] font-semibold text-[var(--terra)] underline"
          >
            Try again
          </button>
        </div>
      )}
      <div className="relative mx-auto" style={{ maxWidth: '280px' }}>
        {/* Always render the div so html5-qrcode can find it */}
        <div
          ref={regionRef}
          id="qr-scanner-region"
          className="rounded-[16px] overflow-hidden"
          style={{
            height: scanning ? 'auto' : '0',
            opacity: scanning ? 1 : 0,
            background: '#222222',
            transition: 'opacity 0.2s',
          }}
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
      {!scanning && !cameraError && (
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
    content_type: string;
    offer_photo_url: string | null;
    min_level: number;
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
  const [showTip, setShowTip] = useState(false);
  const [tipDismissed, setTipDismissed] = useState(false);
  const tipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [offerPhotoUrl, setOfferPhotoUrl] = useState<string | null>(null);
  const [minLevel, setMinLevel] = useState(1);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [offerId] = useState(() => crypto.randomUUID());
  const photoInputRef = useRef<HTMLInputElement>(null);

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
      offer_photo_url: offerPhotoUrl,
      min_level: minLevel,
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
          <button onClick={() => { setOfferPhotoUrl(null); setScreen(5); }} className="text-[14px] font-semibold text-[var(--mid)] min-h-[44px] flex items-center">
            Skip
          </button>
        )}
        {screen === 5 && (
          <button onClick={() => { setSpecificAsk(''); setScreen(6); }} className="text-[14px] font-semibold text-[var(--mid)] min-h-[44px] flex items-center">
            Skip
          </button>
        )}
      </div>

      {/* Progress bar (screens 1-5) */}
      {screen <= 5 && (
        <div className="px-5 mb-1">
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map(s => (
              <div key={s} className="flex-1 h-[3px] rounded-[3px]" style={{ background: s <= screen ? 'var(--terra)' : 'var(--bg)' }} />
            ))}
          </div>
          <p className="text-[11px] text-[var(--soft)] text-right mt-1.5">Step {Math.min(screen, 5)} of 5</p>
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
                onChange={e => {
                  setOfferItem(e.target.value.slice(0, 60));
                  if (!tipDismissed && !showTip) {
                    if (tipTimerRef.current) clearTimeout(tipTimerRef.current);
                    tipTimerRef.current = setTimeout(() => setShowTip(true), 2000);
                  }
                }}
                placeholder={getCategoryPlaceholder(category, offerType)}
                className="flex-1 text-[22px] font-extrabold text-[#222222] border-b-2 border-[var(--terra)] bg-transparent outline-none placeholder:text-[var(--soft)] placeholder:font-extrabold"
                autoFocus
              />
            </div>
            <p className="text-[11px] text-[var(--soft)] text-right mb-4">{offerItem.length}/60</p>

            <p className="text-[13px] text-[var(--mid)]">
              Creators will see: <span className="font-semibold">Free {offerItem || getCategoryPlaceholder(category, offerType)}</span>
            </p>

            {/* Inline tip card */}
            {showTip && !tipDismissed && (
              <div
                className="relative mt-5 flex gap-[10px] items-start"
                style={{
                  background: 'rgba(196,103,74,0.05)',
                  border: '1px solid rgba(196,103,74,0.12)',
                  borderRadius: '14px',
                  padding: '12px 14px',
                  animation: 'tipFadeIn 300ms ease forwards',
                }}
              >
                <Lightbulb className="w-4 h-4 text-[var(--terra)] flex-shrink-0 mt-[1px]" />
                <div className="flex-1">
                  <p className="text-[13px] font-bold text-[#222222]">{getScreen2Tip(category, offerType).title}</p>
                  <p className="text-[12px] text-[var(--mid)] mt-[3px]" style={{ lineHeight: '1.6' }}>
                    {getScreen2Tip(category, offerType).body}
                  </p>
                </div>
                <button
                  onClick={() => { setTipDismissed(true); setShowTip(false); }}
                  className="flex-shrink-0 p-1"
                >
                  <X className="w-3 h-3 text-[var(--soft)]" />
                </button>
              </div>
            )}

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

            <div className="bg-[var(--bg)] rounded-[12px] p-[14px] flex items-start gap-2.5 mb-6">
              <Info className="w-[14px] h-[14px] text-[var(--soft)] mt-0.5 flex-shrink-0" />
              <p className="text-[12px] text-[var(--soft)]">Each creator visits in person and posts within 48 hours</p>
            </div>

            {/* Who can claim this? */}
            <div className="mb-8">
              <p className="text-[14px] font-bold text-[#222222] mb-3">Who can claim this?</p>
              <div className="flex gap-2 flex-wrap">
                {[
                  { label: 'Everyone', value: 1 },
                  { label: 'Level 3+', value: 3 },
                  { label: 'Level 5+', value: 5 },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setMinLevel(opt.value)}
                    className="px-[14px] py-[7px] rounded-[50px] text-[12px] font-semibold transition-all"
                    style={{
                      background: minLevel === opt.value ? '#222222' : 'var(--bg)',
                      color: minLevel === opt.value ? 'white' : 'var(--mid)',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-[12px] text-[var(--soft)] mt-2">Higher level creators have posted more reels and have better ratings</p>
            </div>

            <button
              onClick={() => setScreen(4)}
              className="w-full py-[14px] rounded-[50px] font-bold text-[14px] bg-[var(--terra)] text-white hover:bg-[var(--terra-hover)] transition-all min-h-[52px]"
            >
              Next
            </button>
          </div>
        )}

        {/* ── Screen 4: Add a photo (optional) ── */}
        {screen === 4 && (
          <div>
            <h2 className="text-[22px] font-extrabold text-[#222222] mt-4 mb-1" style={{ letterSpacing: '-0.4px' }}>Add a photo</h2>
            <p className="text-[14px] text-[var(--mid)] mb-8" style={{ lineHeight: '1.6' }}>Optional — helps your offer stand out</p>

            <div className="flex flex-col items-center mb-6">
              <div className="relative">
                {offerPhotoUrl ? (
                  <div className="relative">
                    <img
                      src={offerPhotoUrl}
                      alt="Offer photo"
                      className="w-[160px] h-[120px] object-cover rounded-[16px]"
                    />
                    <button
                      onClick={() => setOfferPhotoUrl(null)}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(0,0,0,0.4)' }}
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => photoInputRef.current?.click()}
                    className="w-[160px] h-[120px] rounded-[16px] flex flex-col items-center justify-center gap-2"
                    style={{
                      background: getCategoryGradient(category),
                      border: '1.5px dashed rgba(34,34,34,0.15)',
                    }}
                  >
                    {photoUploading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span className="text-[24px] font-extrabold text-[rgba(255,255,255,0.8)]">{getInitials('Offer')}</span>
                        <Camera className="w-5 h-5 text-[var(--soft)]" />
                        <span className="text-[12px] text-[var(--soft)]">Tap to add photo</span>
                      </>
                    )}
                  </button>
                )}
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 5 * 1024 * 1024) {
                      setPhotoError('File must be under 5MB.');
                      return;
                    }
                    setPhotoUploading(true);
                    setPhotoError(null);
                    try {
                      const ext = file.name.split('.').pop() || 'jpg';
                      const path = `offers/${offerId}/photo.${ext}`;
                      const { error: uploadError } = await supabase.storage
                        .from('avatars')
                        .upload(path, file, { upsert: true, contentType: file.type });
                      if (uploadError) throw uploadError;
                      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
                      setOfferPhotoUrl(`${data.publicUrl}?t=${Date.now()}`);
                    } catch {
                      setPhotoError('Upload failed — try again');
                    }
                    setPhotoUploading(false);
                    e.target.value = '';
                  }}
                />
              </div>
              {photoError && <p className="text-[12px] text-[var(--terra)] mt-2">{photoError}</p>}
            </div>

            <div className="flex justify-center gap-2 mb-8">
              {['Use natural light', 'Show your product', 'Keep it simple'].map(tip => (
                <span key={tip} className="px-3 py-[5px] rounded-[50px] bg-[var(--bg)] text-[var(--mid)] text-[12px] font-medium">
                  {tip}
                </span>
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

        {/* ── Screen 5: Any specific ask? ── */}
        {screen === 5 && (
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
              onClick={() => setScreen(6)}
              className="w-full py-[14px] rounded-[50px] font-bold text-[14px] bg-[var(--terra)] text-white hover:bg-[var(--terra-hover)] transition-all min-h-[52px]"
            >
              Next
            </button>
          </div>
        )}

        {/* ── Screen 6: Preview ── */}
        {screen === 6 && (
          <div>
            <h2 className="text-[22px] font-extrabold text-[#222222] mt-4 mb-1" style={{ letterSpacing: '-0.4px' }}>Your offer</h2>
            <p className="text-[14px] text-[var(--mid)] mb-6" style={{ lineHeight: '1.6' }}>This is exactly what creators will see</p>

            {/* Offer card preview */}
            <div className="rounded-[20px] overflow-hidden border border-[var(--faint)] shadow-[0_1px_4px_rgba(34,34,34,0.05)] mb-6">
              {/* Image area */}
              <div
                className="relative flex items-center justify-center overflow-hidden"
                style={{ height: '120px', background: offerPhotoUrl ? undefined : getCategoryGradient(category) }}
              >
                {offerPhotoUrl ? (
                  <img src={offerPhotoUrl} alt="Offer" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[28px] font-extrabold text-white/80">{getInitials('Offer')}</span>
                )}
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

            {/* Offer quality indicator */}
            {(() => {
              const quality = getOfferQuality(offerItem, specificAsk.trim() || null);
              const dots = quality === 'excellent' ? 3 : quality === 'great' ? 2 : 1;
              return (
                <div className="mb-4">
                  <div className="flex items-center justify-between rounded-[12px] px-4 py-3" style={{ background: 'var(--bg)' }}>
                    <span className="text-[12px] font-semibold text-[var(--mid)]">Offer quality</span>
                    <div className="flex gap-[5px]">
                      {[1, 2, 3].map(i => (
                        <span
                          key={i}
                          className="w-2 h-2 rounded-full"
                          style={{ background: i <= dots ? '#C4674A' : 'rgba(34,34,34,0.12)' }}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-[12px] mt-1.5" style={{ color: quality === 'excellent' ? 'var(--forest)' : 'var(--mid)' }}>
                    {quality === 'good' && 'Good start. Adding a specific ask can double your reel quality.'}
                    {quality === 'great' && 'Great offer. Creators will find this clear and compelling.'}
                    {quality === 'excellent' && 'Excellent. This offer is specific, clear and ready to perform.'}
                  </p>
                  {quality === 'good' && (
                    <button
                      onClick={() => setScreen(5)}
                      className="flex items-center gap-1 mt-1 text-[12px] font-semibold text-[var(--terra)]"
                    >
                      Add a specific ask <ArrowRight className="w-[11px] h-[11px]" />
                    </button>
                  )}
                </div>
              );
            })()}

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
  const [view, setView] = useState<'home' | 'offers' | 'claims' | 'scan' | 'notifications' | 'profile'>(
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
  const [claimsSubView, setClaimsSubView] = useState<'claims' | 'content'>('claims');
  const [profileName, setProfileName] = useState(userProfile?.name || '');
  const [profileAddress, setProfileAddress] = useState(userProfile?.address || '');
  const [profileInstagram, setProfileInstagram] = useState(userProfile?.instagram_handle || '');
  const [profileBio, setProfileBio] = useState(userProfile?.bio || '');
  const [profileDirty, setProfileDirty] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(userProfile?.logo_url || null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

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
    const { data, error } = await supabase.from('claims').select('*, creators(name, instagram_handle, code, avatar_url), offers(description, generated_title)').eq('business_id', userProfile.id).order('claimed_at', { ascending: false });
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
    offer_photo_url: string | null;
    min_level: number;
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
        offer_photo_url: data.offer_photo_url,
        min_level: data.min_level,
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

  const bottomTabs: { key: 'home' | 'offers' | 'scan' | 'claims' | 'profile'; label: string; icon: any }[] = [
    { key: 'home', label: 'Home', icon: LayoutDashboard },
    { key: 'offers', label: 'Offers', icon: Tag },
    { key: 'scan', label: 'Scan', icon: ScanLine },
    { key: 'claims', label: 'Claims', icon: FileText },
    { key: 'profile', label: 'Profile', icon: User },
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

      <div className="max-w-5xl mx-auto pb-[80px]">
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

        <div className="p-[20px]">
          {fetchError && (
            <div className="mb-4 p-3 rounded-[12px] bg-rose-50 border border-rose-200 text-[14px] text-rose-700 font-medium">
              {fetchError}
            </div>
          )}

          {/* ═══ HOME ═══ */}
          {view === 'home' && (
            <div>
              {/* Greeting + compact stats banner */}
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h2 className="text-[20px] font-extrabold text-[#222222]" style={{ letterSpacing: '-0.4px' }}>
                    {getGreeting()}, {userProfile.name}
                  </h2>
                  <p className="text-[13px] text-[var(--mid)]">
                    {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                </div>
              </div>

              {/* Compact inline stats */}
              <div className="flex items-center gap-[6px] mb-7 flex-wrap">
                <span className="inline-flex items-center gap-[5px] px-[10px] py-[5px] rounded-full bg-[rgba(196,103,74,0.08)]">
                  <span className="text-[13px] font-extrabold text-[var(--terra)]">{activeClaimsCount}</span>
                  <span className="text-[12px] font-semibold text-[var(--mid)]">active</span>
                </span>
                <span className="inline-flex items-center gap-[5px] px-[10px] py-[5px] rounded-full bg-[rgba(34,34,34,0.04)]">
                  <span className="text-[13px] font-extrabold text-[#222222]">{reelsThisMonth}</span>
                  <span className="text-[12px] font-semibold text-[var(--mid)]">reels</span>
                </span>
                <span className="inline-flex items-center gap-[5px] px-[10px] py-[5px] rounded-full bg-[rgba(34,34,34,0.04)]">
                  <span className="text-[13px] font-extrabold text-[#222222]">{totalSlotsLeft > 98 ? '∞' : totalSlotsLeft}</span>
                  <span className="text-[12px] font-semibold text-[var(--mid)]">slots left</span>
                </span>
              </div>

              {/* Your live offers — horizontal visual cards */}
              <div className="mb-7">
                <div className="flex items-center justify-between mb-[14px]">
                  <h3 className="text-[18px] font-extrabold text-[#222222]">Your live offers</h3>
                  {liveOffers.length > 0 && (
                    <button onClick={() => setView('offers')} className="w-[28px] h-[28px] flex items-center justify-center rounded-full border border-[var(--faint)]">
                      <ChevronRight className="w-[14px] h-[14px] text-[var(--mid)]" />
                    </button>
                  )}
                </div>

                {liveOffers.length === 0 ? (
                  <div className="flex flex-col items-center py-10 px-4">
                    <Tag className="w-10 h-10 text-[var(--soft)] mb-3" />
                    <p className="text-[15px] font-semibold text-[#222222]">No live offers yet</p>
                    <p className="text-[13px] text-[var(--mid)] text-center mt-1 max-w-[260px]">Create your first offer to start getting creator visits</p>
                    <button
                      onClick={() => { setView('offers'); setShowOfferBuilder(true); }}
                      className="mt-[14px] px-5 py-[10px] rounded-[50px] bg-[var(--terra)] text-white text-[13px] font-bold hover:bg-[var(--terra-hover)] transition-all"
                    >
                      Create offer →
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-[12px] overflow-x-auto pb-2 -mx-5 px-5" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
                    {liveOffers.map(offer => {
                      const isUnlimited = offer.monthly_cap === null;
                      const slotsUsed = offer.slotsUsed || 0;
                      const slotsLeft = isUnlimited ? null : Math.max(0, (offer.monthly_cap as number) - slotsUsed);
                      return (
                        <button
                          key={offer.id}
                          onClick={() => setView('offers')}
                          className="w-[152px] flex-shrink-0 text-left"
                        >
                          {/* Image card */}
                          <div className="relative w-[152px] h-[190px] rounded-[14px] overflow-hidden">
                            {offer.offer_photo_url ? (
                              <img src={offer.offer_photo_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full" style={{ background: getCategoryGradient(userProfile.category) }} />
                            )}
                            {/* Live badge top-right */}
                            <span className="absolute top-[8px] right-[8px] inline-flex items-center gap-[4px] px-[8px] py-[3px] rounded-[50px] text-[10px] font-bold bg-white/90 text-[var(--forest)]">
                              <span className="w-[5px] h-[5px] rounded-full bg-[var(--forest)]" style={{ animation: 'livePulse 2s infinite' }} />
                              Live
                            </span>
                            {/* Business logo top-left */}
                            {userProfile.logo_url && (
                              <div className="absolute top-[8px] left-[8px] w-[28px] h-[28px] rounded-[7px] overflow-hidden" style={{ border: '1.5px solid white' }}>
                                <img src={userProfile.logo_url} alt="" className="w-full h-full object-cover" />
                              </div>
                            )}
                            {/* Slots badge bottom-left */}
                            {!isUnlimited && slotsLeft !== null && (() => {
                              const badge = getSlotsBadgeStyle(slotsLeft, offer.monthly_cap as number);
                              return (
                                <span
                                  className="absolute bottom-[8px] left-[8px] backdrop-blur text-[11px] font-bold rounded-full px-[8px] py-[3px]"
                                  style={{ background: 'rgba(255,255,255,0.92)', color: badge.color }}
                                >
                                  {badge.text}
                                </span>
                              );
                            })()}
                          </div>
                          {/* Below image info */}
                          <div className="mt-[6px]">
                            <p className="text-[13px] font-extrabold text-[#222222] tracking-[-0.1px] leading-[1.2]" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              {offer.generated_title || offer.description}
                            </p>
                            <p className="text-[11px] text-[var(--mid)] mt-[3px]">
                              {isUnlimited ? `${slotsUsed} claimed` : `${slotsUsed}/${offer.monthly_cap} claimed`}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                    {/* Add offer card */}
                    <button
                      onClick={() => { setView('offers'); setShowOfferBuilder(true); }}
                      className="w-[152px] flex-shrink-0 text-left"
                    >
                      <div className="w-[152px] h-[190px] rounded-[14px] border-2 border-dashed border-[var(--faint)] flex flex-col items-center justify-center gap-2">
                        <div className="w-[36px] h-[36px] rounded-full bg-[rgba(196,103,74,0.08)] flex items-center justify-center">
                          <Plus className="w-[16px] h-[16px] text-[var(--terra)]" />
                        </div>
                        <span className="text-[12px] font-semibold text-[var(--mid)]">New offer</span>
                      </div>
                      {/* Invisible spacer to match text height below offer cards */}
                      <div className="mt-[6px]">
                        <p className="text-[13px] leading-[1.2] invisible">‎</p>
                        <p className="text-[11px] mt-[3px] invisible">‎</p>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* Recent creator activity — visual feed */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-[14px]">
                  <h3 className="text-[18px] font-extrabold text-[#222222]">Creator activity</h3>
                  {recentActivity.length > 0 && (
                    <button onClick={() => setView('claims')} className="w-[28px] h-[28px] flex items-center justify-center rounded-full border border-[var(--faint)]">
                      <ChevronRight className="w-[14px] h-[14px] text-[var(--mid)]" />
                    </button>
                  )}
                </div>
                {recentActivity.length === 0 ? (
                  <div className="flex flex-col items-center py-8 px-4">
                    <Sparkles className="w-10 h-10 text-[var(--soft)] mb-3" />
                    <p className="text-[14px] text-[var(--mid)] text-center">Your first creator visit will appear here</p>
                  </div>
                ) : (
                  <div className="flex gap-[12px] overflow-x-auto pb-2 -mx-5 px-5" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
                    {recentActivity.map(claim => (
                      <div
                        key={claim.id}
                        className="w-[200px] flex-shrink-0 bg-white rounded-[16px] border border-[var(--faint)] overflow-hidden"
                      >
                        {/* Creator header */}
                        <div className="p-[14px] pb-[10px]">
                          <div className="flex items-center gap-[10px]">
                            {claim.creators.avatar_url ? (
                              <img
                                src={claim.creators.avatar_url}
                                alt={claim.creators.name}
                                className="w-[36px] h-[36px] rounded-full object-cover flex-shrink-0"
                              />
                            ) : (
                              <div
                                className="w-[36px] h-[36px] rounded-full flex items-center justify-center text-white font-bold text-[11px] flex-shrink-0"
                                style={{ background: getCategoryGradient(userProfile.category) }}
                              >
                                {getInitials(claim.creators.name)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-[13px] font-bold text-[#222222] truncate">{claim.creators.name}</p>
                              <p className="text-[11px] text-[var(--soft)]">{claim.creators.instagram_handle}</p>
                            </div>
                          </div>
                        </div>
                        {/* Activity content */}
                        <div className="px-[14px] pb-[14px]">
                          <p className="text-[12px] text-[var(--mid)] leading-[1.4]">
                            Posted a reel for <span className="font-semibold text-[#222222]">{claim.offers?.generated_title || claim.offers?.description?.slice(0, 30) || 'your offer'}</span>
                          </p>
                          <div className="flex items-center justify-between mt-[10px]">
                            <span className="text-[11px] text-[var(--soft)]">{timeAgo(claim.claimed_at)}</span>
                            {claim.reel_url && (
                              <a
                                href={claim.reel_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--terra)]"
                              >
                                <Video className="w-[11px] h-[11px]" />
                                View reel
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
                        className="w-[52px] h-[52px] rounded-[10px] flex items-center justify-center flex-shrink-0 overflow-hidden"
                        style={{ background: offer.offer_photo_url ? undefined : getCategoryGradient(userProfile.category) }}
                      >
                        {offer.offer_photo_url ? (
                          <img src={offer.offer_photo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[20px] font-extrabold text-white/80">{getInitials(userProfile.name)}</span>
                        )}
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
                          ) : (() => {
                            const badge = getSlotsBadgeStyle(slotsLeft as number, offer.monthly_cap as number);
                            return <span className="px-3 py-1 rounded-[50px] text-[12px] font-bold" style={{ background: badge.background, color: badge.color }}>{badge.text}</span>;
                          })()}
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
                  {/* Visual header */}
                  <div className="flex flex-col items-center mb-8">
                    <div className="w-[72px] h-[72px] rounded-full flex items-center justify-center mb-4" style={{ background: 'var(--bg)' }}>
                      <QrCode className="w-8 h-8 text-[var(--terra)]" />
                    </div>
                    <h2 className="text-[22px] font-extrabold text-[#222222] mb-1" style={{ letterSpacing: '-0.4px' }}>Scan creator pass</h2>
                    <p className="text-[14px] text-[var(--mid)] text-center">Ask the creator to open their Active tab<br />and show their QR code</p>
                  </div>

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
                      className="w-full py-[13px] rounded-[50px] font-bold text-[14px] transition-all min-h-[48px] border-2 border-[#222222] bg-[#222222] text-white hover:bg-[#333] disabled:opacity-50"
                    >
                      {loading ? 'Verifying...' : 'Verify'}
                    </button>
                  </form>
                </>
              )}
            </div>
          )}

          {/* ═══ CLAIMS (with Content toggle) ═══ */}
          {view === 'claims' && (
            <div>
              <h2 className="text-[22px] font-extrabold text-[#222222] mb-1" style={{ letterSpacing: '-0.4px' }}>Claims</h2>
              <p className="text-[14px] text-[var(--mid)] mb-5">
                {claims.filter(c => c.status === 'active').length} active · {claims.length} total
              </p>

              {/* Stat row filters */}
              <div className="grid grid-cols-4 gap-2 mb-5">
                {[
                  { key: 'active', label: 'Active', icon: Clock },
                  { key: 'redeemed', label: 'Visited', icon: Eye },
                  { key: 'reel_due', label: 'Reel Due', icon: Video },
                  { key: 'completed', label: 'Done', icon: Check },
                ].map(f => {
                  const count = filterCounts[f.key] || 0;
                  const isSelected = claimsFilter === f.key;
                  const Icon = f.icon;
                  return (
                    <button
                      key={f.key}
                      onClick={() => setClaimsFilter(isSelected ? 'all' : f.key)}
                      className="flex flex-col items-center py-3 rounded-[14px] transition-all"
                      style={{
                        background: isSelected ? '#222222' : 'var(--bg)',
                      }}
                    >
                      <Icon className="w-4 h-4 mb-1" style={{ color: isSelected ? 'white' : 'var(--mid)' }} />
                      <span className="text-[18px] font-extrabold" style={{ color: isSelected ? 'white' : '#222222' }}>{count}</span>
                      <span className="text-[10px] font-semibold mt-0.5" style={{ color: isSelected ? 'rgba(255,255,255,0.7)' : 'var(--mid)' }}>{f.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Claims / Content pill toggle */}
              <div className="inline-flex rounded-[50px] p-[3px] mb-4" style={{ background: 'var(--bg)' }}>
                {(['claims', 'content'] as const).map(sub => (
                  <button
                    key={sub}
                    onClick={() => setClaimsSubView(sub)}
                    className="px-[18px] py-[7px] rounded-[50px] text-[13px] transition-all"
                    style={{
                      fontWeight: claimsSubView === sub ? 700 : 500,
                      background: claimsSubView === sub ? 'white' : 'transparent',
                      color: claimsSubView === sub ? '#222222' : 'var(--mid)',
                      boxShadow: claimsSubView === sub ? '0 1px 4px rgba(34,34,34,0.08)' : 'none',
                    }}
                  >
                    {sub === 'claims' ? 'Claims' : 'Content'}
                  </button>
                ))}
              </div>

              {/* Claims sub-view */}
              {claimsSubView === 'claims' && (
                <>
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
                      {filteredClaims.map((claim) => {
                        const statusColor = claim.status === 'active' ? 'var(--terra)' : claim.status === 'redeemed' ? 'var(--forest)' : claim.status === 'reel_due' ? '#c78c20' : claim.status === 'completed' ? 'var(--soft)' : 'var(--terra)';
                        const handle = claim.creators.instagram_handle || claim.creators.code;
                        const displayHandle = handle.startsWith('@') ? handle : `@${handle}`;
                        return (
                        <div key={claim.id} className="bg-white rounded-[16px] overflow-hidden border border-[var(--faint)] shadow-[0_1px_4px_rgba(34,34,34,0.05)] flex">
                          {/* Left status edge bar */}
                          <div className="w-[4px] flex-shrink-0 rounded-l-[16px]" style={{ background: statusColor }} />
                          <div className="flex-1 p-4">
                            <div className="flex items-center gap-3">
                              {claim.creators.avatar_url ? (
                                <img
                                  src={claim.creators.avatar_url}
                                  alt={claim.creators.name}
                                  className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                                />
                              ) : (
                                <div
                                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-[13px] flex-shrink-0"
                                  style={{ background: getCategoryGradient(userProfile.category || 'Cafe & Coffee') }}
                                >
                                  {getInitials(claim.creators.name)}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-[15px] font-bold text-[#222222]">{claim.creators.name}</p>
                                  <div className="flex items-center gap-1.5 flex-shrink-0">
                                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-[50px] ${claimStatusStyle(claim.status)}`}>
                                      {claimStatusLabel(claim.status)}
                                    </span>
                                    <button
                                      onClick={() => setDisputeClaimId(claim.id)}
                                      className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-[var(--bg)] transition-colors"
                                      title="Report"
                                    >
                                      <MoreHorizontal className="w-4 h-4 text-[var(--soft)]" />
                                    </button>
                                  </div>
                                </div>
                                <p className="text-[13px] text-[var(--mid)]">{displayHandle}</p>
                              </div>
                            </div>
                            {/* Offer description */}
                            <p className="text-[13px] text-[var(--mid)] mt-2 leading-[1.4]">
                              {claim.offers?.generated_title || claim.offers?.description}
                            </p>
                            {/* Date + reel status */}
                            <div className="flex items-center gap-3 mt-2.5 pt-2.5 border-t border-[var(--faint)]">
                              <span className="text-[11px] text-[var(--soft)]">{new Date(claim.claimed_at).toLocaleDateString()}</span>
                              {claim.reel_url ? (
                                <a href={claim.reel_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] font-semibold text-[var(--forest)]">
                                  <Video className="w-3 h-3" /> Reel posted <ExternalLink className="w-3 h-3" />
                                </a>
                              ) : claim.status === 'reel_due' && claim.reel_due_at ? (
                                <span className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: '#c78c20' }}>
                                  <Clock className="w-3 h-3" /> Due {(() => {
                                    const hours = Math.max(0, Math.round((new Date(claim.reel_due_at).getTime() - Date.now()) / 3600000));
                                    return hours > 24 ? `in ${Math.round(hours / 24)}d` : `in ${hours}h`;
                                  })()}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {/* Content sub-view */}
              {claimsSubView === 'content' && (
                <>
                  <p className="text-[13px] text-[var(--mid)] mb-4">{claims.filter(c => c.reel_url).length} reel{claims.filter(c => c.reel_url).length !== 1 ? 's' : ''} posted about your business</p>

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
                          <div
                            className="h-[48px] flex items-center justify-between px-4"
                            style={{ background: getCategoryGradient(userProfile.category || 'Cafe & Coffee') }}
                          >
                            <span className="text-[12px] font-semibold text-white">{getInitials(userProfile.name)}</span>
                            <div className="flex items-center gap-2">
                              {claim.creators.avatar_url ? (
                                <img src={claim.creators.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover border border-white/30" />
                              ) : null}
                              <span className="text-[12px] font-semibold text-white">{claim.creators.name}</span>
                            </div>
                          </div>
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
                </>
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

          {/* ═══ PROFILE ═══ */}
          {view === 'profile' && (
            <div className="max-w-lg mx-auto">
              <h2 className="text-[22px] font-extrabold text-[#222222] mb-1" style={{ letterSpacing: '-0.4px' }}>Your profile</h2>
              <p className="text-[13px] text-[var(--mid)] mb-7">How you appear to creators</p>

              {/* Section label */}
              <p className="text-[10px] font-bold text-[var(--soft)] uppercase mb-3" style={{ letterSpacing: '0.8px' }}>BUSINESS</p>

              {/* Logo upload */}
              <div className="flex flex-col items-center mb-5">
                <div className="relative">
                  <div
                    className="w-[80px] h-[80px] rounded-[16px] overflow-hidden flex items-center justify-center"
                    style={{ background: logoUrl ? undefined : getCategoryGradient(userProfile.category) }}
                  >
                    {logoUrl ? (
                      <img src={logoUrl} alt={userProfile.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[28px] font-extrabold text-[rgba(255,255,255,0.8)]">{getInitials(userProfile.name)}</span>
                    )}
                    {logoUploading && (
                      <div className="absolute inset-0 bg-white/60 flex items-center justify-center rounded-[16px]">
                        <div className="w-5 h-5 border-2 border-[var(--terra)] border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[var(--terra)] flex items-center justify-center"
                  >
                    <Camera className="w-3 h-3 text-white" />
                  </button>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setLogoUploading(true);
                      setLogoError(null);
                      const { url, error } = await uploadAvatar(file, userProfile.id, 'businesses');
                      if (error) {
                        setLogoError(error);
                      } else if (url) {
                        setLogoUrl(url);
                      }
                      setLogoUploading(false);
                      e.target.value = '';
                    }}
                  />
                </div>
                <p className="text-[16px] font-bold text-[#222222] mt-3">{userProfile.name}</p>
                <p className="text-[13px] text-[var(--mid)]">{userProfile.category}</p>
                {logoError && <p className="text-[12px] text-[var(--terra)] mt-2">{logoError}</p>}
              </div>

              {/* Edit fields */}
              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-[11px] font-semibold text-[#222222] block mb-1.5">Business name</label>
                  <input
                    type="text"
                    value={profileName}
                    onChange={e => { setProfileName(e.target.value); setProfileDirty(true); setProfileSaved(false); }}
                    className="w-full px-4 py-[14px] rounded-[12px] bg-[var(--bg)] text-[15px] text-[#222222] outline-none border-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#222222] block mb-1.5">Address / location</label>
                  <input
                    type="text"
                    value={profileAddress}
                    onChange={e => { setProfileAddress(e.target.value); setProfileDirty(true); setProfileSaved(false); }}
                    className="w-full px-4 py-[14px] rounded-[12px] bg-[var(--bg)] text-[15px] text-[#222222] outline-none border-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#222222] block mb-1.5">Instagram handle</label>
                  <input
                    type="text"
                    value={profileInstagram}
                    onChange={e => { setProfileInstagram(e.target.value); setProfileDirty(true); setProfileSaved(false); }}
                    placeholder="@yourbusiness"
                    className="w-full px-4 py-[14px] rounded-[12px] bg-[var(--bg)] text-[15px] text-[#222222] placeholder:text-[var(--soft)] outline-none border-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#222222] block mb-1.5">Short bio</label>
                  <textarea
                    value={profileBio}
                    onChange={e => { setProfileBio(e.target.value.slice(0, 120)); setProfileDirty(true); setProfileSaved(false); }}
                    placeholder="Tell creators what makes your business special"
                    className="w-full px-4 py-[14px] rounded-[12px] bg-[var(--bg)] text-[15px] text-[#222222] placeholder:text-[var(--soft)] outline-none border-none resize-none"
                    style={{ minHeight: '80px' }}
                  />
                  <p className="text-[11px] text-[var(--soft)] text-right mt-1">{profileBio.length}/120</p>
                </div>
              </div>

              <button
                onClick={async () => {
                  setProfileSaving(true);
                  try {
                    await supabase.from('businesses').update({
                      name: profileName,
                      address: profileAddress,
                      instagram_handle: profileInstagram,
                      bio: profileBio,
                    }).eq('id', userProfile.id);
                    setProfileDirty(false);
                    setProfileSaved(true);
                    setTimeout(() => setProfileSaved(false), 2000);
                  } catch {}
                  setProfileSaving(false);
                }}
                disabled={!profileDirty || profileSaving}
                className={`w-full py-[14px] rounded-[50px] font-bold text-[14px] transition-all min-h-[52px] ${
                  profileDirty
                    ? 'bg-[var(--terra)] text-white hover:bg-[var(--terra-hover)]'
                    : 'bg-[var(--bg)] text-[var(--soft)]'
                }`}
              >
                {profileSaved ? 'Saved \u2713' : profileSaving ? 'Saving...' : 'Save changes'}
              </button>

              {/* Account section */}
              <div className="mt-6 pt-6 border-t border-[var(--faint)]">
                <p className="text-[10px] font-bold text-[var(--soft)] uppercase mb-3" style={{ letterSpacing: '0.8px' }}>ACCOUNT</p>

                <button
                  onClick={() => setView('notifications')}
                  className="w-full flex items-center justify-between py-3 border-b border-[var(--faint)] min-h-[48px]"
                >
                  <div className="flex items-center gap-3">
                    <Bell className="w-4 h-4 text-[var(--mid)]" />
                    <span className="text-[14px] text-[#222222]">Notifications</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[var(--soft)]" />
                </button>

                {showSignOutConfirm ? (
                  <div className="mt-4 p-4 rounded-[14px] bg-[var(--bg)]">
                    <p className="text-[14px] font-semibold text-[#222222] mb-3">Sign out of nayba?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={signOut}
                        className="flex-1 py-[10px] rounded-[50px] text-[13px] font-semibold text-white bg-[var(--terra)]"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setShowSignOutConfirm(false)}
                        className="flex-1 py-[10px] rounded-[50px] text-[13px] font-semibold text-[var(--mid)] bg-white border border-[var(--faint)]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowSignOutConfirm(true)}
                    className="flex items-center gap-3 mt-2 py-3 min-h-[48px]"
                  >
                    <LogOut className="w-4 h-4 text-[var(--terra)]" />
                    <span className="text-[14px] font-semibold text-[var(--terra)]">Sign out</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ Fixed Bottom Nav ═══ */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 bg-white flex items-end justify-around"
        style={{ borderTop: '1px solid var(--faint)', padding: '10px 0 16px' }}
      >
        {bottomTabs.map((tab) => {
          const isActive = view === tab.key;
          const Icon = tab.icon;

          if (tab.key === 'scan') {
            return (
              <div key={tab.key} className="flex-1 flex items-center justify-center">
                <button
                  onClick={() => { setView('scan'); setScanResult(null); }}
                  className="flex items-center gap-[6px] px-5 py-[10px] rounded-[50px] bg-[var(--terra)] text-white"
                  style={{ marginTop: '-8px', boxShadow: '0 4px 16px rgba(196,103,74,0.3)' }}
                >
                  <Icon className="w-[18px] h-[18px] text-white" />
                  <span className="text-[12px] font-bold text-white">Scan</span>
                </button>
              </div>
            );
          }

          return (
            <button
              key={tab.key}
              onClick={() => setView(tab.key)}
              className="flex-1 flex flex-col items-center gap-1"
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-[var(--terra)]' : 'text-[var(--soft)]'}`} />
              <span className={`text-[10px] font-semibold ${isActive ? 'text-[var(--terra)]' : 'text-[var(--soft)]'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
