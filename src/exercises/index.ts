import soundsSets from './sounds.json';
import syllablesSets from './syllables.json';
import wordsSets from './words.json';
import pseudowordsSets from './pseudowords.json';
import sentencesSets from './sentences.json';
import type { ExerciseSet, ExerciseType, Difficulty } from '../models';

const EASY_MEDIUM_COUNTS = [10, 15, 20] as const;

function inferAllowedCountFromSetId(id: string): number | null {
  const match = id.match(/-(\d+)$/);
  if (!match) return null;
  const index = Number(match[1]) - 1;
  return EASY_MEDIUM_COUNTS[index] ?? null;
}

function toAllowedEasyMediumCount(set: ExerciseSet): number {
  const inferred = inferAllowedCountFromSetId(set.id);
  if (inferred) return inferred;

  const currentCount = set.randomCount ?? set.items.length;
  if (currentCount <= 10) return 10;
  if (currentCount <= 15) return 15;
  return 20;
}

function normalizeSet(set: ExerciseSet): ExerciseSet {
  if (set.difficulty === 'easy' || set.difficulty === 'medium') {
    return {
      ...set,
      randomCount: toAllowedEasyMediumCount(set),
    };
  }
  return set;
}

const allSets: ExerciseSet[] = [
  ...(soundsSets as ExerciseSet[]),
  ...(syllablesSets as ExerciseSet[]),
  ...(wordsSets as ExerciseSet[]),
  ...(pseudowordsSets as ExerciseSet[]),
  ...(sentencesSets as ExerciseSet[]),
].map(normalizeSet);

export function getAllSets(): ExerciseSet[] {
  return allSets;
}

export function getSetsByType(type: ExerciseType): ExerciseSet[] {
  return allSets.filter((s) => s.type === type);
}

export function getSetsByDifficulty(difficulty: Difficulty): ExerciseSet[] {
  return allSets.filter((s) => s.difficulty === difficulty);
}

export function getSetsByTypeAndDifficulty(type: ExerciseType, difficulty: Difficulty): ExerciseSet[] {
  return allSets.filter((s) => s.type === type && s.difficulty === difficulty);
}

export function getSetById(id: string): ExerciseSet | undefined {
  return allSets.find((s) => s.id === id);
}

export function shuffleItems<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
