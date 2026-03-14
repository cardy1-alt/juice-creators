interface LogoProps {
  size?: number;
  color?: string;
}

export function Logo({ size = 18, color = "#1A3C34" }: LogoProps) {
  return (
    <span
      style={{
        fontSize: `${size * 1.6}px`,
        fontWeight: 700,
        color,
        letterSpacing: '-0.3px',
        fontFamily: "'Crimson Pro', serif",
        lineHeight: 1,
      }}
    >
      nayba
    </span>
  );
}
