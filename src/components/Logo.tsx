interface LogoProps {
  size?: number;
  color?: string;
}

export function Logo({ size = 18, color = "#1A3C34" }: LogoProps) {
  return (
    <span
      style={{
        fontSize: `${size}px`,
        fontWeight: 800,
        color,
        letterSpacing: '-0.5px',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        lineHeight: 1,
      }}
    >
      nayba
    </span>
  );
}
