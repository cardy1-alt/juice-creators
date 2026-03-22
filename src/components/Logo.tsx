interface LogoProps {
  size?: number;
  color?: string;
  variant?: 'icon' | 'wordmark' | 'icon-word';
}

function LogoIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Geometric 'n' lettermark */}
      <rect x="6" y="14" width="8" height="28" rx="2" fill={color} />
      <path
        d="M14 26C14 19.373 19.373 14 26 14H34V42H26V26H14Z"
        fill={color}
      />
      <rect x="34" y="14" width="8" height="28" rx="2" fill={color} />
    </svg>
  );
}

function LogoWordmark({ size, color }: { size: number; color: string }) {
  return (
    <span
      style={{
        fontFamily: 'Figtree, sans-serif',
        fontSize: size,
        fontWeight: 900,
        color,
        lineHeight: 1.1,
        letterSpacing: '-0.02em',
      }}
    >
      nayba
    </span>
  );
}

export function Logo({ size = 40, color = "#CB4A2F", variant = 'icon-word' }: LogoProps) {
  if (variant === 'icon') {
    return <LogoIcon size={size} color={color} />;
  }

  if (variant === 'wordmark') {
    return <LogoWordmark size={size} color={color} />;
  }

  // icon-word: icon + wordmark side by side
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.15 }}>
      <LogoIcon size={size} color={color} />
      <LogoWordmark size={size * 0.6} color={color} />
    </span>
  );
}
