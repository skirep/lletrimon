export type ExerciseType = 'sounds' | 'syllables' | 'words' | 'pseudowords' | 'sentences';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type ReadingResult = 'correct' | 'almost' | 'incorrect';

export interface ExerciseItem {
  id: string;
  text: string;
  type: ExerciseType;
  difficulty: Difficulty;
  syllableCount?: number;
  category?: string;
}

export interface ExerciseSet {
  id: string;
  title: string;
  description: string;
  type: ExerciseType;
  difficulty: Difficulty;
  items: ExerciseItem[];
}

export interface ExerciseAttempt {
  itemId: string;
  expected: string;
  recognized: string;
  recordedAudioBase64?: string;
  result: ReadingResult;
  similarity: number;
  errorTypes: ErrorType[];
  timeMs: number;
  timestamp: number;
}

export interface ExerciseSession {
  id: string;
  profileId: string;
  setId: string;
  type: ExerciseType;
  difficulty: Difficulty;
  attempts: ExerciseAttempt[];
  startedAt: number;
  completedAt?: number;
  score: number;
  totalItems: number;
  correctItems: number;
  averageTimeMs: number;
}

export type ErrorType =
  | 'b_d_confusion'
  | 'p_q_confusion'
  | 'omission'
  | 'inversion'
  | 'repetition'
  | 'substitution'
  | 'addition';
