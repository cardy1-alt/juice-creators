import { getLevelColour, getLevelDisplayName } from '../lib/levels';

interface LevelBadgeProps {
  level: number;
  levelName: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function LevelBadge({ level, levelName, size = 'sm' }: LevelBadgeProps) {
  const sizeStyles = {
    sm: { fontSize: '10px', padding: '2px 8px' },
    md: { fontSize: '12px', padding: '4px 12px' },
    lg: { fontSize: '14px', padding: '6px 16px' },
  };

  return (
    <span
      className="inline-block rounded-[50px] font-bold whitespace-nowrap"
      style={{
        background: getLevelColour(level),
        color: 'white',
        ...sizeStyles[size],
      }}
    >
      {getLevelDisplayName(level, levelName)}
    </span>
  );
}
