interface LogoProps {
  size?: number;
  color?: string;
  variant?: 'icon' | 'wordmark' | 'icon-word';
}

function LogoIcon({ size }: { size: number }) {
  return (
    <span
      style={{
        fontFamily: "'Instrument Sans', sans-serif",
        fontSize: size,
        fontWeight: 700,
        color: 'var(--terra)',
        lineHeight: 1.1,
        letterSpacing: '-0.5px',
      }}
      aria-hidden="true"
    >
      nayba
    </span>
  );
}

function LogoWordmark({ size, color }: { size: number; color: string }) {
  return (
    <span
      style={{
        fontFamily: "'Instrument Sans', sans-serif",
        fontSize: size,
        fontWeight: 700,
        color,
        lineHeight: 1.1,
        letterSpacing: '-0.5px',
      }}
    >
      nayba
    </span>
  );
}

export function Logo({ size = 40, color = "var(--terra)", variant = 'icon-word' }: LogoProps) {
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
