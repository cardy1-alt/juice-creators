import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { DoodleIcon } from '../lib/doodle-icons';

interface QRCodeDisplayProps {
  token: string;
  claimId: string;
  creatorCode: string;
  size?: number;
  hideExtras?: boolean;
}

function generateSecureToken(): string {
  return crypto.randomUUID() + '-' + crypto.randomUUID();
}

// ─── Minimal QR Code encoder (Model 2, byte mode, ECC-L) ─────────────────
function generateQRDataUrl(text: string, size: number = 280): string {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#EDE8DC';
  ctx.fillRect(0, 0, size, size);

  const modules = encodeQR(text);
  const n = modules.length;
  const margin = 4;
  const cellSize = size / (n + margin * 2);

  ctx.fillStyle = '#2C2420';
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

  let ver = 1, qrSize = 21, totalData = 19, eccPerBlock = 7, numBlocks = 1;
  for (const [v, s, d, e, b] of VERSION_TABLE) {
    const lengthBits = v >= 10 ? 16 : 8;
    const overhead = Math.ceil((4 + lengthBits) / 8);
    if (len + overhead <= d) {
      ver = v; qrSize = s; totalData = d; eccPerBlock = e; numBlocks = b;
      break;
    }
  }

  const lengthBits = ver >= 10 ? 16 : 8;
  const bits: number[] = [];
  const pushBits = (val: number, count: number) => {
    for (let i = count - 1; i >= 0; i--) bits.push((val >> i) & 1);
  };

  pushBits(0b0100, 4);
  pushBits(len, lengthBits);
  for (const b of bytes) pushBits(b, 8);
  pushBits(0, 4);

  while (bits.length % 8 !== 0) bits.push(0);

  const dataBytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    dataBytes.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  }

  let padIdx = 0;
  while (dataBytes.length < totalData) {
    dataBytes.push(padIdx % 2 === 0 ? 0xec : 0x11);
    padIdx++;
  }

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

  const grid: (boolean | null)[][] = Array.from({ length: qrSize }, () => Array(qrSize).fill(null));
  const reserved: boolean[][] = Array.from({ length: qrSize }, () => Array(qrSize).fill(false));

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

  for (let i = 8; i < qrSize - 8; i++) {
    grid[6][i] = i % 2 === 0;
    reserved[6][i] = true;
    grid[i][6] = i % 2 === 0;
    reserved[i][6] = true;
  }

  grid[qrSize - 8][8] = true;
  reserved[qrSize - 8][8] = true;

  for (let i = 0; i < 8; i++) {
    reserved[8][i] = true;
    reserved[8][qrSize - 1 - i] = true;
    reserved[i][8] = true;
    reserved[qrSize - 1 - i][8] = true;
  }
  reserved[8][8] = true;

  if (ver >= 7) {
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 3; j++) {
        reserved[i][qrSize - 11 + j] = true;
        reserved[qrSize - 11 + j][i] = true;
      }
    }
  }

  const dataBits: number[] = [];
  for (const byte of interleaved) {
    for (let i = 7; i >= 0; i--) dataBits.push((byte >> i) & 1);
  }

  let bitIdx = 0;
  let upward = true;
  for (let right = qrSize - 1; right >= 0; right -= 2) {
    if (right === 6) right = 5;
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

  for (let r = 0; r < qrSize; r++) {
    for (let c = 0; c < qrSize; c++) {
      if (!reserved[r][c]) {
        if ((r + c) % 2 === 0) grid[r][c] = !grid[r][c];
      }
    }
  }

  const formatBits = [1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0];
  const hPositions = [0, 1, 2, 3, 4, 5, 7, 8, qrSize - 8, qrSize - 7, qrSize - 6, qrSize - 5, qrSize - 4, qrSize - 3, qrSize - 2];
  for (let i = 0; i < 15; i++) grid[8][hPositions[i]] = formatBits[i] === 1;
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

export default function QRCodeDisplay({ token, claimId, creatorCode, size: displaySize, hideExtras }: QRCodeDisplayProps) {
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

  const isUrgent = timeLeft <= 5;

  return (
    <div className="flex flex-col items-center gap-[20px] rounded-[18px] bg-[#EDE8DC] p-[16px]">
      {/* QR code — 240px */}
      <div className="inline-block rounded-[10px] overflow-hidden">
        <img
          src={qrDataUrl}
          alt="QR Code"
          className="block"
          style={{ width: `${displaySize || 240}px`, height: `${displaySize || 240}px` }}
        />
      </div>

      {!hideExtras && (
        <>
          {/* Creator code badge */}
          <span
            className="font-mono text-[17px] font-extrabold tracking-[1.5px] text-[var(--near-black)] inline-block rounded-full bg-[#EDE8DC] border border-[var(--faint)]"
            style={{ padding: '10px 20px' }}
          >
            {creatorCode}
          </span>

          {/* Refresh timer */}
          <div className="flex items-center gap-1.5" style={{ marginTop: 12 }}>
            <DoodleIcon name="sync" size={12} className={isRefreshing ? 'animate-spin text-[var(--terra)]' : 'text-[var(--soft)]'} />
            <span className={`text-[14px] font-medium ${isUrgent ? 'text-[var(--terra)]' : 'text-[var(--soft)]'}`}>
              Refreshes in {timeLeft}s
            </span>
          </div>
        </>
      )}
    </div>
  );
}
