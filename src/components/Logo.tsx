interface LogoProps {
  size?: number;
  color?: string;
}

export function Logo({ size = 18, color = "#1A3C34" }: LogoProps) {
  return (
    <span
      style={{
        fontSize: `${size * 2}px`,
        fontWeight: 500,
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
