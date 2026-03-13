import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { RefreshCw, Shield } from 'lucide-react';

interface QRCodeDisplayProps {
  token: string;
  claimId: string;
  creatorCode: string;
}

function generateSecureToken(): string {
  return crypto.randomUUID() + '-' + crypto.randomUUID();
}

// ─── Minimal QR Code encoder (Model 2, byte mode, ECC-L) ─────────────────
// Produces a valid, scannable QR code as a Canvas data URL.
// Supports up to ~154 bytes at version 6 with low ECC.

function generateQRDataUrl(text: string, size: number = 280): string {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  const modules = encodeQR(text);
  const n = modules.length;
  const margin = 4;
  const cellSize = size / (n + margin * 2);

  ctx.fillStyle = '#1A3C34';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (modules[r][c]) {
        ctx.fillRect(
          Math.round((c + margin) * cellSize),
          Math.round((r + margin) * cellSize),
          Math.ceil(cellSize),
          Math.ceil(cellSize)
        );
      }
    }
  }

  return canvas.toDataURL('image/png');
}

// Reed-Solomon GF(256) with polynomial 0x11d
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x = x * 2 ^ (x >= 128 ? 0x11d : 0);
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a: number, b: number): number {
  return a === 0 || b === 0 ? 0 : GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGenPoly(nsym: number): number[] {
  let g = [1];
  for (let i = 0; i < nsym; i++) {
    const ng = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      ng[j] ^= g[j];
      ng[j + 1] ^= gfMul(g[j], GF_EXP[i]);
    }
    g = ng;
  }
  return g;
}

function rsEncode(data: number[], nsym: number): number[] {
  const gen = rsGenPoly(nsym);
  const res = new Array(data.length + nsym).fill(0);
  for (let i = 0; i < data.length; i++) res[i] = data[i];
  for (let i = 0; i < data.length; i++) {
    const coef = res[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        res[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  return res.slice(data.length);
}

// Version info: [version, size, dataCodewords, eccCodewords, numBlocks]
// Using ECC level L for maximum data capacity
const VERSION_TABLE: [number, number, number, number, number][] = [
  [1, 21, 19, 7, 1],
  [2, 25, 34, 10, 1],
  [3, 29, 55, 15, 1],
  [4, 33, 80, 20, 1],
  [5, 37, 108, 26, 1],
  [6, 41, 136, 18, 2],
  [7, 45, 156, 20, 2],
  [8, 49, 192, 24, 2],
  [9, 53, 224, 30, 2],
  [10, 57, 274, 18, 4],
];

function encodeQR(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  const len = bytes.length;

  // Pick smallest version that fits
  let ver = 1, qrSize = 21, totalData = 19, eccPerBlock = 7, numBlocks = 1;
  for (const [v, s, d, e, b] of VERSION_TABLE) {
    // Byte mode overhead: 4 (mode) + 8 or 16 (length) bits
    const lengthBits = v >= 10 ? 16 : 8;
    const overhead = Math.ceil((4 + lengthBits) / 8);
    if (len + overhead <= d) {
      ver = v; qrSize = s; totalData = d; eccPerBlock = e; numBlocks = b;
      break;
    }
  }

  // Build data stream
  const lengthBits = ver >= 10 ? 16 : 8;
  const bits: number[] = [];
  const pushBits = (val: number, count: number) => {
    for (let i = count - 1; i >= 0; i--) bits.push((val >> i) & 1);
  };

  pushBits(0b0100, 4); // Byte mode indicator
  pushBits(len, lengthBits);
  for (const b of bytes) pushBits(b, 8);
  pushBits(0, 4); // Terminator (up to 4 bits)

  // Pad to byte boundary
  while (bits.length % 8 !== 0) bits.push(0);

  // Convert to bytes
  const dataBytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    dataBytes.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  }

  // Pad with alternating 0xec, 0x11
  let padIdx = 0;
  while (dataBytes.length < totalData) {
    dataBytes.push(padIdx % 2 === 0 ? 0xec : 0x11);
    padIdx++;
  }

  // Split into blocks and compute ECC
  const dataPerBlock = Math.floor(totalData / numBlocks);
  const extraBlocks = totalData % numBlocks;
  const allData: number[][] = [];
  const allEcc: number[][] = [];
  let offset = 0;
  for (let i = 0; i < numBlocks; i++) {
    const blockLen = dataPerBlock + (i >= numBlocks - extraBlocks ? 1 : 0);
    const blockData = dataBytes.slice(offset, offset + blockLen);
    offset += blockLen;
    allData.push(blockData);
    allEcc.push(rsEncode(blockData, eccPerBlock));
  }

  // Interleave data and ECC
  const interleaved: number[] = [];
  const maxDataLen = Math.max(...allData.map(d => d.length));
  for (let i = 0; i < maxDataLen; i++) {
    for (const block of allData) {
      if (i < block.length) interleaved.push(block[i]);
    }
  }
  for (let i = 0; i < eccPerBlock; i++) {
    for (const block of allEcc) {
      interleaved.push(block[i]);
    }
  }

  // Create module grid
  const grid: (boolean | null)[][] = Array.from({ length: qrSize }, () => Array(qrSize).fill(null));
  const reserved: boolean[][] = Array.from({ length: qrSize }, () => Array(qrSize).fill(false));

  // Place finder patterns
  const placeFinder = (row: number, col: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = row + r, cc = col + c;
        if (rr < 0 || rr >= qrSize || cc < 0 || cc >= qrSize) continue;
        const isBorder = r === -1 || r === 7 || c === -1 || c === 7;
        const isOuter = r === 0 || r === 6 || c === 0 || c === 6;
        const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        grid[rr][cc] = !isBorder && (isOuter || isInner);
        reserved[rr][cc] = true;
      }
    }
  };
  placeFinder(0, 0);
  placeFinder(0, qrSize - 7);
  placeFinder(qrSize - 7, 0);

  // Place alignment patterns (version >= 2)
  if (ver >= 2) {
    const positions = getAlignmentPositions(ver, qrSize);
    for (const r of positions) {
      for (const c of positions) {
        if (reserved[r][c]) continue;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const rr = r + dr, cc = c + dc;
            grid[rr][cc] = Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0);
            reserved[rr][cc] = true;
          }
        }
      }
    }
  }

  // Place timing patterns
  for (let i = 8; i < qrSize - 8; i++) {
    grid[6][i] = i % 2 === 0;
    reserved[6][i] = true;
    grid[i][6] = i % 2 === 0;
    reserved[i][6] = true;
  }

  // Dark module
  grid[qrSize - 8][8] = true;
  reserved[qrSize - 8][8] = true;

  // Reserve format info areas
  for (let i = 0; i < 8; i++) {
    reserved[8][i] = true;
    reserved[8][qrSize - 1 - i] = true;
    reserved[i][8] = true;
    reserved[qrSize - 1 - i][8] = true;
  }
  reserved[8][8] = true;

  // Reserve version info (version >= 7)
  if (ver >= 7) {
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 3; j++) {
        reserved[i][qrSize - 11 + j] = true;
        reserved[qrSize - 11 + j][i] = true;
      }
    }
  }

  // Place data bits
  const dataBits: number[] = [];
  for (const byte of interleaved) {
    for (let i = 7; i >= 0; i--) dataBits.push((byte >> i) & 1);
  }

  let bitIdx = 0;
  let upward = true;
  for (let right = qrSize - 1; right >= 0; right -= 2) {
    if (right === 6) right = 5; // Skip timing column
    const rows = upward ? Array.from({ length: qrSize }, (_, i) => qrSize - 1 - i) : Array.from({ length: qrSize }, (_, i) => i);
    for (const row of rows) {
      for (const col of [right, right - 1]) {
        if (col < 0) continue;
        if (!reserved[row][col]) {
          grid[row][col] = bitIdx < dataBits.length ? dataBits[bitIdx++] === 1 : false;
        }
      }
    }
    upward = !upward;
  }

  // Apply mask pattern 0 (checkerboard: (r+c) % 2 === 0)
  for (let r = 0; r < qrSize; r++) {
    for (let c = 0; c < qrSize; c++) {
      if (!reserved[r][c]) {
        if ((r + c) % 2 === 0) grid[r][c] = !grid[r][c];
      }
    }
  }

  // Place format info (ECC level L = 01, mask 0 = 000 → 01000)
  // Pre-computed format bits for L/mask0: 111011111000100
  const formatBits = [1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0];
  // Horizontal (row 8)
  const hPositions = [0, 1, 2, 3, 4, 5, 7, 8, qrSize - 8, qrSize - 7, qrSize - 6, qrSize - 5, qrSize - 4, qrSize - 3, qrSize - 2];
  for (let i = 0; i < 15; i++) grid[8][hPositions[i]] = formatBits[i] === 1;
  // Vertical (col 8)
  const vPositions = [0, 1, 2, 3, 4, 5, 7, 8, qrSize - 7, qrSize - 6, qrSize - 5, qrSize - 4, qrSize - 3, qrSize - 2, qrSize - 1];
  for (let i = 0; i < 15; i++) grid[vPositions[14 - i]][8] = formatBits[i] === 1;

  return grid.map(row => row.map(cell => cell === true));
}

