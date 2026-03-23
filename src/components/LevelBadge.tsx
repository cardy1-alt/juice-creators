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

  return (
    <span
      className="inline-block rounded-full font-bold whitespace-nowrap"
      style={{
        background: level === 1 ? '#EDE8DC' : getLevelColour(level),
        color: level === 1 ? '#2C2420' : '#F7F6F3',
        ...sizeStyles[size],
      }}
    >
      {getLevelDisplayName(level, levelName)}
    </span>
  );
}
