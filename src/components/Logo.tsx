interface LogoProps {
  size?: number;
  color?: string;
  variant?: 'icon' | 'wordmark' | 'icon-word';
}

function LogoIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="40" height="40" rx="8" fill="#1A3C34" />
      <text
        x="50%"
        y="54%"
        dominantBaseline="middle"
        textAnchor="middle"
        fontFamily="'Plus Jakarta Sans', sans-serif"
        fontWeight="700"
        fontSize="22"
        fill="#F6F3EE"
      >
        N
      </text>
    </svg>
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