function getAlignmentPositions(ver: number, size: number): number[] {
  if (ver === 1) return [];
  const intervals = Math.floor(ver / 7) + 1;
  const last = size - 7;
  const step = Math.ceil((last - 6) / intervals / 2) * 2;
  const positions = [6];
  let pos = last;
  while (pos > 6) {
    positions.unshift(pos);
    pos -= step;
  }
  return positions;
}

// ─── Component ────────────────────────────────────────────────────────────

export default function QRCodeDisplay({ token, claimId, creatorCode }: QRCodeDisplayProps) {
  const [currentToken, setCurrentToken] = useState(token);
  const [timeLeft, setTimeLeft] = useState(30);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const claimIdRef = useRef(claimId);

  claimIdRef.current = claimId;

  const redeemUrl = `${window.location.origin}?redeem=${currentToken}`;
  const qrDataUrl = useMemo(() => generateQRDataUrl(redeemUrl), [redeemUrl]);

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
      <div className="inline-block bg-[#FAF8F2] p-4 rounded-2xl shadow-sm border border-[rgba(26,60,52,0.1)]">
        <img
          src={qrDataUrl}
          alt="QR Code"
          className="w-56 h-56 mx-auto"
        />
      </div>

      {/* Creator code badge */}
      <div className="mt-4">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#E8EDE8] border border-[rgba(26,60,52,0.1)]">
          <Shield className="w-4 h-4 text-[#1A3C34]" />
          <span className="font-mono font-bold text-lg tracking-wider text-[#2C2C2C]">
            {creatorCode}
          </span>
        </div>
      </div>

      {/* Countdown progress bar — below the QR, never overlapping */}
      <div className="mt-3 max-w-[280px] mx-auto">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-[#1A3C34]' : 'text-gray-400'}`} />
            <span className={`text-xs font-medium ${isUrgent ? 'text-rose-500' : 'text-gray-500'}`}>
              Refreshes in {timeLeft}s
            </span>
          </div>
        </div>
        <div className="h-1.5 w-full bg-[#E8EDE8] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ease-linear ${
              isUrgent ? 'bg-rose-400' : 'bg-[#1A3C34]'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
