interface LogoProps {
  size?: number;
  color?: string;
  variant?: 'icon' | 'wordmark' | 'icon-word';
}

export function Logo({ size = 40, color = "#DE4E0C", variant = 'icon-word' }: LogoProps) {
  const fontSize = variant === 'wordmark' ? size : size * 0.6;

  return (
    <span
      className="font-display"
      style={{ fontSize, color, lineHeight: 1.1, fontWeight: 800 }}
    >
      nayba
    </span>
  );
}
