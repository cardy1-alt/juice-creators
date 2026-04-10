import NaybaLogo from '../assets/logomark.svg';

interface LogoProps {
  size?: number;
  color?: string;
  variant?: 'icon' | 'wordmark' | 'icon-word';
}

function LogoIcon({ size }: { size: number }) {
  return (
    <img src={NaybaLogo} alt="" width={size} height={size} />
  );
}

function LogoWordmark({ size, color }: { size: number; color: string }) {
  return (
    <span
      style={{
        fontFamily: "'Instrument Sans', sans-serif",
        fontSize: size,
        fontWeight: 600,
        color,
        lineHeight: 1.1,
        letterSpacing: '-0.04em',
      }}
    >
      Nayba
    </span>
  );
}

export function Logo({ size = 28, color = "var(--ink)", variant = 'icon-word' }: LogoProps) {
  if (variant === 'icon') {
    return <LogoIcon size={size} />;
  }

  if (variant === 'wordmark') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <img src={NaybaLogo} alt="" width={size} height={size} />
        <span style={{
          fontFamily: "'Instrument Sans', sans-serif",
          fontWeight: 600,
          fontSize: size * 0.78,
          letterSpacing: '-0.04em',
          color: 'var(--ink)'
        }}>Nayba</span>
      </div>
    );
  }

  // icon-word: icon + wordmark side by side, vertically centred
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <img src={NaybaLogo} alt="" width={size} height={size} />
      <LogoWordmark size={size * 0.78} color={color} />
    </div>
  );
}
