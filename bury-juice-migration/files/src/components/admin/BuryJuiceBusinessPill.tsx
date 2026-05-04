// Deterministic business-name badge. Each business gets a consistent
// colour derived from its id hash so Jacob can scan the admin calendar
// and immediately spot who's booked what. The palette is curated
// (rather than full-spectrum HSL) so pills sit comfortably next to
// Nayba's terra accent without clashing.

const PALETTE: { bg: string; text: string }[] = [
  { bg: '#F9E8E1', text: '#9B3A15' }, // warm sand — closest to terra
  { bg: '#DDEADD', text: '#31603A' }, // sage
  { bg: '#D6E6F0', text: '#2C5570' }, // baltic
  { bg: '#DDD6EE', text: '#4D3F70' }, // violet
  { bg: '#EDE5C0', text: '#6C5A1F' }, // golden mist
  { bg: '#F6DDE4', text: '#822846' }, // blush
  { bg: '#D6EEE9', text: '#1E5D53' }, // seafoam
  { bg: '#E6E0D6', text: '#5F4E36' }, // taupe
  { bg: '#EFE1D0', text: '#7A4A1E' }, // caramel
  { bg: '#D9E2EC', text: '#3A4A63' }, // slate blue
];

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function businessPillColor(id: string): { bg: string; text: string } {
  return PALETTE[hashId(id) % PALETTE.length];
}

interface BusinessPillProps {
  id: string;
  name: string;
  compact?: boolean;
  onClick?: () => void;
}

export function BusinessPill({ id, name, compact, onClick }: BusinessPillProps) {
  const { bg, text } = businessPillColor(id);
  return (
    <span
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') onClick();
            }
          : undefined
      }
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: compact ? '2px 8px' : '4px 10px',
        borderRadius: 8,
        background: bg,
        color: text,
        fontSize: compact ? 11 : 12,
        fontWeight: 600,
        fontFamily: 'inherit',
        border: 'none',
        cursor: onClick ? 'pointer' : 'default',
        maxWidth: '100%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {name}
    </span>
  );
}

export function OpenSlotPill({ compact }: { compact?: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: compact ? '2px 8px' : '4px 10px',
        borderRadius: 8,
        background: 'transparent',
        border: '1px dashed var(--border-color-hover)',
        color: 'var(--ink-35)',
        fontSize: compact ? 11 : 12,
        fontWeight: 500,
        fontFamily: 'inherit',
      }}
    >
      Open
    </span>
  );
}
