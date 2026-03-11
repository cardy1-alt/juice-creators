import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface QRCodeDisplayProps {
  token: string;
  creatorCode: string;
}

export default function QRCodeDisplay({ token, creatorCode }: QRCodeDisplayProps) {
  const [currentToken, setCurrentToken] = useState(token);
  const [timeLeft, setTimeLeft] = useState(30);

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
  }, []);

  const refreshToken = async () => {
    const newToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const qrExpiresAt = new Date(Date.now() + 30000).toISOString();

    const { data } = await supabase
      .from('claims')
      .select('id')
      .eq('qr_token', currentToken)
      .maybeSingle();

    if (data) {
      await supabase
        .from('claims')
        .update({
          qr_token: newToken,
          qr_expires_at: qrExpiresAt
        })
        .eq('id', data.id);

      setCurrentToken(newToken);
    }
  };

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(currentToken)}`;

  return (
    <div className="text-center">
      <div className="bg-white p-6 rounded-2xl inline-block shadow-lg border-4" style={{ borderColor: '#5b3df5' }}>
        <img
          src={qrCodeUrl}
          alt="QR Code"
          className="w-64 h-64 mx-auto"
        />
      </div>
      <div className="mt-4">
        <p className="text-2xl font-bold mb-1" style={{ color: '#1a1025' }}>
          {creatorCode}
        </p>
        <p className="text-sm text-gray-500">
          Refreshes in {timeLeft}s
        </p>
      </div>
    </div>
  );
}
