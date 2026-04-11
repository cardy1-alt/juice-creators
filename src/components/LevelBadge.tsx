import { getLevelColour, getLevelDisplayName } from '../lib/levels';

interface LevelBadgeProps {
  level: number;
  levelName: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function LevelBadge({ level, levelName, size = 'sm' }: LevelBadgeProps) {
  const sizeStyles = {
    sm: { fontSize: '12px', padding: '3px 10px' },
    md: { fontSize: '14px', padding: '5px 14px' },
    lg: { fontSize: '16px', padding: '7px 18px' },
  };

  const colors = getLevelColour(level);

  return (
    <span
      className="inline-block rounded-full whitespace-nowrap"
      style={{
        fontFamily: "'Instrument Sans', sans-serif",
        fontWeight: 600,
        background: colors.bg,
        color: colors.text,
        ...sizeStyles[size],
      }}
    >
      {getLevelDisplayName(level, levelName)}
    </span>
  );
}
