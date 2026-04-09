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
        fontFamily: 'Hornbill, Georgia, serif',
        fontSize: size,
        fontWeight: 900,
        color,
        lineHeight: 1.1,
        letterSpacing: '-0.03em',
      }}
    >
      Nayba
    </span>
  );
}

export function Logo({ size = 40, color = "var(--ink)", variant = 'icon-word' }: LogoProps) {
  if (variant === 'icon') {
    return <LogoIcon size={size} />;
  }

  if (variant === 'wordmark') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <img src={NaybaLogo} alt="" width={size} height={size} />
        <span style={{
          fontFamily: 'Hornbill, Georgia, serif',
          fontWeight: 900,
          fontSize: size * 0.71,
          letterSpacing: '-0.03em',
          color: 'var(--ink)'
        }}>Nayba</span>
      </div>
    );
  }

  // icon-word: icon + wordmark side by side, vertically centred
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <img src={NaybaLogo} alt="" width={size} height={size} />
      <LogoWordmark size={size * 0.6} color={color} />
    </div>
  );
}
