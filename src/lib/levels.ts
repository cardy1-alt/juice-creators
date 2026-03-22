// ─── Creator Level System ─────────────────────────────────────────────────

export const LEVEL_THRESHOLDS = [
  { level: 1, name: 'Newcomer', minReels: 0, minRating: 0 },
  { level: 2, name: 'Explorer', minReels: 1, minRating: 0 },
  { level: 3, name: 'Regular', minReels: 3, minRating: 0 },
  { level: 4, name: 'Local', minReels: 6, minRating: 0 },
  { level: 5, name: 'Trusted', minReels: 11, minRating: 4.5 },
  { level: 6, name: 'Nayba', minReels: 21, minRating: 4.8 },
] as const;

export const getLevelColour = (level: number): string => {
  switch (level) {
    case 1: return '#9E9E9E';                  // Newcomer – neutral grey
    case 2: return '#8FAF8F';                  // Explorer – soft sage
    case 3: return '#4CAF7D';                  // Regular  – green
    case 4: return '#1A4A2E';                  // Local    – forest (brand)
    case 5: return '#DE4E0C';                  // Trusted  – terra  (brand)
    case 6: return '#1A1A1A';                  // Nayba    – near-black
    default: return '#9E9E9E';
  }
};

export const getLevelDisplayName = (level: number, levelName: string): string => {
  if (level === 6) return '✦ Nayba';
  return levelName;
};

export interface LevelProgress {
  currentLevel: number;
  currentName: string;
  nextLevel: number | null;
  nextName: string | null;
  reelsToNext: number;
  ratingNeeded: number | null;
  progressPercent: number;
  isMaxLevel: boolean;
}

export const getLevelProgress = (totalReels: number, averageRating: number, currentLevel: number): LevelProgress => {
  const current = LEVEL_THRESHOLDS.find(t => t.level === currentLevel) || LEVEL_THRESHOLDS[0];
  const next = LEVEL_THRESHOLDS.find(t => t.level === currentLevel + 1);

  if (!next) {
    return {
      currentLevel: current.level,
      currentName: current.name,
      nextLevel: null,
      nextName: null,
      reelsToNext: 0,
      ratingNeeded: null,
      progressPercent: 100,
      isMaxLevel: true,
    };
  }

  const reelsRange = next.minReels - current.minReels;
  const reelsProgress = Math.min(totalReels - current.minReels, reelsRange);
  const progressPercent = reelsRange > 0 ? Math.round((reelsProgress / reelsRange) * 100) : 0;

  return {
    currentLevel: current.level,
    currentName: current.name,
    nextLevel: next.level,
    nextName: next.name,
    reelsToNext: Math.max(0, next.minReels - totalReels),
    ratingNeeded: next.minRating > 0 && averageRating < next.minRating ? next.minRating : null,
    progressPercent: Math.min(progressPercent, 100),
    isMaxLevel: false,
  };
};

export const calculateLevel = (totalReels: number, averageRating: number): { level: number; levelName: string } => {
  if (totalReels >= 21 && averageRating >= 4.8) return { level: 6, levelName: 'Nayba' };
  if (totalReels >= 11 && averageRating >= 4.5) return { level: 5, levelName: 'Trusted' };
  if (totalReels >= 6) return { level: 4, levelName: 'Local' };
  if (totalReels >= 3) return { level: 3, levelName: 'Regular' };
  if (totalReels >= 1) return { level: 2, levelName: 'Explorer' };
  return { level: 1, levelName: 'Newcomer' };
};

// ─── Profile Completeness ─────────────────────────────────────────────────

interface CompletenessField {
  key: string;
  label: string;
  points: number;
}

const COMPLETENESS_FIELDS: CompletenessField[] = [
  { key: 'avatar_url', label: 'Profile photo', points: 25 },
  { key: 'instagram_handle', label: 'Instagram handle', points: 25 },
  { key: 'bio', label: 'Short bio', points: 25 },
  { key: 'display_name', label: 'Display name', points: 25 },
];

export interface ProfileCompleteness {
  score: number;
  completed: CompletenessField[];
  missing: CompletenessField[];
}

export const getProfileCompleteness = (creator: Record<string, unknown>): ProfileCompleteness => {
  const completed = COMPLETENESS_FIELDS.filter(f => {
    const val = creator[f.key];
    return val !== null && val !== undefined && val !== '';
  });
  const score = completed.reduce((sum, f) => sum + f.points, 0);
  return {
    score,
    completed,
    missing: COMPLETENESS_FIELDS.filter(f => !completed.includes(f)),
  };
};

// ─── Streak Logic ─────────────────────────────────────────────────────────

export const checkStreakStatus = (lastReelMonth: string | null): 'active' | 'at_risk' | 'broken' | 'none' => {
  if (!lastReelMonth) return 'none';

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [cy, cm] = currentMonth.split('-').map(Number);
  const [ly, lm] = lastReelMonth.split('-').map(Number);
  const monthsDiff = (cy - ly) * 12 + (cm - lm);

  if (monthsDiff === 0) return 'active'; // Posted this month
  if (monthsDiff === 1) return 'at_risk'; // Last month was active, this month not yet
  return 'broken'; // Gap > 1 month
};

export const isStreakWarningPeriod = (lastReelMonth: string | null): boolean => {
  if (!lastReelMonth) return false;
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [cy, cm] = currentMonth.split('-').map(Number);
  const [ly, lm] = lastReelMonth.split('-').map(Number);
  const monthsDiff = (cy - ly) * 12 + (cm - lm);

  // Show warning in last 7 days of month if no reel this month
  if (monthsDiff >= 1) {
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysLeft = daysInMonth - now.getDate();
    return daysLeft <= 7;
  }
  return false;
};

export const getCurrentMonth = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};
