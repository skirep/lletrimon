export interface Profile {
  id: string;
  userId?: string;
  name: string;
  avatar: string;
  isAdmin?: boolean;
  school?: string;
  location?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProfileStats {
  profileId: string;
  totalExercises: number;
  totalCorrect: number;
  totalAttempts: number;
  totalTimeMs: number;
  consecutiveDays: number;
  lastSessionDate: number;
  experience: number;
  level: number;
  errorFrequency: Record<string, number>;
}

export const AVATARS = [
  'cat', 'dog', 'rabbit', 'bear', 'fox',
  'owl', 'penguin', 'unicorn', 'dragon', 'elephant',
] as const;

export type AvatarId = typeof AVATARS[number];

export const LEVEL_THRESHOLDS = [
  0, 100, 250, 500, 900, 1500, 2400, 3700, 5500, 8000,
];

export function getLevelFromXp(xp: number): number {
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1;
  }
  return level;
}

export function getXpToNextLevel(xp: number): { current: number; needed: number; level: number } {
  const level = getLevelFromXp(xp);
  const currentThreshold = LEVEL_THRESHOLDS[level - 1] ?? 0;
  const nextThreshold = LEVEL_THRESHOLDS[level] ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
  return {
    current: xp - currentThreshold,
    needed: nextThreshold - currentThreshold,
    level,
  };
}
