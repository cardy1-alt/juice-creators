import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { friendlyError } from '../lib/errors';
import { Clapperboard, Camera, Check, ChevronLeft, Lightbulb, X, Infinity, Minus, Plus, Info, QrCode, MapPin, Clock, BadgeCheck, ChevronRight, PauseCircle, RefreshCw, Sparkles, CheckCircle, ScanLine, ExternalLink, Copy, AtSign, User, Bell, LogOut, Gift, Tag, Star, Megaphone, FileText, Home, LayoutGrid, ClipboardList } from 'lucide-react';
import BusinessOnboarding from './BusinessOnboarding';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { getCategorySolidColor, CategoryIcon } from '../lib/categories';
import { getInitials } from '../lib/avatar';
import DisputeModal from './DisputeModal';
import { uploadAvatar, uploadOfferPhoto } from '../lib/upload';
import { sendVisitConfirmedCreatorEmail } from '../lib/notifications';
import FeedbackButton from './FeedbackButton';
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
  creator_id: string;
  status: string;
  claimed_at: string;
  redeemed_at: string | null;
  reel_url: string | null;
  reel_due_at: string | null;
  qr_token: string;
  creators: { name: string; instagram_handle: string; code: string; avatar_url?: string | null; follower_count?: string | null };
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
    return { background: 'var(--ink-08)', color: 'var(--ink-35)', text: 'Full' };
  }
  if (slotsLeft <= 3) {
    return { background: 'var(--terra-15)', color: 'var(--terra)', text: slotsLeft === 1 ? 'Last slot' : `${slotsLeft} left` };
  }
  return { background: 'var(--ink-08)', color: 'var(--ink-60)', text: `${slotsLeft} left` };
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
  const scanHandledRef = useRef(false);

  const safeStopScanner = async (scanner: Html5Qrcode) => {
    try {
      const state = scanner.getState();
      if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
        await scanner.stop();
      }
    } catch {
      // Already stopped or cleared — force cleanup of video elements
      try {
        const container = document.getElementById('qr-scanner-region');
        if (container) {
          container.querySelectorAll('video').forEach(v => {
            v.srcObject && (v.srcObject as MediaStream).getTracks().forEach(t => t.stop());
          });
          container.innerHTML = '';
        }
      } catch {}
    }
  };
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
        await safeStopScanner(scannerRef.current);
      }
      scannerRef.current = null;
      scanHandledRef.current = false;
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
          // Guard: only handle the first successful scan
          if (scanHandledRef.current) return;
          scanHandledRef.current = true;
          const token = extractToken(decodedText);
          setScanning(false);
          scannerRef.current = null;
          safeStopScanner(scanner).then(() => onScan(token));
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
    const scanner = scannerRef.current;
    scannerRef.current = null;
    scanHandledRef.current = true;
    setScanning(false);
    if (scanner) {
      safeStopScanner(scanner);
    }
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
        <div className="p-4 rounded-[18px] bg-[var(--peach)] border border-[var(--terra-15)] text-center mb-4">
          <Clapperboard size={20} strokeWidth={1.5} className="text-[var(--terra)] mx-auto mb-2" />
          <p className="text-[15px] text-[var(--ink)] mb-3">{cameraError}</p>
          <button
            onClick={() => { setCameraError(null); startScanner(); }}
            className="text-[15px] font-semibold text-[var(--terra)] underline"
          >
            Try again
          </button>
        </div>
      )}
      <div className="relative mx-auto w-full" style={{ maxWidth: 'min(280px, calc(100vw - 40px))' }}>
        {/* Always render the div so html5-qrcode can find it */}
        <div
          ref={regionRef}
          id="qr-scanner-region"
          className="rounded-[18px] overflow-hidden"
          style={{
            height: scanning ? 'auto' : '0',
            opacity: scanning ? 1 : 0,
            background: 'var(--ink)',
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
        <p className="text-[15px] font-semibold text-white text-center mt-3">Point at the creator's QR code</p>
      )}
      {!scanning && !cameraError && (
        <button
          onClick={startScanner}
          className="w-full flex items-center justify-center gap-2 py-[14px] rounded-[999px] font-bold text-[15px] bg-[var(--terra)] text-white hover:bg-[var(--terra-hover)] transition-all min-h-[48px]"
        >
          <Camera size={18} strokeWidth={1.5} className="" /> Open Camera
        </button>
      )}
      {scanning && (
        <button
          onClick={stopScanner}
          className="w-full mt-3 py-[10px] rounded-[999px] font-semibold text-[15px] bg-[var(--card)] text-[var(--ink-60)] hover:bg-[var(--ink-08)] transition-all min-h-[44px]"
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
    monthly_cap: number | null;
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
  const [monthlyCap, setMonthlyCap] = useState<number | null>(4);
  const [specificAsk, setSpecificAsk] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [discountAmount, setDiscountAmount] = useState('20');
  const [discountUnit, setDiscountUnit] = useState<'%' | '£'>('%');
  const [showTip, setShowTip] = useState(false);
  const [tipDismissed, setTipDismissed] = useState(false);
  const tipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [offerPhotoUrl, setOfferPhotoUrl] = useState<string | null>(null);

  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [offerId] = useState(() => crypto.randomUUID());
  const photoInputRef = useRef<HTMLInputElement>(null);

  const generatedTitle = offerType === 'discount'
    ? (discountUnit === '%' ? `${discountAmount}% off` : `£${discountAmount} off`)
    : `Free ${offerItem}`;

  const tiles = [
    { key: 'product', label: 'Free Product', icon: 'gift', sub: 'Coffee, meal, item' },
    { key: 'service', label: 'Free Service', icon: 'sparkles', sub: 'Haircut, facial, class' },
    { key: 'discount', label: 'Discount', icon: 'tag', sub: '% off or £ off' },
    { key: 'experience', label: 'Experience', icon: 'star', sub: 'Tasting, tour, event' },
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
      min_level: 1,
    });
  };

  if (showSuccess) {
    return (
      <div className="fixed inset-0 z-50 bg-[var(--shell)] flex flex-col items-center justify-center px-6">
        <Check size={56} strokeWidth={1.5} className="text-[var(--terra)] mb-4" />
        <p className="text-[24px] font-sans font-extrabold text-[var(--ink)] text-center" style={{ letterSpacing: '-0.03em' }}>Your offer is live!</p>
        <p className="text-[18px] text-[var(--ink-60)] text-center mt-2">Creators can now discover and claim it</p>
        <button
          onClick={onCancel}
          className="mt-6 px-[28px] py-[13px] rounded-[999px] bg-[var(--terra)] text-white font-bold text-[15px] hover:bg-[var(--terra-hover)] transition-all min-h-[48px]"
        >
          View offer
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-[var(--shell)] flex flex-col overflow-y-auto">
      <style>{livePulseStyle}</style>

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <button onClick={screen === 1 ? onCancel : () => setScreen(screen - 1)} className="p-2 -ml-2 min-h-[44px] min-w-[44px] flex items-center justify-center">
          <ChevronLeft size={20} strokeWidth={1.5} className="text-[var(--ink)]" />
        </button>
        {screen === 4 && (
          <button onClick={() => { setOfferPhotoUrl(null); setScreen(5); }} className="text-[18px] font-semibold text-[var(--ink-60)] min-h-[44px] flex items-center">
            Skip
          </button>
        )}
        {screen === 5 && (
          <button onClick={() => { setSpecificAsk(''); setScreen(6); }} className="text-[18px] font-semibold text-[var(--ink-60)] min-h-[44px] flex items-center">
            Skip
          </button>
        )}
      </div>

      {/* Progress bar (screens 1-5) */}
      {screen <= 5 && (
        <div className="px-5 mb-1">
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map(s => (
              <div key={s} className="flex-1 h-[3px] rounded-[3px]" style={{ background: s <= screen ? 'var(--terra)' : 'var(--card)' }} />
            ))}
          </div>
          <p className="text-[13px] text-[var(--ink-60)] text-right mt-1.5">Step {Math.min(screen, 5)} of 5</p>
        </div>
      )}

      <div className="flex-1 px-5 pb-8">
        {/* ── Screen 1: What are you offering? ── */}
        {screen === 1 && (
          <div>
            <h2 className="text-[24px] font-sans font-extrabold text-[var(--ink)] mt-4 mb-1" style={{ letterSpacing: '-0.03em' }}>What are you offering?</h2>
            <p className="text-[18px] text-[var(--ink-60)] mb-6" style={{ lineHeight: '1.6' }}>Choose the type of experience</p>
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
                  className={`flex flex-col items-center justify-center gap-2.5 rounded-[16px] min-h-[110px] transition-all ${
                    offerType === t.key
                      ? 'border-2 border-[var(--terra)]'
                      : 'border-2 border-[var(--ink-08)]'
                  }`}
                  style={{
                    padding: '24px 20px',
                    background: offerType === t.key ? 'var(--terra-5)' : 'var(--card)',
                  }}
                >
                  <div className="w-[40px] h-[40px] rounded-[12px] flex items-center justify-center">
                    {t.icon === 'gift' && <Gift size={24} strokeWidth={1.5} className="text-[var(--ink)]" />}
                    {t.icon === 'sparkles' && <Sparkles size={24} strokeWidth={1.5} className="text-[var(--ink)]" />}
                    {t.icon === 'tag' && <Tag size={24} strokeWidth={1.5} className="text-[var(--ink)]" />}
                    {t.icon === 'star' && <Star size={24} strokeWidth={1.5} className="text-[var(--ink)]" />}
                  </div>
                  <div className="text-center">
                    <p className="text-[16px] font-bold text-[var(--ink)]">{t.label}</p>
                    <p className="text-[14px] text-[var(--ink-60)] mt-0.5">{t.sub}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Screen 2: Fill in the blank ── */}
        {screen === 2 && offerType !== 'discount' && (
          <div>
            <h2 className="text-[24px] font-sans font-extrabold text-[var(--ink)] mt-4 mb-1" style={{ letterSpacing: '-0.03em' }}>What exactly will you give?</h2>
            <p className="text-[18px] text-[var(--ink-60)] mb-8" style={{ lineHeight: '1.6' }}>We'll use this to create your offer card</p>

            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-[24px] font-sans font-extrabold text-[var(--ink)]">Free</span>
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
                className="flex-1 text-[24px] font-sans font-extrabold text-[var(--ink)] border-b-2 border-[var(--terra)] bg-transparent outline-none placeholder:text-[var(--ink-60)] placeholder:font-normal"
                autoFocus
              />
            </div>
            <p className="text-[13px] text-[var(--ink-60)] text-right mb-4">{offerItem.length}/60</p>

            <p className="text-[15px] text-[var(--ink-60)]">
              Creators will see: <span className="font-semibold">Free {offerItem || getCategoryPlaceholder(category, offerType)}</span>
            </p>

            {/* Inline tip card */}
            {showTip && !tipDismissed && (
              <div
                className="relative mt-5 flex gap-[10px] items-start"
                style={{
                  background: 'var(--card)',
                  border: '1px solid var(--terra-15)',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  animation: 'tipFadeIn 300ms ease forwards',
                }}
              >
                <Lightbulb size={16} strokeWidth={1.5} className="text-[var(--terra)] flex-shrink-0 mt-[1px]" />
                <div className="flex-1">
                  <p className="text-[15px] font-bold text-[var(--ink)]">{getScreen2Tip(category, offerType).title}</p>
                  <p className="text-[13px] font-normal text-[var(--ink-60)] mt-[3px]" style={{ lineHeight: '1.6' }}>
                    {getScreen2Tip(category, offerType).body}
                  </p>
                </div>
                <button
                  onClick={() => { setTipDismissed(true); setShowTip(false); }}
                  className="flex-shrink-0 p-1"
                >
                  <X size={12} strokeWidth={1.5} className="text-[var(--ink-60)]" />
                </button>
              </div>
            )}

            <button
              onClick={() => setScreen(3)}
              disabled={offerItem.trim().length < 3}
              className={`w-full mt-8 py-[14px] rounded-[999px] font-bold text-[18px] transition-all min-h-[52px] ${
                offerItem.trim().length >= 3
                  ? 'bg-[var(--terra)] text-white hover:bg-[var(--terra-hover)]'
                  : 'bg-[var(--card)] text-[var(--ink-60)]'
              }`}
            >
              Next
            </button>
          </div>
        )}

        {/* ── Screen 2 (Discount): Amount + unit toggle ── */}
        {screen === 2 && offerType === 'discount' && (
          <div>
            <h2 className="text-[24px] font-sans font-extrabold text-[var(--ink)] mt-4 mb-1" style={{ letterSpacing: '-0.03em' }}>What's the discount?</h2>
            <p className="text-[18px] text-[var(--ink-60)] mb-8" style={{ lineHeight: '1.6' }}>Set the amount creators will receive</p>

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
                className="text-[52px] font-sans font-extrabold text-[var(--ink)] border-b-2 border-[var(--terra)] bg-transparent outline-none text-center"
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
                className="px-5 py-2 rounded-[999px] text-[17px] font-bold transition-all"
                style={{
                  background: discountUnit === '%' ? 'var(--ink)' : 'var(--card)',
                  color: discountUnit === '%' ? 'white' : 'var(--ink-60)',
                }}
              >
                %
              </button>
              <button
                onClick={() => setDiscountUnit('£')}
                className="px-5 py-2 rounded-[999px] text-[17px] font-bold transition-all"
                style={{
                  background: discountUnit === '£' ? 'var(--ink)' : 'var(--card)',
                  color: discountUnit === '£' ? 'white' : 'var(--ink-60)',
                }}
              >
                £
              </button>
            </div>

            <p className="text-[15px] text-[var(--ink-60)] text-center">
              Creators will see: <span className="font-semibold">{discountUnit === '%' ? `${discountAmount || '0'}% off` : `£${discountAmount || '0'} off`}</span>
            </p>

            <button
              onClick={() => setScreen(3)}
              disabled={!discountAmount || parseInt(discountAmount) < 1}
              className={`w-full mt-8 py-[14px] rounded-[999px] font-bold text-[18px] transition-all min-h-[52px] ${
                discountAmount && parseInt(discountAmount) >= 1
                  ? 'bg-[var(--terra)] text-white hover:bg-[var(--terra-hover)]'
                  : 'bg-[var(--card)] text-[var(--ink-60)]'
              }`}
            >
              Next
            </button>
          </div>
        )}

        {/* ── Screen 3: How many slots? ── */}
        {screen === 3 && (
          <div>
            <h2 className="text-[24px] font-sans font-extrabold text-[var(--ink)] mt-4 mb-1" style={{ letterSpacing: '-0.03em' }}>How many creators?</h2>
            <p className="text-[18px] text-[var(--ink-60)] mb-10" style={{ lineHeight: '1.6' }}>Each slot is one creator visit</p>

            {monthlyCap === null ? (
              <div className="flex flex-col items-center mb-4">
                <div className="w-20 h-20 rounded-full bg-[var(--terra-10)] flex items-center justify-center mb-3">
                  <Infinity size={40} strokeWidth={1.5} className="text-[var(--terra)]" />
                </div>
                <span className="text-[32px] font-sans font-extrabold text-[var(--ink)]">Unlimited</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-6 mb-4">
                <button
                  onClick={() => setMonthlyCap(Math.max(1, monthlyCap - 1))}
                  className="w-[44px] h-[44px] rounded-full flex items-center justify-center bg-[var(--card)] min-h-[44px]"
                >
                  <Minus size={20} strokeWidth={1.5} className="text-[var(--ink)]" />
                </button>
                <span className="text-[28px] font-sans font-extrabold text-[var(--ink)] min-w-[80px] text-center" style={{ lineHeight: 1 }}>
                  {monthlyCap}
                </span>
                <button
                  onClick={() => setMonthlyCap(Math.min(20, monthlyCap + 1))}
                  className="w-[44px] h-[44px] rounded-full bg-[var(--terra)] flex items-center justify-center min-h-[44px]"
                >
                  <Plus size={20} strokeWidth={1.5} className="text-white" />
                </button>
              </div>
            )}
            <p className="text-[15px] text-[var(--ink-60)] text-center mb-4">{monthlyCap === null ? 'No limit on claims per month' : 'We recommend starting with 4'}</p>

            {/* Unlimited toggle */}
            <button
              onClick={() => setMonthlyCap(monthlyCap === null ? 4 : null)}
              className={`w-full flex items-center justify-between px-[16px] py-[14px] rounded-[12px] mb-8 transition-all ${
                monthlyCap === null
                  ? 'bg-[var(--terra-10)] border border-[var(--terra)]'
                  : 'bg-[var(--card)] border border-transparent'
              }`}
            >
              <div className="flex items-center gap-[10px]">
                <Infinity size={18} strokeWidth={1.5} color={monthlyCap === null ? 'var(--terra)' : 'var(--ink-60)'} />
                <span className="text-[18px] font-semibold text-[var(--ink)]">Unlimited claims</span>
              </div>
              <div className={`w-[44px] h-[26px] rounded-full transition-all flex items-center ${monthlyCap === null ? 'bg-[var(--terra)] justify-end' : 'bg-[var(--ink-08)] justify-start'}`}>
                <div className="w-[22px] h-[22px] rounded-full bg-[var(--card)] mx-[2px] shadow-sm" />
              </div>
            </button>

            <div className="bg-[var(--card)] rounded-[12px] p-[14px] flex items-start gap-2.5 mb-6">
              <Info size={14} strokeWidth={1.5} className="text-[var(--ink-60)] mt-0.5 flex-shrink-0" />
              <p className="text-[14px] text-[var(--ink-60)]">Each creator visits in person and posts within 48 hours</p>
            </div>

            <button
              onClick={() => setScreen(4)}
              className="w-full py-[14px] rounded-[999px] font-bold text-[15px] bg-[var(--terra)] text-white hover:bg-[var(--terra-hover)] transition-all min-h-[52px]"
            >
              Next
            </button>
          </div>
        )}

        {/* ── Screen 4: Add a photo (optional) ── */}
        {screen === 4 && (
          <div>
            <h2 className="text-[24px] font-sans font-extrabold text-[var(--ink)] mt-4 mb-1" style={{ letterSpacing: '-0.03em' }}>Add a photo</h2>
            <p className="text-[18px] text-[var(--ink-60)] mb-8" style={{ lineHeight: '1.6' }}>Optional — helps your offer stand out</p>

            <div className="flex flex-col items-center mb-6">
              <div className="relative">
                {offerPhotoUrl ? (
                  <div className="relative">
                    <img
                      src={offerPhotoUrl}
                      alt="Offer photo"
                      className="w-[160px] h-[120px] object-cover rounded-[18px]"
                    />
                    <button
                      onClick={() => setOfferPhotoUrl(null)}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ background: 'var(--ink-35)' }}
                    >
                      <X size={12} strokeWidth={1.5} className="text-white" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => photoInputRef.current?.click()}
                    className="w-[160px] h-[120px] rounded-[16px] flex flex-col items-center justify-center gap-2"
                    style={{
                      background: 'var(--card)',
                      border: '1.5px dashed var(--ink-15)',
                    }}
                  >
                    {photoUploading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span className="text-[26px] font-extrabold text-[rgba(255,255,255,0.8)]">{getInitials('Offer')}</span>
                        <Camera size={20} strokeWidth={1.5} className="text-[var(--ink-60)]" />
                        <span className="text-[14px] text-[var(--ink-60)]">Tap to add photo</span>
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
              {photoError && <p className="text-[14px] text-[var(--terra)] mt-2">{photoError}</p>}
            </div>

            <div className="flex justify-center gap-2 mb-8">
              {['Use natural light', 'Show your product', 'Keep it simple'].map(tip => (
                <span key={tip} className="px-3 py-[5px] rounded-[999px] bg-[var(--card)] text-[var(--ink-60)] text-[14px] font-medium">
                  {tip}
                </span>
              ))}
            </div>

            <button
              onClick={() => setScreen(5)}
              className="w-full py-[14px] rounded-[999px] font-bold text-[15px] bg-[var(--terra)] text-white hover:bg-[var(--terra-hover)] transition-all min-h-[52px]"
            >
              Next
            </button>
          </div>
        )}

        {/* ── Screen 5: Any specific ask? ── */}
        {screen === 5 && (
          <div>
            <h2 className="text-[24px] font-sans font-extrabold text-[var(--ink)] mt-4 mb-1" style={{ letterSpacing: '-0.03em' }}>Anything specific?</h2>
            <p className="text-[18px] text-[var(--ink-60)] mb-6" style={{ lineHeight: '1.6' }}>Optional — most businesses skip this</p>

            <textarea
              value={specificAsk}
              onChange={e => setSpecificAsk(e.target.value.slice(0, 100))}
              placeholder="e.g. Please show the latte art, or mention our new seasonal menu"
              className="w-full px-[16px] py-[14px] rounded-[14px] bg-[var(--card)] border-[1.5px] border-[var(--ink-08)] focus:border-[var(--terra)] focus:ring-3 focus:ring-[var(--terra-ring)] text-[15px] font-normal text-[var(--ink)] placeholder:text-[var(--ink)]/40 outline-none resize-none"
              style={{ minHeight: '100px' }}
            />
            <p className="text-[12px] font-normal text-[var(--ink-35)] text-right mt-1 mb-4">{specificAsk.length}/100</p>

            <div className="flex flex-wrap gap-2 mb-8">
              {exampleChips.map((chip, i) => (
                <button
                  key={i}
                  onClick={() => setSpecificAsk(chip.slice(0, 100))}
                  className="px-3 py-1.5 rounded-[999px] bg-[var(--card)] text-[var(--ink-60)] text-[14px] font-semibold hover:bg-[var(--ink-08)] transition-colors"
                >
                  {chip}
                </button>
              ))}
            </div>

            <button
              onClick={() => setScreen(6)}
              className="w-full py-[14px] rounded-[999px] font-bold text-[15px] bg-[var(--terra)] text-white hover:bg-[var(--terra-hover)] transition-all min-h-[52px]"
            >
              Next
            </button>
          </div>
        )}

        {/* ── Screen 6: Preview ── */}
        {screen === 6 && (
          <div>
            <h2 className="text-[24px] font-sans font-extrabold text-[var(--ink)] mt-4 mb-1" style={{ letterSpacing: '-0.03em' }}>Your offer</h2>
            <p className="text-[18px] text-[var(--ink-60)] mb-6" style={{ lineHeight: '1.6' }}>This is exactly what creators will see</p>

            {/* Offer card preview */}
            <div className="rounded-[18px] overflow-hidden shadow-[var(--shadow-md)] mb-6">
              {/* Image area */}
              <div
                className="relative flex items-center justify-center overflow-hidden"
                style={{ height: '120px', background: offerPhotoUrl ? undefined : getCategorySolidColor(category) }}
              >
                {offerPhotoUrl ? (
                  <img src={offerPhotoUrl} alt="Offer" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <span className="text-[32px] font-extrabold text-white/80">{getInitials('Offer')}</span>
                )}
                <span className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-[999px] text-[13px] font-bold text-[var(--ink)]" style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(4px)' }}>
                  <Clapperboard size={10} strokeWidth={1.5} className="" /> Reel
                </span>
              </div>
              {/* Body */}
              <div className="p-4">
                <p className="text-[17px] font-extrabold text-[var(--ink)]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Your business</p>
                <p className="text-[18px] font-sans font-extrabold text-[var(--ink)] mt-0.5" style={{ letterSpacing: '-0.03em' }}>{generatedTitle}</p>
                <div className="flex items-center gap-1 mt-1.5">
                  <Clapperboard size={13} strokeWidth={1.5} className="text-[var(--terra)]" />
                  <span className="text-[15px] text-[var(--ink-60)]">Instagram Reel</span>
                </div>
                <p className="text-[15px] text-[var(--ink-60)] mt-1">{monthlyCap === null ? 'Unlimited slots' : `${monthlyCap} slots available`}</p>
                {specificAsk.trim() && (
                  <div className="mt-3 p-3 rounded-[12px]" style={{ background: 'var(--terra-5)' }}>
                    <p className="text-[18px] text-[var(--ink-60)]" style={{ lineHeight: '1.6' }}>{specificAsk}</p>
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
                  <div className="flex items-center justify-between rounded-[12px] px-4 py-3" style={{ background: quality === 'excellent' ? 'var(--terra-10)' : quality === 'great' ? 'rgba(232,160,32,0.12)' : 'var(--ink-08)' }}>
                    <span className="text-[14px] font-semibold" style={{ color: quality === 'excellent' ? 'var(--terra)' : quality === 'great' ? 'var(--ochre)' : 'var(--ink-60)' }}>Offer quality</span>
                    <div className="flex gap-[5px]">
                      {[1, 2, 3].map(i => (
                        <span
                          key={i}
                          className="w-2 h-2 rounded-full"
                          style={{ background: i <= dots ? 'var(--terra)' : 'var(--ink-15)' }}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-[14px] mt-1.5" style={{ color: quality === 'excellent' ? 'var(--terra)' : quality === 'great' ? 'var(--ochre)' : 'var(--ink-60)' }}>
                    {quality === 'good' && 'Good start. Adding a specific ask can double your reel quality.'}
                    {quality === 'great' && 'Great offer. Creators will find this clear and compelling.'}
                    {quality === 'excellent' && 'Excellent. This offer is specific, clear and ready to perform.'}
                  </p>
                  {quality === 'good' && (
                    <button
                      onClick={() => setScreen(5)}
                      className="flex items-center gap-1 mt-1 text-[14px] font-semibold text-[var(--terra)]"
                    >
                      Add a specific ask <ChevronRight size={11} strokeWidth={1.5} />
                    </button>
                  )}
                </div>
              );
            })()}

            <button
              onClick={() => setScreen(1)}
              className="text-[15px] font-semibold text-[var(--ink-60)] mb-6 flex items-center gap-1"
            >
              <ChevronLeft size={12} strokeWidth={1.5} className="w-3.5 h-3.5" /> Edit offer
            </button>

            <button
              onClick={async () => {
                await handleGoLive();
                setShowSuccess(true);
              }}
              disabled={isSubmitting}
              className="w-full py-[14px] rounded-[999px] font-bold text-[15px] bg-[var(--terra)] text-white hover:bg-[var(--terra-hover)] disabled:opacity-50 transition-all min-h-[52px]"
              style={{ boxShadow: 'var(--shadow-lg)' }}
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

const cardPalette = ['var(--card)', '#E8EEE7', '#E4EAED', '#F2E8E0', '#EDE8D0'];
const getCardColor = (index: number) => cardPalette[index % cardPalette.length];

export default function BusinessPortal() {
  const { userProfile, signOut } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(() => {
    // Database-driven check: only show wizard if onboarding_complete is not true
    return userProfile?.onboarding_complete !== true;
  });
  const [offers, setOffers] = useState<Offer[]>([]);
  const [claims, setClaims] = useState<ClaimWithDetails[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [view, setView] = useState<'home' | 'offers' | 'claims' | 'scan' | 'notifications' | 'profile'>(
    new URLSearchParams(window.location.search).get('redeem') ? 'scan' : 'home'
  );
  const [showOfferBuilder, setShowOfferBuilder] = useState(false);
  const [scanCode, setScanCode] = useState('');
  const [scanResult, setScanResult] = useState<{ type: 'success' | 'error'; message: string; creatorName?: string } | null>(null);
  const urlRedeemHandledRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [disputeClaimId, setDisputeClaimId] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [offersLoaded, setOffersLoaded] = useState(false);
  const [claimsFilter, setClaimsFilter] = useState<string>('all');
  const [creatorFilter, setCreatorFilter] = useState<string | null>(null);
  const [claimsSubView, setClaimsSubView] = useState<'claims' | 'content'>('claims');
  const [claimsOnboardingDismissed, setClaimsOnboardingDismissed] = useState(() => localStorage.getItem('nayba_biz_claims_onboarding') === 'true');
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
  const [profileSubView, setProfileSubView] = useState<'main' | 'edit'>('main');
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [editOfferTitle, setEditOfferTitle] = useState('');
  const [editOfferCap, setEditOfferCap] = useState<number | null>(null);
  const [editOfferAsk, setEditOfferAsk] = useState('');
  const [editOfferDirty, setEditOfferDirty] = useState(false);
  const [editOfferSaving, setEditOfferSaving] = useState(false);
  const [editOfferSaved, setEditOfferSaved] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [nearbyBusinesses, setNearbyBusinesses] = useState<{ id: string; name: string; category: string; logo_url: string | null; address: string | null; bio: string | null; offer_count: number; claim_count: number; creator_count: number; latest_claim_at: string | null }[]>([]);
  const [expandedNearbyBiz, setExpandedNearbyBiz] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const offerPhotoInputRef = useRef<HTMLInputElement>(null);
  const [offerPhotoUploading, setOfferPhotoUploading] = useState(false);

  // Clean redeem param from URL after reading it — and auto-verify if present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('redeem');
    if (token) {
      // Clean URL first
      const url = new URL(window.location.href);
      url.searchParams.delete('redeem');
      window.history.replaceState({}, '', url.pathname + url.search);
      // Then auto-verify
      if (!urlRedeemHandledRef.current) {
        urlRedeemHandledRef.current = true;
        verifyToken(token);
      }
    }
  }, []);

  useEffect(() => {
    if (userProfile?.approved) {
      fetchOffers();
      fetchClaims();
      fetchNotifications();
      fetchNearbyBusinesses();
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
    const { data, error } = await supabase.from('claims').select('*, creators(name, instagram_handle, code, avatar_url, follower_count), offers(description, generated_title)').eq('business_id', userProfile.id).order('claimed_at', { ascending: false });
    if (error) { setFetchError('Failed to load claims.'); return; }
    if (data) {
      // Filter out claims where the creator join returned null (RLS or deleted creator)
      const valid = data.filter((c: any) => c.creators !== null) as ClaimWithDetails[];
      setClaims(valid);
    }
  };

  const fetchNotifications = async () => {
    const { data, error } = await supabase.from('notifications').select('*').eq('user_id', userProfile.id).order('created_at', { ascending: false }).limit(20);
    if (error) return;
    if (data) setNotifications(data);
  };

  const fetchNearbyBusinesses = async () => {
    // Fetch other approved businesses and their claim activity
    const { data: businesses } = await supabase
      .from('businesses')
      .select('id, name, category, logo_url, address, bio')
      .eq('approved', true)
      .neq('id', userProfile.id)
      .limit(10);
    if (!businesses || businesses.length === 0) {
      setNearbyBusinesses([]);
      return;
    }

    // Fetch claim counts and offer counts for these businesses
    const ids = businesses.map(b => b.id);
    const [{ data: claimsData }, { data: offersData }] = await Promise.all([
      supabase.from('claims').select('business_id, creator_id, claimed_at').in('business_id', ids),
      supabase.from('offers').select('business_id').eq('is_live', true).in('business_id', ids),
    ]);

    const statsMap = new Map<string, { claim_count: number; creators: Set<string>; latest: string | null }>();
    for (const c of (claimsData || [])) {
      const s = statsMap.get(c.business_id) || { claim_count: 0, creators: new Set<string>(), latest: null };
      s.claim_count++;
      s.creators.add(c.creator_id);
      if (!s.latest || c.claimed_at > s.latest) s.latest = c.claimed_at;
      statsMap.set(c.business_id, s);
    }

    const offerMap = new Map<string, number>();
    for (const o of (offersData || [])) {
      offerMap.set(o.business_id, (offerMap.get(o.business_id) || 0) + 1);
    }

    const result = businesses
      .map(b => {
        const s = statsMap.get(b.id);
        return {
          id: b.id,
          name: b.name,
          category: b.category || 'Food & Drink',
          logo_url: b.logo_url || null,
          address: b.address || null,
          bio: b.bio || null,
          offer_count: offerMap.get(b.id) || 0,
          claim_count: s?.claim_count || 0,
          creator_count: s?.creators.size || 0,
          latest_claim_at: s?.latest || null,
        };
      })
      .sort((a, b) => b.claim_count - a.claim_count)
      .slice(0, 5);

    setNearbyBusinesses(result);
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
    monthly_cap: number | null;
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

  const handleOfferPhotoUpload = async (file: File, offerId: string) => {
    setOfferPhotoUploading(true);
    try {
      const { url, error } = await uploadOfferPhoto(file, offerId, userProfile.id);
      if (url) {
        // Update UI immediately even if DB update had issues
        setOffers(prev => prev.map(o => o.id === offerId ? { ...o, offer_photo_url: url } : o));
        if (selectedOffer?.id === offerId) {
          setSelectedOffer(prev => prev ? { ...prev, offer_photo_url: url } : null);
        }
      }
      if (error && !url) {
        alert(error);
      }
    } catch (err: any) {
      console.error('Offer photo upload failed:', err.message);
      alert('Photo upload failed — please try again.');
    } finally {
      setOfferPhotoUploading(false);
    }
  };

  const handleUpdateOffer = async () => {
    if (!selectedOffer || !editOfferDirty) return;
    setEditOfferSaving(true);
    try {
      const updates: Record<string, unknown> = {};
      if (editOfferTitle !== (selectedOffer.generated_title || selectedOffer.description)) updates.generated_title = editOfferTitle;
      if (editOfferTitle !== selectedOffer.description) updates.description = editOfferTitle;
      if (editOfferCap !== selectedOffer.monthly_cap) updates.monthly_cap = editOfferCap;
      if (editOfferAsk !== (selectedOffer.specific_ask || '')) updates.specific_ask = editOfferAsk || null;
      const { error } = await supabase.from('offers').update(updates).eq('id', selectedOffer.id);
      if (error) throw error;
      setEditOfferDirty(false);
      setEditOfferSaved(true);
      setTimeout(() => setEditOfferSaved(false), 2000);
      fetchOffers();
      // Update local selectedOffer to reflect changes
      setSelectedOffer(prev => prev ? { ...prev, ...updates } as Offer : null);
    } catch (err: any) {
      console.error('Failed to update offer:', err.message);
    }
    setEditOfferSaving(false);
  };

  const openOfferDetail = (offer: Offer) => {
    setSelectedOffer(offer);
    setEditOfferTitle(offer.generated_title || offer.description);
    setEditOfferCap(offer.monthly_cap);
    setEditOfferAsk(offer.specific_ask || '');
    setEditOfferDirty(false);
    setEditOfferSaved(false);
  };

  const verifyToken = async (token: string) => {
    setLoading(true);
    setScanResult(null);
    try {
      const { data, error } = await supabase.rpc('redeem_offer', {
        p_qr_token: token,
        p_business_id: userProfile.id,
      });

      if (error) throw error;
      if (!data || data?.error) {
        setScanResult({ type: 'error', message: friendlyError(data?.error) });
        setScanCode('');
        return;
      }

      // Fetch creator details for the success message and email
      let creatorName = 'Creator';
      try {
        const { data: claim } = await supabase
          .from('claims')
          .select('creator_id, reel_due_at, creators(name)')
          .eq('id', data.claim_id)
          .maybeSingle();
        creatorName = (claim as any)?.creators?.name || 'Creator';
        // Send visit confirmed email to creator (non-blocking)
        if (claim?.creator_id) {
          sendVisitConfirmedCreatorEmail(
            claim.creator_id,
            userProfile.name,
            claim.reel_due_at || '',
          ).catch(() => {});
        }
      } catch {
        // Non-critical — proceed with fallback name
      }

      setScanResult({ type: 'success', message: 'Visit confirmed', creatorName });
      setScanCode('');
      fetchClaims();
    } catch (error: any) {
      setScanResult({ type: 'error', message: friendlyError(error.message) });
    } finally {
      setLoading(false);
    }
  };

  const handleScanCode = async (e: React.FormEvent) => {
    e.preventDefault();
    await verifyToken(scanCode);
  };

  // Auto-verify from ?redeem= is now handled in the cleanup useEffect above

  const unreadCount = notifications.filter(n => !n.read).length;
  const activeClaimsCount = claims.filter(c => c.status === 'active').length;

  const isPendingApproval = !userProfile?.approved;

  // If pending approval and not on profile view, force to profile
  if (isPendingApproval && view !== 'profile') {
    setView('profile');
  }

  // Business onboarding — shown until onboarding_complete = true
  if (showOnboarding) {
    return (
      <BusinessOnboarding
        profile={userProfile}
        onComplete={() => {
          setShowOnboarding(false);
          fetchOffers();
          fetchClaims();
        }}
        onFinishLater={() => {
          setShowOnboarding(false);
        }}
      />
    );
  }

  const bottomTabs: { key: 'home' | 'offers' | 'scan' | 'claims' | 'profile'; label: string; icon: any }[] = [
    { key: 'home', label: 'Home', icon: 'dashboard' },
    { key: 'offers', label: 'Campaign', icon: 'megaphone' },
    { key: 'scan', label: 'Scan', icon: 'scan' },
    { key: 'claims', label: 'Claims', icon: 'doc' },
    { key: 'profile', label: 'Profile', icon: 'user' },
  ];

  const claimStatusStyle = (status: string) => {
    switch (status) {
      case 'active': return 'bg-[var(--terra)] text-white';
      case 'redeemed': return 'bg-[var(--card)] text-[var(--ink-60)]';
      case 'reel_due': return 'bg-[var(--peach)] text-[var(--ink)]';
      case 'completed': return 'bg-[var(--card)] text-[var(--ink-60)]';
      case 'disputed': return 'bg-[var(--terra-15)] text-[var(--terra)]';
      default: return 'bg-[var(--card)] text-[var(--ink-60)]';
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

  // Filter claims — exact rules per issue #6
  const filteredClaims = claims
    .filter(c => {
      if (claimsFilter === 'all') return true;
      if (claimsFilter === 'active') return c.status === 'active' || c.status === 'claimed';
      if (claimsFilter === 'redeemed') return (c.status === 'redeemed' || c.status === 'visited') && !c.reel_url;
      if (claimsFilter === 'reel_due') return (c.status === 'redeemed' || c.status === 'visited') && !c.reel_url && c.reel_due_at && new Date(c.reel_due_at) > new Date();
      if (claimsFilter === 'completed') return c.status === 'completed';
      return c.status === claimsFilter;
    })
    .filter(c => !creatorFilter || c.creator_id === creatorFilter);

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

  // Deduplicate by creator — show only the most recent claim per creator
  const recentActivity = (() => {
    const sorted = [...claims].sort((a, b) => new Date(b.claimed_at).getTime() - new Date(a.claimed_at).getTime());
    const seen = new Map<string, { claim: ClaimWithDetails; count: number }>();
    for (const claim of sorted) {
      const cid = claim.creator_id;
      if (seen.has(cid)) {
        seen.get(cid)!.count++;
      } else {
        seen.set(cid, { claim, count: 1 });
      }
    }
    return Array.from(seen.values()).slice(0, 8);
  })();

  const liveOffers = offers.filter(o => o.is_live);
  const activeOffer = liveOffers[0] || null;

  // Filter pill counts (respect creatorFilter when active)
  const countBase = creatorFilter ? claims.filter(c => c.creator_id === creatorFilter) : claims;
  const filterCounts: Record<string, number> = {
    all: countBase.length,
    active: countBase.filter(c => c.status === 'active' || c.status === 'claimed').length,
    redeemed: countBase.filter(c => (c.status === 'redeemed' || c.status === 'visited') && !c.reel_url).length,
    reel_due: countBase.filter(c => (c.status === 'redeemed' || c.status === 'visited') && !c.reel_url && c.reel_due_at && new Date(c.reel_due_at) > new Date()).length,
    completed: countBase.filter(c => c.status === 'completed').length,
  };

  return (
    <div className="h-[100dvh] flex flex-col bg-[var(--shell)]" style={{ overscrollBehavior: 'none' }}>
      <style>{livePulseStyle}</style>

      {/* ═══ Business Profile Overlay ═══ */}
      {expandedNearbyBiz && (() => {
        const biz = nearbyBusinesses.find(b => b.id === expandedNearbyBiz);
        if (!biz) return null;
        return (
          <div className="fixed inset-0 z-50 bg-[var(--shell)] flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-3 px-[20px] pt-[20px] pb-[14px] border-b border-[var(--ink-08)] flex-shrink-0">
              <button
                onClick={() => setExpandedNearbyBiz(null)}
                className="w-[36px] h-[36px] rounded-full bg-[var(--card)] flex items-center justify-center"
              >
                <X size={18} strokeWidth={1.5} className="text-[var(--ink)]" />
              </button>
              <span className="text-[17px] font-bold text-[var(--ink)] flex-1 truncate">{biz.name}</span>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-[20px] pt-[24px]">
              {/* ═══ Profile card (matches creator profile DNA) ═══ */}
              <div className="rounded-[18px] p-[24px] mb-[16px]" style={{ border: '1px solid var(--ink-08)' }}>
                <div className="flex items-start gap-[16px]">
                  {/* Logo */}
                  <div
                    className="w-[72px] h-[72px] rounded-[18px] flex items-center justify-center overflow-hidden flex-shrink-0"
                    style={{ background: getCategorySolidColor(biz.category) }}
                  >
                    {biz.logo_url ? (
                      <img src={biz.logo_url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <span className="text-[28px] font-bold text-white">{biz.name.charAt(0)}</span>
                    )}
                  </div>
                  {/* Name + meta */}
                  <div className="flex-1 min-w-0 pt-[2px]">
                    <h2 className="text-[24px] font-sans font-extrabold text-[var(--ink)] leading-tight" style={{ letterSpacing: '-0.03em' }}>{biz.name}</h2>
                    <p className="text-[18px] text-[var(--ink-60)] mt-[2px]">{biz.category}</p>
                    {biz.address && (
                      <p className="text-[14px] text-[var(--ink-60)] mt-[4px] flex items-center gap-[4px]">
                        <MapPin size={12} strokeWidth={1.5} /> {biz.address}
                      </p>
                    )}
                  </div>
                </div>

                {/* Stats row inside card */}
                <div className="flex items-center mt-[20px] pt-[16px] border-t border-[var(--ink-08)]">
                  <div className="flex-1 text-center">
                    <p className="text-[24px] font-sans font-extrabold text-[var(--ink)]">{biz.claim_count}</p>
                    <p className="text-[13px] text-[var(--ink-60)] font-semibold">Collabs</p>
                  </div>
                  <div className="w-[1px] h-[32px] bg-[var(--ink-08)]" />
                  <div className="flex-1 text-center">
                    <p className="text-[24px] font-sans font-extrabold text-[var(--ink)]">{biz.creator_count}</p>
                    <p className="text-[13px] text-[var(--ink-60)] font-semibold">Creators</p>
                  </div>
                  <div className="w-[1px] h-[32px] bg-[var(--ink-08)]" />
                  <div className="flex-1 text-center">
                    <p className="text-[24px] font-sans font-extrabold text-[var(--ink)]">{biz.offer_count}</p>
                    <p className="text-[13px] text-[var(--ink-60)] font-semibold">Live offers</p>
                  </div>
                </div>
              </div>

              {/* ═══ About card ═══ */}
              {biz.bio && (
                <div className="rounded-[18px] p-[16px] mb-[16px]">
                  <h3 className="text-[18px] font-sans font-extrabold text-[var(--ink)] mb-[8px]" style={{ letterSpacing: '-0.03em' }}>About</h3>
                  <p className="text-[18px] text-[var(--ink-60)] leading-[1.5]">{biz.bio}</p>
                </div>
              )}

              {/* ═══ Details card ═══ */}
              <div className="rounded-[18px] p-[16px] mb-[16px]">
                {biz.address && (
                  <div className="flex items-center gap-[10px] py-[4px]">
                    <MapPin size={18} strokeWidth={1.5} className="text-[var(--ink-60)] flex-shrink-0" />
                    <p className="text-[18px] text-[var(--ink)]">{biz.address}</p>
                  </div>
                )}
                {biz.address && biz.latest_claim_at && <div className="border-t border-[var(--ink-08)] my-[10px]" />}
                {biz.latest_claim_at && (
                  <div className="flex items-center gap-[10px] py-[4px]">
                    <Clock size={18} strokeWidth={1.5} className="text-[var(--ink-60)] flex-shrink-0" />
                    <p className="text-[18px] text-[var(--ink)]">Last activity {timeAgo(biz.latest_claim_at)}</p>
                  </div>
                )}
              </div>

              {/* ═══ Verified badge card ═══ */}
              <div className="rounded-[18px] p-[16px] mb-[32px]">
                <div className="flex items-center gap-[10px]">
                  <div className="w-[36px] h-[36px] rounded-full bg-[var(--terra-10)] flex items-center justify-center flex-shrink-0">
                    <BadgeCheck size={18} strokeWidth={1.5} className="text-[var(--terra)]" />
                  </div>
                  <div>
                    <p className="text-[18px] font-bold text-[var(--ink)]">Verified on Nayba</p>
                    <p className="text-[14px] text-[var(--ink-60)]">Approved by the Nayba team</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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

      <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div style={{ padding: '20px 20px 14px', borderBottom: '1px solid var(--ink-08)' }}>
          <div className="flex items-center justify-between">
            <Logo variant="wordmark" size={22} />
            <div className="text-right">
              <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: 15, color: 'var(--ink)', margin: 0 }}>{userProfile.name}</p>
              <span style={{
                display: 'inline-block', marginTop: 3, padding: '2px 10px', borderRadius: 999,
                background: 'var(--card)', border: '1px solid var(--ink-08)',
                fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500, fontSize: 12, color: 'var(--ink-60)',
              }}>
                Business
              </span>
            </div>
          </div>
        </div>

        <div className="p-[20px]">
          {fetchError && (
            <div className="mb-4 p-3 rounded-[12px] bg-[var(--terra-10)] border border-[var(--terra-20)] text-[15px] text-[var(--terra)] font-medium">
              {fetchError}
            </div>
          )}

          {/* ═══ HOME ═══ */}
          {view === 'home' && (
            <div>
              {/* Setup incomplete banner */}
              {userProfile?.onboarding_complete !== true && (
                <button
                  onClick={() => setShowOnboarding(true)}
                  className="w-full flex items-center justify-between px-[16px] py-[12px] rounded-[12px] mb-[16px] text-left"
                  style={{ background: 'var(--terra-10)', border: '1px solid var(--terra-15)' }}
                >
                  <span className="text-[18px] font-semibold text-[var(--terra)]">Complete your setup to go live →</span>
                  <ChevronRight size={16} strokeWidth={1.5} className="text-[var(--terra)]" />
                </button>
              )}
              {/* Greeting + compact stats banner */}
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 24, color: 'var(--ink)', letterSpacing: '-0.03em', lineHeight: 1.2, margin: 0 }}>
                    {getGreeting()}, {userProfile.name}
                  </h2>
                  <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500, fontSize: 14, color: 'var(--ink-60)', margin: 0, marginTop: 4 }}>
                    {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                </div>
              </div>

              {/* Compact inline stats */}
              <div className="flex items-center gap-[6px] mb-7 flex-wrap">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, background: 'var(--terra)' }}>
                  <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 14, color: 'white' }}>{activeClaimsCount}</span>
                  <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>active</span>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, background: 'var(--card)', border: '1px solid var(--ink-08)' }}>
                  <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 14, color: 'var(--ink)' }}>{reelsThisMonth}</span>
                  <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--ink-60)' }}>reels</span>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, background: 'var(--card)', border: '1px solid var(--ink-08)' }}>
                  <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 800, fontSize: 14, color: 'var(--ink)' }}>{totalSlotsLeft > 98 ? '∞' : totalSlotsLeft}</span>
                  <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: 12, color: 'var(--ink-60)' }}>slots left</span>
                </span>
              </div>

              {/* Your campaign — single active offer card */}
              <div className="mb-7">
                <h3 className="text-[20px] font-sans font-extrabold text-[var(--ink)] mb-[14px]" style={{ letterSpacing: '-0.03em' }}>Your campaign</h3>

                {activeOffer ? (() => {
                  const slotsUsed = activeOffer.slotsUsed || 0;
                  const slotCap = activeOffer.monthly_cap;
                  const isUnlimited = slotCap === null;
                  const progress = isUnlimited ? 0 : Math.min(1, slotsUsed / slotCap);
                  return (
                    <div className="rounded-[20px] overflow-hidden" style={{ boxShadow: 'var(--shadow-md)' }}>
                      {/* Hidden file input for offer photo */}
                      <input
                        ref={offerPhotoInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file && activeOffer) await handleOfferPhotoUpload(file, activeOffer.id);
                          e.target.value = '';
                        }}
                      />
                      {/* Photo hero */}
                      <div className="relative h-[220px]" style={{ background: getCategorySolidColor(userProfile.category) }}>
                        {activeOffer.offer_photo_url ? (
                          <img src={activeOffer.offer_photo_url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <button
                              onClick={() => offerPhotoInputRef.current?.click()}
                              disabled={offerPhotoUploading}
                              className="px-[16px] py-[8px] rounded-[999px] text-[15px] font-semibold bg-[var(--card)]/90 text-[var(--ink)] flex items-center gap-[6px]"
                            >
                              <Camera size={14} strokeWidth={1.5} /> {offerPhotoUploading ? 'Uploading…' : 'Add a photo'}
                            </button>
                          </div>
                        )}
                        {/* Top badges */}
                        <span className="absolute top-[12px] left-[12px] inline-flex items-center gap-[4px] px-[10px] py-[4px] rounded-[999px] text-[13px] font-semibold bg-[var(--card)]/90 text-[var(--terra)] backdrop-blur-sm">
                          <span className="w-[6px] h-[6px] rounded-full bg-[var(--terra)]" style={{ animation: 'livePulse 2s infinite' }} />
                          Live
                        </span>
                        <button
                          onClick={() => { openOfferDetail(activeOffer); setView('offers'); }}
                          className="absolute top-[12px] right-[12px] px-[14px] py-[5px] rounded-[999px] text-[14px] font-semibold bg-[var(--card)]/90 text-[var(--ink)] backdrop-blur-sm"
                        >
                          Edit
                        </button>
                      </div>
                      {/* Card body with title + stats */}
                      <div className="px-[16px] py-[12px] bg-[var(--card)]">
                        <p className="text-[20px] font-sans font-extrabold text-[var(--ink)] leading-tight" style={{ letterSpacing: '-0.03em' }}>{activeOffer.generated_title || activeOffer.description}</p>
                        <p className="text-[15px] text-[var(--ink-60)] mt-[3px]">{isUnlimited ? 'Unlimited creators' : `${slotCap} creator${slotCap === 1 ? '' : 's'} per month`} · {slotsUsed} claimed</p>
                      </div>
                      {/* Footer actions */}
                      <div className="flex items-center justify-between px-[16px] py-[12px] bg-[var(--card)] border-t border-[var(--ink-08)]">
                        <button
                          onClick={() => handleToggleOffer(activeOffer.id, activeOffer.is_live)}
                          className="inline-flex items-center gap-[6px] text-[15px] font-medium text-[var(--ink-60)]"
                        >
                          <PauseCircle size={14} strokeWidth={1.5} /> Pause campaign
                        </button>
                        <button
                          onClick={() => { setView('offers'); }}
                          className="inline-flex items-center gap-[6px] text-[15px] font-semibold text-[var(--terra)]"
                        >
                          <RefreshCw size={14} strokeWidth={1.5} /> Change offer
                        </button>
                      </div>
                    </div>
                  );
                })() : (
                  <div className="rounded-[20px] overflow-hidden py-[32px] px-[20px] text-center" style={{ boxShadow: 'var(--shadow-md)' }}>
                    <p className="text-[17px] font-semibold text-[var(--ink-60)]">No active campaign</p>
                    <p className="text-[15px] text-[var(--ink-60)] mt-[4px]">Create your first offer to start getting creator visits</p>
                    <button
                      onClick={() => { setView('offers'); setShowOfferBuilder(true); }}
                      className="mt-[16px] px-[24px] py-[13px] rounded-[999px] text-white text-[15px] font-bold transition-all bg-[var(--terra)]"
                    >
                      Launch a campaign →
                    </button>
                  </div>
                )}
              </div>

              {/* Recent creator activity — vertical list */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-[14px]">
                  <h3 className="text-[20px] font-sans font-extrabold text-[var(--ink)]" style={{ letterSpacing: '-0.03em' }}>Creator activity</h3>
                  {recentActivity.length > 0 && (
                    <button onClick={() => setView('claims')} className="text-[15px] font-semibold text-[var(--terra)]">
                      View all
                    </button>
                  )}
                </div>
                {recentActivity.length === 0 ? (
                  <div className="flex flex-col items-center py-8 px-4">
                    <Sparkles size={40} strokeWidth={1.5} className="text-[var(--ink-60)] mb-3" />
                    <p className="text-[18px] text-[var(--ink-60)] text-center">Your first creator visit will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-[2px]">
                    {recentActivity.slice(0, 5).map(({ claim, count }) => {
                      const activityText = claim.status === 'completed' ? 'Posted a reel' :
                        claim.status === 'reel_due' ? 'Reel due' :
                        claim.status === 'redeemed' ? 'Visited' : 'Claimed offer';
                      return (
                        <button
                          key={claim.id}
                          className="w-full flex items-center gap-[12px] py-[10px] px-[2px] text-left"
                          onClick={() => { setCreatorFilter(claim.creator_id); setClaimsFilter('all'); setView('claims'); }}
                        >
                          {claim.creators.avatar_url ? (
                            <img src={claim.creators.avatar_url} alt="" className="flex-shrink-0" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                          ) : (
                            <div className="flex-shrink-0 flex items-center justify-center" style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--card)' }}>
                              <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 14, color: 'var(--ink-60)' }}>
                                {claim.creators.name?.charAt(0) || '?'}
                              </span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-[16px] font-semibold text-[var(--ink)] truncate">
                              {claim.creators.name}
                              {claim.creators.follower_count && <span className="text-[13px] font-normal text-[var(--ink-60)] ml-[6px]">{claim.creators.follower_count}</span>}
                            </p>
                            <p className="text-[14px] font-normal text-[var(--ink-60)]">{activityText} · <span className="text-[12px] text-[var(--ink-35)]">{timeAgo(claim.claimed_at)}</span>{count > 1 ? ` · ${count} claims` : ''}</p>
                          </div>
                          <ChevronRight size={14} strokeWidth={1.5} className="text-[var(--ink-60)] flex-shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ═══ Also on Nayba ═══ */}
              {nearbyBusinesses.length > 0 && (
                <div className="mt-2">
                  <h3 className="text-[20px] font-sans font-extrabold text-[var(--ink)] mb-[14px]" style={{ letterSpacing: '-0.03em' }}>Also on Nayba</h3>
                  <div className="space-y-[8px]">
                    {nearbyBusinesses.map((biz) => (
                      <button
                        key={biz.id}
                        onClick={() => setExpandedNearbyBiz(biz.id)}
                        className="w-full text-left"
                      >
                        <div className="flex items-center gap-[12px] py-[12px] px-[14px] rounded-[18px] bg-[var(--card)] shadow-[var(--shadow-md)]">
                          <div
                            className="w-[46px] h-[46px] rounded-[12px] flex items-center justify-center flex-shrink-0"
                            style={{ background: 'var(--card)' }}
                          >
                            <CategoryIcon category={biz.category} className="w-[20px] h-[20px]" style={{ color: 'var(--ink-60)' }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[18px] font-bold text-[var(--ink)] truncate">{biz.name}</p>
                            <p className="text-[13px] text-[var(--ink-60)]">
                              {biz.claim_count > 0 ? (
                                <>{biz.creator_count} creator{biz.creator_count !== 1 ? 's' : ''} · {biz.claim_count} claim{biz.claim_count !== 1 ? 's' : ''}{biz.latest_claim_at && <> · {timeAgo(biz.latest_claim_at)}</>}</>
                              ) : (
                                <>{biz.category} · Just joined</>
                              )}
                            </p>
                          </div>
                          <ChevronRight size={16} strokeWidth={1.5} className="text-[var(--ink-60)] flex-shrink-0" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ OFFERS ═══ */}
          {view === 'offers' && (
            <div>
              {selectedOffer ? (
                /* ── Offer detail / edit sub-view (inline editor) ── */
                <>
                  <div className="flex items-center gap-3 mb-5">
                    <button onClick={() => setSelectedOffer(null)} className="p-2 -ml-2 hover:bg-[var(--card)] rounded-[12px] transition-colors">
                      <ChevronLeft size={20} strokeWidth={1.5} className="text-[var(--ink)]" />
                    </button>
                    <h1 className="text-[24px] font-sans font-extrabold text-[var(--ink)]" style={{ letterSpacing: '-0.03em' }}>Edit offer</h1>
                  </div>

                  {/* Hero image with upload */}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    id="editOfferPhotoInput"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file && selectedOffer) await handleOfferPhotoUpload(file, selectedOffer.id);
                      e.target.value = '';
                    }}
                  />
                  <div
                    className="w-full h-[200px] rounded-[18px] overflow-hidden relative mb-[20px] cursor-pointer"
                    style={{ background: getCategorySolidColor(userProfile.category) }}
                    onClick={() => document.getElementById('editOfferPhotoInput')?.click()}
                  >
                    {selectedOffer.offer_photo_url ? (
                      <>
                        <img src={selectedOffer.offer_photo_url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        <div className="absolute inset-0 bg-[var(--ink)]/0 hover:bg-[var(--ink)]/20 transition-colors flex items-center justify-center group">
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity px-[14px] py-[6px] rounded-[999px] text-[14px] font-semibold bg-[var(--card)]/90 text-[var(--ink)] flex items-center gap-[6px]">
                            <Camera size={13} strokeWidth={1.5} /> Change photo
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="px-[16px] py-[8px] rounded-[999px] text-[15px] font-semibold bg-[var(--card)]/90 text-[var(--ink)] flex items-center gap-[6px]">
                          <Camera size={14} strokeWidth={1.5} /> {offerPhotoUploading ? 'Uploading…' : 'Add offer photo'}
                        </span>
                      </div>
                    )}
                    {selectedOffer.is_live ? (
                      <span className="absolute top-[12px] right-[12px] inline-flex items-center gap-[5px] px-[10px] py-[5px] rounded-[999px] text-[14px] font-bold bg-[var(--card)]/90 text-[var(--terra)] backdrop-blur-sm pointer-events-none">
                        <span className="w-[6px] h-[6px] rounded-full bg-[var(--terra)]" style={{ animation: 'livePulse 2s infinite' }} />
                        Live
                      </span>
                    ) : (
                      <span className="absolute top-[12px] right-[12px] px-[10px] py-[5px] rounded-[999px] text-[14px] font-bold bg-[var(--card)]/90 text-[var(--ink-60)] backdrop-blur-sm pointer-events-none">
                        Paused
                      </span>
                    )}
                  </div>

                  {/* Edit fields */}
                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="text-[14px] font-semibold text-[var(--ink)] block mb-1.5">Offer title</label>
                      <input
                        type="text"
                        value={editOfferTitle}
                        onChange={e => { setEditOfferTitle(e.target.value); setEditOfferDirty(true); setEditOfferSaved(false); }}
                        className="w-full px-[16px] py-[14px] rounded-[14px] bg-[var(--card)] border-[1.5px] border-[var(--ink-08)] text-[15px] font-normal text-[var(--ink)] placeholder:text-[var(--ink)]/40 focus:outline-none focus:border-[var(--terra)] focus:ring-3 focus:ring-[var(--terra-ring)]"
                      />
                    </div>
                    <div>
                      <label className="text-[14px] font-semibold text-[var(--ink)] block mb-1.5">Monthly creators</label>
                      <div className="flex items-center gap-[12px]">
                        <input
                          type="number"
                          min={1}
                          value={editOfferCap === null ? '' : editOfferCap}
                          onChange={e => {
                            const v = e.target.value === '' ? null : parseInt(e.target.value);
                            setEditOfferCap(v);
                            setEditOfferDirty(true);
                            setEditOfferSaved(false);
                          }}
                          placeholder="Unlimited"
                          className="flex-1 px-[16px] py-[14px] rounded-[14px] bg-[var(--card)] border-[1.5px] border-[var(--ink-08)] text-[15px] font-normal text-[var(--ink)] placeholder:text-[var(--ink)]/40 focus:outline-none focus:border-[var(--terra)] focus:ring-3 focus:ring-[var(--terra-ring)]"
                        />
                        <span className="text-[14px] text-[var(--ink-60)] flex-shrink-0">{editOfferCap === null ? 'Unlimited' : `${editOfferCap}/mo`}</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-[14px] font-semibold text-[var(--ink)] block mb-1.5">Content ask</label>
                      <textarea
                        value={editOfferAsk}
                        onChange={e => { setEditOfferAsk(e.target.value); setEditOfferDirty(true); setEditOfferSaved(false); }}
                        placeholder="e.g. Show the latte art in a reel"
                        className="w-full px-[16px] py-[14px] rounded-[14px] bg-[var(--card)] border-[1.5px] border-[var(--ink-08)] text-[15px] font-normal text-[var(--ink)] placeholder:text-[var(--ink)]/40 focus:outline-none focus:border-[var(--terra)] focus:ring-3 focus:ring-[var(--terra-ring)] resize-none"
                        style={{ minHeight: '80px' }}
                      />
                    </div>
                  </div>

                  {/* Save button */}
                  <button
                    onClick={handleUpdateOffer}
                    disabled={!editOfferDirty || editOfferSaving}
                    className={`w-full py-[14px] rounded-[999px] font-bold text-[18px] transition-all min-h-[52px] ${
                      editOfferDirty
                        ? 'bg-[var(--terra)] text-white hover:bg-[var(--terra-hover)]'
                        : 'bg-[var(--card)] text-[var(--ink-60)]'
                    }`}
                  >
                    {editOfferSaved ? 'Saved \u2713' : editOfferSaving ? 'Saving...' : 'Save changes'}
                  </button>

                  {/* Pause campaign link */}
                  <button
                    onClick={async () => {
                      if (confirm('Are you sure you want to pause this campaign?')) {
                        await handleToggleOffer(selectedOffer.id, selectedOffer.is_live);
                        setSelectedOffer(prev => prev ? { ...prev, is_live: !prev.is_live } : null);
                      }
                    }}
                    className="block text-[15px] font-medium text-[var(--ink-60)] text-center mt-[16px] mx-auto"
                  >
                    {selectedOffer.is_live ? 'Pause campaign' : 'Resume campaign'}
                  </button>
                </>
              ) : (
                /* ── Campaign view with active offer + history ── */
                <>
                  <h2 className="text-[24px] font-sans font-extrabold text-[var(--ink)] mb-[20px]" style={{ letterSpacing: '-0.03em' }}>Your campaign</h2>

                  {/* Active offer section */}
                  {activeOffer ? (() => {
                    const slotsUsed = activeOffer.slotsUsed || 0;
                    const slotCap = activeOffer.monthly_cap;
                    const isUnlimited = slotCap === null;
                    const progress = isUnlimited ? 0 : Math.min(1, slotsUsed / slotCap);
                    return (
                      <div className="rounded-[20px] overflow-hidden mb-[32px]" style={{ boxShadow: 'var(--shadow-md)' }}>
                        <div className="relative h-[120px]">
                          {activeOffer.offer_photo_url ? (
                            <img
                              src={activeOffer.offer_photo_url} alt="" className="w-full h-full object-cover cursor-pointer"
                              onClick={() => offerPhotoInputRef.current?.click()}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center" style={{ background: getCategorySolidColor(userProfile.category) }}>
                              <button
                                onClick={() => offerPhotoInputRef.current?.click()}
                                disabled={offerPhotoUploading}
                                className="px-[14px] py-[6px] rounded-[999px] text-[14px] font-semibold bg-[var(--card)]/90 text-[var(--ink)] flex items-center gap-[6px]"
                              >
                                <Camera size={13} strokeWidth={1.5} /> {offerPhotoUploading ? 'Uploading…' : 'Add offer photo'}
                              </button>
                            </div>
                          )}
                          <span className="absolute top-[10px] left-[10px] inline-flex items-center gap-[4px] px-[8px] py-[3px] rounded-[999px] text-[12px] font-bold bg-[var(--card)]/90 text-[var(--terra)]">
                            <span className="w-[5px] h-[5px] rounded-full bg-[var(--terra)]" style={{ animation: 'livePulse 2s infinite' }} />
                            Live
                          </span>
                          <button
                            onClick={() => openOfferDetail(activeOffer)}
                            className="absolute top-[10px] right-[10px] px-[14px] py-[5px] rounded-[999px] text-[14px] font-semibold bg-[var(--card)] text-[var(--ink)]"
                          >
                            Edit
                          </button>
                        </div>
                        <div className="px-[16px] py-[14px]">
                          <p className="font-sans text-[var(--ink)]" style={{ fontSize: 18, letterSpacing: '-0.03em' }}>{activeOffer.generated_title || activeOffer.description}</p>
                          <p className="text-[15px] text-[var(--ink-60)] mt-[2px]">{isUnlimited ? 'Unlimited creators' : `${slotCap} creator${slotCap === 1 ? '' : 's'} per month`}</p>
                          <p className="text-[15px] text-[var(--ink-60)] mt-[4px]">{slotsUsed} claimed this month</p>
                          {!isUnlimited && (
                            <div className="mt-[8px] h-[3px] rounded-full" style={{ background: 'var(--terra-10)' }}>
                              <div className="h-full rounded-full" style={{ width: `${progress * 100}%`, background: 'var(--terra)', transition: 'width 300ms ease' }} />
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between px-[16px] py-[12px] border-t border-[var(--ink-08)]">
                          <button
                            onClick={() => handleToggleOffer(activeOffer.id, activeOffer.is_live)}
                            className="inline-flex items-center gap-[6px] text-[15px] font-medium text-[var(--ink-60)]"
                          >
                            <PauseCircle size={14} strokeWidth={1.5} /> Pause campaign
                          </button>
                          <button
                            onClick={() => setShowOfferBuilder(true)}
                            className="inline-flex items-center gap-[6px] text-[15px] font-semibold text-[var(--terra)]"
                          >
                            <RefreshCw size={14} strokeWidth={1.5} /> Change offer
                          </button>
                        </div>
                      </div>
                    );
                  })() : (
                    <div className="rounded-[20px] overflow-hidden py-[32px] px-[20px] text-center mb-[32px]" style={{ boxShadow: 'var(--shadow-md)' }}>
                      <p className="text-[17px] font-semibold text-[var(--ink-60)]">No active campaign</p>
                      <p className="text-[15px] text-[var(--ink-60)] mt-[4px]">Create your first offer</p>
                      <button
                        onClick={() => setShowOfferBuilder(true)}
                        className="mt-[16px] px-[24px] py-[12px] rounded-[999px] text-white text-[18px] font-bold transition-all"
                        style={{ background: 'var(--terra)' }}
                      >
                        Launch a campaign →
                      </button>
                    </div>
                  )}

                  {/* Campaign history */}
                  <h3 className="text-[20px] font-sans font-extrabold text-[var(--ink)] mb-[14px]" style={{ letterSpacing: '-0.03em' }}>Past campaigns</h3>
                  {offers.filter(o => !o.is_live && o !== activeOffer).length === 0 ? (
                    <p className="text-[18px] text-[var(--ink-60)] text-center py-[24px]">Your campaign history will appear here</p>
                  ) : (
                    <div className="space-y-[10px]">
                      {offers.filter(o => !o.is_live && o !== activeOffer).map(offer => {
                        const offerClaims = claims.filter(c => c.offer_id === offer.id);
                        const completedReels = offerClaims.filter(c => c.reel_url).length;
                        const createdDate = new Date(offer.created_at);
                        return (
                          <div key={offer.id} className="rounded-[18px] p-[14px] flex items-center gap-[12px]" style={{ paddingRight: 16 }}>
                            <div
                              className="w-[46px] h-[46px] rounded-[12px] flex items-center justify-center flex-shrink-0"
                              style={{ background: 'var(--card)' }}
                            >
                              <CategoryIcon category={userProfile.category} className="w-[20px] h-[20px]" style={{ color: 'var(--ink-60)' }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-sans text-[var(--ink)] truncate" style={{ fontSize: 16, letterSpacing: '-0.03em' }}>{offer.generated_title || offer.description}</p>
                              <p className="text-[14px] text-[var(--ink-60)]">
                                {createdDate.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                              </p>
                              <p className="text-[14px] text-[var(--ink-60)]">
                                {offerClaims.length} creator visit{offerClaims.length !== 1 ? 's' : ''} · {completedReels} reel{completedReels !== 1 ? 's' : ''} posted
                              </p>
                            </div>
                            <button
                              onClick={() => {
                                // Pre-fill the builder with this offer's data and open it
                                setShowOfferBuilder(true);
                              }}
                              className="text-[14px] font-semibold text-[var(--terra)] flex-shrink-0"
                            >
                              Run again
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
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
                      <CheckCircle size={64} strokeWidth={1.5} className="text-[var(--terra)] mb-4" />
                      {scanResult.creatorName && (
                        <p className="text-[22px] font-sans font-extrabold text-[var(--ink)] mb-1" style={{ letterSpacing: '-0.03em' }}>{scanResult.creatorName}</p>
                      )}
                      <p className="text-[18px] font-medium text-[var(--ink-60)] mb-1">Visit confirmed</p>
                      <p className="text-[14px] text-[var(--ink-60)] mb-6">{new Date().toLocaleString()}</p>
                      <button
                        onClick={() => setScanResult(null)}
                        className="px-[28px] py-[13px] rounded-[999px] bg-[var(--terra)] text-white font-bold text-[15px] hover:bg-[var(--terra-hover)] transition-all min-h-[48px]"
                      >
                        Done
                      </button>
                    </>
                  ) : (
                    <>
                      <X size={48} strokeWidth={1.5} className="text-[var(--ochre)] mb-4" />
                      <p className="text-[18px] font-bold text-[var(--ink)] mb-1 text-center">{scanResult.message}</p>
                      <button
                        onClick={() => setScanResult(null)}
                        className="mt-4 px-[28px] py-[13px] rounded-[999px] bg-transparent border-[1.5px] border-[var(--ink-15)] text-[var(--ink)] font-semibold text-[14px] hover:bg-[var(--ink-08)] transition-all min-h-[44px]"
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
                    <div className="w-[72px] h-[72px] rounded-full flex items-center justify-center mb-4" style={{ background: 'var(--card)' }}>
                      <QrCode size={32} strokeWidth={1.5} className="text-[var(--terra)]" />
                    </div>
                    <h2 className="text-[24px] font-sans font-extrabold text-[var(--ink)] mb-1" style={{ letterSpacing: '-0.03em' }}>Scan creator pass</h2>
                    <p className="text-[18px] text-[var(--ink-60)] text-center">Ask the creator to open their Active tab<br />and show their QR code</p>
                  </div>

                  <QRScanner
                    onScan={(token) => { setScanCode(token); verifyToken(token); }}
                    active={view === 'scan' && !scanResult}
                  />

                  <div className="mt-6 mb-4 relative">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[var(--ink-08)]" /></div>
                    <div className="relative flex justify-center"><span className="bg-[var(--shell)] px-3 text-[14px] text-[var(--ink-60)]">or enter code manually</span></div>
                  </div>

                  <form onSubmit={handleScanCode} className="space-y-3" style={{ maxWidth: 280, margin: '0 auto' }}>
                    <input
                      type="text"
                      value={scanCode}
                      onChange={(e) => { setScanCode(e.target.value); setScanResult(null); }}
                      placeholder="e.g. SOPHIE101"
                      className="w-full px-[16px] py-[14px] rounded-[14px] bg-[var(--card)] border-[1.5px] border-[var(--ink-08)] text-[15px] font-normal text-[var(--ink)] placeholder:text-[var(--ink)]/40 focus:outline-none focus:border-[var(--terra)] focus:ring-3 focus:ring-[var(--terra-ring)] min-h-[52px]"
                      required
                    />
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-[13px] px-[24px] rounded-[999px] font-bold text-[15px] transition-all min-h-[48px] bg-[var(--terra)] text-white hover:bg-[var(--terra-hover)] disabled:opacity-50"
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
              {/* Header row */}
              <div className="flex items-baseline justify-between mb-[16px]">
                <h2 className="text-[24px] font-sans font-extrabold text-[var(--ink)]" style={{ letterSpacing: '-0.03em' }}>Claims</h2>
                {creatorFilter ? (
                  <button
                    onClick={() => setCreatorFilter(null)}
                    className="inline-flex items-center gap-1 text-[15px] font-semibold text-[var(--terra)]"
                  >
                    {claims.find(c => c.creator_id === creatorFilter)?.creators?.name || 'Creator'}
                    <X size={12} strokeWidth={1.5} className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={() => setClaimsSubView(claimsSubView === 'claims' ? 'content' : 'claims')}
                    className={`text-[15px] font-semibold ${claimsSubView === 'content' ? 'text-[var(--ink)] underline underline-offset-4' : 'text-[var(--ink-60)]'}`}
                  >
                    {claimsSubView === 'claims' ? 'View reels' : 'View claims'}
                  </button>
                )}
              </div>

              {/* Filter pills */}
              <div className="flex gap-[6px] mb-[20px]">
                {[
                  { key: 'all', label: 'All' },
                  { key: 'active', label: 'Active' },
                  { key: 'redeemed', label: 'Visited' },
                  { key: 'reel_due', label: 'Reel due' },
                  { key: 'completed', label: 'Done' },
                ].map(f => {
                  const count = filterCounts[f.key] || 0;
                  const isSelected = claimsFilter === f.key;
                  return (
                    <button
                      type="button"
                      key={f.key}
                      onClick={() => setClaimsFilter(f.key)}
                      className={`px-[10px] py-[6px] rounded-[999px] text-[14px] font-semibold whitespace-nowrap ${
                        isSelected
                          ? 'bg-[var(--terra)] text-white'
                          : 'bg-[var(--card)] text-[var(--ink-60)]'
                      }`}
                    >
                      {f.label}{count > 0 ? ` ${count}` : ''}
                    </button>
                  );
                })}
              </div>

              {/* Claims list */}
              {claimsSubView === 'claims' && (
                <div key={claimsFilter}>
                  {filteredClaims.length === 0 && claims.length === 0 ? (
                    <div className="flex flex-col items-center py-20 px-6">
                      <div className="w-[56px] h-[56px] rounded-full bg-[var(--card)] flex items-center justify-center mb-[16px]">
                        <ClipboardList size={24} strokeWidth={1.5} className="text-[var(--ink-60)]" />
                      </div>
                      <p className="text-[17px] font-bold text-[var(--ink)] mb-[4px]">No claims yet</p>
                      <p className="text-[15px] text-[var(--ink-60)] text-center">Creators will appear here once they claim your offers</p>
                    </div>
                  ) : filteredClaims.length === 0 ? (
                    <div className="flex flex-col items-center py-16 px-6">
                      <p className="text-[18px] text-[var(--ink-60)]">No {claimsFilter.replace('_', ' ')} claims</p>
                    </div>
                  ) : (
                    <div className="space-y-[2px]">
                      {filteredClaims.map((claim) => {
                        const handle = claim.creators.instagram_handle || claim.creators.code;
                        const displayHandle = handle.startsWith('@') ? handle : `@${handle}`;
                        return (
                        <div
                          key={claim.id}
                          className="flex items-center gap-[14px] py-[14px] border-b border-[var(--ink-08)] last:border-b-0"
                        >
                          {/* Avatar */}
                          <div
                            className="w-[40px] h-[40px] rounded-[12px] flex items-center justify-center flex-shrink-0"
                            style={{ background: 'var(--card)' }}
                          >
                            <CategoryIcon category={userProfile.category} className="w-[20px] h-[20px]" style={{ color: 'var(--ink-60)' }} />
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-[6px]">
                              <p className="text-[17px] font-bold text-[var(--ink)] truncate">{claim.creators.name}</p>
                              <span className="text-[12px] font-normal text-[var(--ink-35)] flex-shrink-0">{timeAgo(claim.claimed_at)}</span>
                            </div>
                            <p className="text-[15px] text-[var(--ink-60)] truncate mt-[1px]">
                              {claim.offers?.generated_title || claim.offers?.description}
                            </p>
                          </div>

                          {/* Right side: action or status */}
                          <div className="flex-shrink-0">
                            {claim.status === 'active' ? (
                              <button
                                onClick={() => { setView('scan'); setScanResult(null); }}
                                className="flex items-center gap-[5px] px-[14px] py-[8px] rounded-[999px] bg-[var(--terra)] text-white text-[15px] font-semibold hover:bg-[var(--terra-hover)] transition-colors"
                              >
                                <ScanLine size={14} strokeWidth={1.5} /> Scan
                              </button>
                            ) : claim.status === 'completed' && claim.reel_url ? (
                              <a href={claim.reel_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-[5px] px-[14px] py-[8px] rounded-[999px] bg-[var(--card)] text-[15px] font-semibold text-[var(--ink)] hover:bg-[var(--ink-08)] transition-colors">
                                <Clapperboard size={14} strokeWidth={1.5} /> Reel
                              </a>
                            ) : (
                              <span className={`text-[11px] font-bold px-[10px] py-[3px] rounded-[999px] ${claimStatusStyle(claim.status)}`}>
                                {claimStatusLabel(claim.status)}
                              </span>
                            )}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Content sub-view */}
              {claimsSubView === 'content' && (
                <>
                  {claims.filter(c => c.reel_url).length === 0 ? (
                    <div className="flex flex-col items-center py-16 px-6">
                      <Clapperboard size={48} strokeWidth={1.5} className="text-[var(--ink-60)] mb-4" />
                      <p className="text-[18px] font-bold text-[var(--ink)] mb-1">No content yet</p>
                      <p className="text-[18px] text-[var(--ink-60)] text-center max-w-[260px]">Reels will appear here once creators post and submit their links</p>
                    </div>
                  ) : (
                    <div className="space-y-[12px]">
                      {claims.filter(c => c.reel_url).map((claim, idx) => (
                        <div key={claim.id} className="rounded-[18px] shadow-[var(--shadow-md)] p-[16px]" style={{ background: getCardColor(idx) }}>
                          <div className="flex items-start gap-[12px]">
                            <div
                              className="w-[46px] h-[46px] rounded-[12px] flex items-center justify-center flex-shrink-0"
                              style={{ background: 'var(--card)' }}
                            >
                              <CategoryIcon category={userProfile.category} className="w-[20px] h-[20px]" style={{ color: 'var(--ink-60)' }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[17px] font-bold text-[var(--ink)]">{claim.creators.name}</p>
                              <p className="font-sans text-[var(--ink)] mt-[4px]" style={{ fontSize: 16, letterSpacing: '-0.03em' }}>
                                {claim.offers?.generated_title || claim.offers?.description || 'Offer'}
                              </p>
                              <p className="text-[12px] font-normal text-[var(--ink-35)] mt-[4px]">{timeAgo(claim.claimed_at)}</p>
                              <a
                                href={claim.reel_url!}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-[6px] mt-[10px] px-[14px] py-[8px] rounded-[999px] bg-[var(--card)] text-[15px] font-semibold text-[var(--terra)] hover:bg-[var(--ink-08)] transition-colors"
                              >
                                <Clapperboard size={14} strokeWidth={1.5} /> View reel <ExternalLink size={12} strokeWidth={1.5} className="text-[var(--ink-60)]" />
                              </a>
                            </div>
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
              <h2 className="text-[24px] font-sans font-extrabold text-[var(--ink)] mb-5" style={{ letterSpacing: '-0.03em' }}>Alerts</h2>

              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-[40px]">
                  {/* Bell with lightning bolt SVG */}
                  <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                    <path d="M40 12C28 12 20 22 20 32V48L14 56H66L60 48V32C60 22 52 12 40 12Z" stroke="var(--peach)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    <path d="M32 56C32 60.4 35.6 64 40 64C44.4 64 48 60.4 48 56" stroke="var(--peach)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                    <path d="M62 20L58 28H64L60 36" stroke="var(--peach)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                  <p className="text-[20px] font-sans font-extrabold text-[var(--ink)] mt-[16px]" style={{ letterSpacing: '-0.03em' }}>No alerts yet</p>
                  <p className="text-[17px] text-[var(--ink-60)] text-center mt-[8px] max-w-[260px]" style={{ lineHeight: 1.65 }}>
                    When a creator claims your offer and visits, you'll see it here instantly.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notifications.map((notif, idx) => (
                    <button
                      key={notif.id}
                      onClick={() => !notif.read && markNotificationRead(notif.id)}
                      className={`w-full text-left rounded-[18px] p-4 shadow-[var(--shadow-md)] transition-all ${
                        notif.read ? 'opacity-50' : ''
                      }`}
                      style={{ background: notif.read ? getCardColor(idx) : 'var(--terra-5, var(--terra-5))' }}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${notif.read ? 'bg-[var(--ink-08)]' : 'bg-[var(--terra)]'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[18px] text-[var(--ink)]">{notif.message}</p>
                          <p className="text-[12px] font-normal text-[var(--ink-35)] mt-1">{new Date(notif.created_at).toLocaleDateString()}</p>
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
            <div className="pt-4">
              {isPendingApproval && (
                <div className="mx-[20px] mb-6 rounded-[18px] p-5 text-center" style={{ background: 'linear-gradient(135deg, var(--terra-10), rgba(200,184,240,0.12))' }}>
                  <Clock size={28} strokeWidth={1.5} className="text-[var(--terra)] mx-auto mb-2.5" />
                  <h3 className="text-[19px] font-bold text-[var(--ink)] mb-1">Account Under Review</h3>
                  <p className="text-[15px] text-[var(--ink-60)] leading-[1.5]">We're reviewing your business — you'll get an email once approved. In the meantime, make sure your profile is complete!</p>
                </div>
              )}
              {profileSubView === 'main' ? (
                <>
                  {/* ═══ Profile card (Airbnb-style) ═══ */}
                  <div className="rounded-[18px] p-[24px] mb-[24px]" style={{ border: '1px solid var(--ink-08)' }}>
                    <div className="flex items-start gap-[16px]">
                      {/* Logo */}
                      <div className="relative flex-shrink-0">
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
                        {logoUploading ? (
                          <div className="w-[80px] h-[80px] rounded-[16px] bg-[var(--card)] flex items-center justify-center" style={{ border: '2px solid var(--ink-08)' }}>
                            <div className="w-6 h-6 border-2 border-[var(--terra)] border-t-transparent rounded-full animate-spin" />
                          </div>
                        ) : logoUrl ? (
                          <button onClick={() => logoInputRef.current?.click()}>
                            <img src={logoUrl} alt={userProfile.name} className="w-[80px] h-[80px] rounded-[16px] object-cover" style={{ border: '2px solid var(--ink-08)' }} />
                          </button>
                        ) : (
                          <button
                            onClick={() => logoInputRef.current?.click()}
                            className="w-[80px] h-[80px] rounded-[16px] flex items-center justify-center"
                            style={{ background: getCategorySolidColor(userProfile.category) }}
                          >
                            <span className="text-white text-[28px] font-extrabold">{getInitials(userProfile.name)}</span>
                          </button>
                        )}
                        <button
                          onClick={() => logoInputRef.current?.click()}
                          className="absolute -bottom-1 -right-1 w-[24px] h-[24px] rounded-full bg-[var(--terra)] flex items-center justify-center border-2 border-white"
                        >
                          <Camera size={11} strokeWidth={1.5} className="text-white" />
                        </button>
                      </div>

                      {/* Name + meta */}
                      <div className="flex-1 min-w-0 pt-[2px]">
                        <h2 className="text-[22px] font-sans font-extrabold text-[var(--ink)] leading-tight" style={{ letterSpacing: '-0.03em' }}>{userProfile.name}</h2>
                        <div className="flex items-center gap-[6px] mt-[4px] flex-wrap">
                          <span className="inline-block bg-[var(--card)] text-[var(--ink-60)] text-[13px] font-bold rounded-full px-[10px] py-[3px]">
                            {userProfile.category}
                          </span>
                          {userProfile.approved && (
                            <span className="flex items-center gap-[3px] text-[13px] font-semibold text-[var(--terra)]">
                              <BadgeCheck size={13} strokeWidth={1.5} /> Verified
                            </span>
                          )}
                        </div>
                        {userProfile.address && (
                          <div className="flex items-start gap-[6px] mt-[6px]">
                            <MapPin size={13} strokeWidth={1.5} className="text-[var(--ink-60)] flex-shrink-0 mt-[1px]" />
                            <button
                              onClick={() => { navigator.clipboard.writeText(userProfile.address || ''); setCopiedCode(true); setTimeout(() => setCopiedCode(false), 1500); }}
                              className="text-[14px] text-[var(--ink-60)] text-left leading-[1.4]"
                            >
                              {userProfile.address}
                            </button>
                            <button
                              onClick={() => { navigator.clipboard.writeText(userProfile.address || ''); setCopiedCode(true); setTimeout(() => setCopiedCode(false), 1500); }}
                              className="flex-shrink-0 mt-[1px]"
                            >
                              {copiedCode ? (
                                <span className="text-[var(--terra)] text-[13px] font-semibold">Copied!</span>
                              ) : (
                                <Copy size={12} strokeWidth={1.5} className="text-[var(--ink-60)]" />
                              )}
                            </button>
                          </div>
                        )}
                        <div className="flex items-center gap-[10px] mt-[4px]">
                          {userProfile.instagram_handle && (
                            <span className="flex items-center gap-1 text-[14px] text-[var(--ink-60)]">
                              <AtSign size={12} strokeWidth={1.5} /> {userProfile.instagram_handle}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {logoError && <p className="text-[15px] text-[var(--terra)] mt-2">{logoError}</p>}

                    {/* Stats row inside card */}
                    <div className="flex items-center mt-[20px] pt-[16px] border-t border-[var(--ink-08)]">
                      <div className="flex-1 text-center">
                        <p className="text-[24px] font-sans font-extrabold text-[var(--ink)]">{offers.filter(o => o.is_live).length}</p>
                        <p className="text-[13px] text-[var(--ink-60)] font-semibold">Live offers</p>
                      </div>
                      <div className="w-[1px] h-[32px] bg-[var(--ink-08)]" />
                      <div className="flex-1 text-center">
                        <p className="text-[24px] font-sans font-extrabold text-[var(--ink)]">{claims.length}</p>
                        <p className="text-[13px] text-[var(--ink-60)] font-semibold">Claims</p>
                      </div>
                      <div className="w-[1px] h-[32px] bg-[var(--ink-08)]" />
                      <div className="flex-1 text-center">
                        <p className="text-[24px] font-sans font-extrabold text-[var(--ink)]">{claims.filter(c => c.status === 'completed').length}</p>
                        <p className="text-[13px] text-[var(--ink-60)] font-semibold">Collabs</p>
                      </div>
                    </div>
                  </div>

                  {/* ═══ About card ═══ */}
                  {userProfile.bio && (
                    <div className="rounded-[18px] p-[16px] mb-[16px]">
                      <h3 className="text-[18px] font-sans font-extrabold text-[var(--ink)] mb-[8px]" style={{ letterSpacing: '-0.03em' }}>About</h3>
                      <p className="text-[18px] text-[var(--ink-60)] leading-[1.5]">{userProfile.bio}</p>
                    </div>
                  )}

                  {/* ═══ Settings ═══ */}
                  <div className="mt-[8px]">
                    <button
                      onClick={() => setProfileSubView('edit')}
                      className="w-full flex items-center justify-between py-[16px] border-b border-[var(--ink-08)] text-left"
                    >
                      <div className="flex items-center gap-[12px]">
                        <User size={20} strokeWidth={1.5} className="text-[var(--ink-60)]" />
                        <span className="text-[17px] font-semibold text-[var(--ink)]">Edit profile</span>
                      </div>
                      <ChevronRight size={18} strokeWidth={1.5} className="text-[var(--ink-60)]" />
                    </button>
                    <button
                      onClick={() => setView('notifications')}
                      className="w-full flex items-center justify-between py-[16px] border-b border-[var(--ink-08)] text-left"
                    >
                      <div className="flex items-center gap-[12px]">
                        <Bell size={20} strokeWidth={1.5} className="text-[var(--ink-60)]" />
                        <span className="text-[17px] font-semibold text-[var(--ink)]">Notifications</span>
                      </div>
                      <ChevronRight size={18} strokeWidth={1.5} className="text-[var(--ink-60)]" />
                    </button>
                    <button
                      onClick={signOut}
                      className="w-full flex items-center gap-[12px] py-[16px] text-left"
                    >
                      <LogOut size={20} strokeWidth={1.5} className="text-[var(--terra)]" />
                      <span className="text-[17px] font-semibold text-[var(--terra)]">Sign out</span>
                    </button>
                  </div>
                </>
              ) : (
                /* Edit profile sub-view */
                <>
                  <div className="flex items-center gap-3 mb-5">
                    <button onClick={() => setProfileSubView('main')} className="p-2 -ml-2 hover:bg-[var(--card)] rounded-[12px] transition-colors">
                      <ChevronLeft size={20} strokeWidth={1.5} className="text-[var(--ink)]" />
                    </button>
                    <h1 className="text-[28px] font-sans font-extrabold text-[var(--ink)]" style={{ letterSpacing: '-0.03em' }}>Edit profile</h1>
                  </div>

                  {/* Edit fields */}
                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="text-[14px] font-semibold text-[var(--ink)] block mb-1.5">Business name</label>
                      <input
                        type="text"
                        value={profileName}
                        onChange={e => { setProfileName(e.target.value); setProfileDirty(true); setProfileSaved(false); }}
                        className="w-full px-[16px] py-[14px] rounded-[14px] bg-[var(--card)] border-[1.5px] border-[var(--ink-08)] text-[15px] font-normal text-[var(--ink)] placeholder:text-[var(--ink)]/40 focus:outline-none focus:border-[var(--terra)] focus:ring-3 focus:ring-[var(--terra-ring)]"
                      />
                    </div>
                    <div>
                      <label className="text-[14px] font-semibold text-[var(--ink)] block mb-1.5">Address / location</label>
                      <input
                        type="text"
                        value={profileAddress}
                        onChange={e => { setProfileAddress(e.target.value); setProfileDirty(true); setProfileSaved(false); }}
                        className="w-full px-[16px] py-[14px] rounded-[14px] bg-[var(--card)] border-[1.5px] border-[var(--ink-08)] text-[15px] font-normal text-[var(--ink)] placeholder:text-[var(--ink)]/40 focus:outline-none focus:border-[var(--terra)] focus:ring-3 focus:ring-[var(--terra-ring)]"
                      />
                    </div>
                    <div>
                      <label className="text-[14px] font-semibold text-[var(--ink)] block mb-1.5">Instagram handle</label>
                      <input
                        type="text"
                        value={profileInstagram}
                        onChange={e => { setProfileInstagram(e.target.value); setProfileDirty(true); setProfileSaved(false); }}
                        placeholder="@yourbusiness"
                        className="w-full px-[16px] py-[14px] rounded-[14px] bg-[var(--card)] border-[1.5px] border-[var(--ink-08)] text-[15px] font-normal text-[var(--ink)] placeholder:text-[var(--ink)]/40 focus:outline-none focus:border-[var(--terra)] focus:ring-3 focus:ring-[var(--terra-ring)]"
                      />
                    </div>
                    <div>
                      <label className="text-[14px] font-semibold text-[var(--ink)] block mb-1.5">Short bio</label>
                      <textarea
                        value={profileBio}
                        onChange={e => { setProfileBio(e.target.value.slice(0, 120)); setProfileDirty(true); setProfileSaved(false); }}
                        placeholder="Tell creators what makes your business special"
                        className="w-full px-[16px] py-[14px] rounded-[14px] bg-[var(--card)] border-[1.5px] border-[var(--ink-08)] text-[15px] font-normal text-[var(--ink)] placeholder:text-[var(--ink)]/40 focus:outline-none focus:border-[var(--terra)] focus:ring-3 focus:ring-[var(--terra-ring)] resize-none"
                        style={{ minHeight: '80px' }}
                      />
                      <p className="text-[13px] text-[var(--ink-60)] text-right mt-1">{profileBio.length}/120</p>
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
                    className={`w-full py-[14px] rounded-[999px] font-bold text-[18px] transition-all min-h-[52px] ${
                      profileDirty
                        ? 'bg-[var(--terra)] text-white hover:bg-[var(--terra-hover)]'
                        : 'bg-[var(--card)] text-[var(--ink-60)]'
                    }`}
                  >
                    {profileSaved ? 'Saved \u2713' : profileSaving ? 'Saving...' : 'Save changes'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      </div>{/* end scroll container */}

      {/* ═══ Bottom Nav ═══ */}
      <nav
        style={{
          background: 'rgba(246,243,238,0.96)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid var(--ink-08)', padding: '8px 0', paddingBottom: 'env(safe-area-inset-bottom, 24px)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', flexShrink: 0,
        }}
      >
        {bottomTabs.map((tab) => {
          const isActive = view === tab.key;
          if (tab.key === 'scan') {
            return (
              <div key={tab.key} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <button
                  onClick={() => { if (isPendingApproval) return; setView('scan'); setScanResult(null); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 999,
                    background: isPendingApproval ? 'var(--ink-15)' : 'var(--terra)', border: 'none', cursor: 'pointer',
                    boxShadow: isPendingApproval ? 'none' : 'var(--shadow-md)',
                  }}
                >
                  <QrCode size={18} strokeWidth={1.5} color="white" />
                  <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 13, color: 'white' }}>Scan</span>
                </button>
              </div>
            );
          }

          const isDisabled = isPendingApproval && tab.key !== 'profile';
          const iconColor = isDisabled ? 'var(--ink-15)' : isActive ? 'var(--terra)' : 'var(--ink-35)';
          return (
            <button
              key={tab.key}
              onClick={() => { if (isDisabled) return; setView(tab.key); if (tab.key === 'claims') setCreatorFilter(null); if (tab.key !== 'offers') setSelectedOffer(null); }}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                background: 'none', border: 'none', cursor: isDisabled ? 'default' : 'pointer',
                fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: isActive ? 600 : 500, fontSize: 10,
                color: iconColor,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24 }}>
                {tab.icon === 'dashboard' && <LayoutGrid size={20} strokeWidth={1.5} color={iconColor} />}
                {tab.icon === 'megaphone' && <Megaphone size={20} strokeWidth={1.5} color={iconColor} />}
                {tab.icon === 'scan' && <ScanLine size={20} strokeWidth={1.5} color={iconColor} />}
                {tab.icon === 'doc' && <FileText size={20} strokeWidth={1.5} color={iconColor} />}
                {tab.icon === 'user' && <User size={20} strokeWidth={1.5} color={iconColor} />}
              </div>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
      <FeedbackButton
        userId={userProfile.id}
        userType="business"
        displayName={userProfile.name}
        currentPage={view}
      />
    </div>
  );
}
