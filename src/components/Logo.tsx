interface LogoProps {
  size?: number;
  color?: string;
  variant?: 'icon' | 'wordmark' | 'icon-word';
}

export function Logo({ size = 40, color = "#1A3C34", variant = 'icon-word' }: LogoProps) {
  const fontSize = variant === 'wordmark' ? size : size * 0.6;

  return (
    <span
      className="font-display font-normal"
      style={{ fontSize, color, lineHeight: 1.1 }}
    >
      nayba
    </span>
  );
}
