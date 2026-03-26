interface LogoProps {
  size?: number;
  color?: string;
  variant?: 'icon' | 'wordmark' | 'icon-word';
}

function LogoIcon({ size }: { size: number }) {
  return (
    <img
      src="/nayba_logo.svg"
      alt="nayba"
      width={size}
      height={size}
      style={{ objectFit: 'contain' }}
      aria-hidden="true"
    />
  );
}

function LogoWordmark({ size, color }: { size: number; color: string }) {
  return (
    <span
      style={{
        fontFamily: "'Corben', serif",
        fontSize: size,
        fontWeight: 400,
        color,
        lineHeight: 1.1,
        letterSpacing: '-0.5px',
      }}
    >
      nayba
    </span>
  );
}

export function Logo({ size = 40, color = "#1A3C34", variant = 'icon-word' }: LogoProps) {
  if (variant === 'icon') {
    return <LogoIcon size={size} />;
  }

  if (variant === 'wordmark') {
    return <LogoWordmark size={size} color={color} />;
  }

  // icon-word: icon + wordmark side by side, vertically centred
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.15 }}>
      <LogoIcon size={size} />
      <LogoWordmark size={size * 0.6} color={color} />
    </span>
  );
}
