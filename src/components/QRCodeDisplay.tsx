import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import QRCode from 'qrcode';
import { RefreshCw, Shield } from 'lucide-react';

interface QRCodeDisplayProps {
  token: string;
  claimId: string;
  creatorCode: string;
}

function generateSecureToken(): string {
  return crypto.randomUUID() + '-' + crypto.randomUUID();
}

export default function QRCodeDisplay({ token, claimId, creatorCode }: QRCodeDisplayProps) {
  const [currentToken, setCurrentToken] = useState(token);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState(30);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const claimIdRef = useRef(claimId);

  claimIdRef.current = claimId;

  // Generate real QR code whenever token changes
  useEffect(() => {
    QRCode.toDataURL(currentToken, {
      width: 280,
      margin: 2,
      color: { dark: '#1a1025', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    }).then(setQrDataUrl).catch(() => {});
  }, [currentToken]);

  const refreshToken = useCallback(async () => {
    setIsRefreshing(true);
    const newToken = generateSecureToken();
    const qrExpiresAt = new Date(Date.now() + 30000).toISOString();

    const { error } = await supabase
      .from('claims')
      .update({ qr_token: newToken, qr_expires_at: qrExpiresAt })
      .eq('id', claimIdRef.current);

    if (!error) {
      setCurrentToken(newToken);
    }
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          refreshToken();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [refreshToken]);

  const progressPercent = (timeLeft / 30) * 100;
  const isUrgent = timeLeft <= 5;

  return (
    <div className="text-center">
      {/* QR code — clean, no overlapping elements */}
      <div className="inline-block bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt="QR Code"
            className="w-56 h-56 mx-auto"
          />
        ) : (
          <div className="w-56 h-56 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-gray-200 border-t-[#5b3df5] rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Creator code badge */}
      <div className="mt-4">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-50 border border-gray-100">
          <Shield className="w-4 h-4 text-[#5b3df5]" />
          <span className="font-mono font-bold text-lg tracking-wider text-[#1a1025]">
            {creatorCode}
          </span>
        </div>
      </div>

      {/* Countdown progress bar — below the QR, never overlapping */}
      <div className="mt-3 max-w-[280px] mx-auto">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-[#5b3df5]' : 'text-gray-400'}`} />
            <span className={`text-xs font-medium ${isUrgent ? 'text-rose-500' : 'text-gray-500'}`}>
              Refreshes in {timeLeft}s
            </span>
          </div>
        </div>
        <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ease-linear ${
              isUrgent ? 'bg-rose-400' : 'bg-[#5b3df5]'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
