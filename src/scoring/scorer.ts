/**
 * Scoring and error-detection utilities for reading exercises.
 *
 * Flow for each exercise item:
 *  1. calculateSimilarity()  – compares the expected text with what the speech
 *     recogniser heard, using Levenshtein distance after phonetic normalisation
 *     (accent stripping, b/v equivalence).  Returns a value in [0, 1].
 *  2. classifyResult()       – maps the similarity score to 'correct' (≥0.85),
 *     'almost' (≥0.60) or 'incorrect' (<0.60).
 *  3. detectErrors()         – identifies the *type* of reading error
 *     (b/d confusion, p/q confusion, omission, addition, repetition, inversion)
 *     to help teachers understand where the learner struggles.
 *
 * At session end:
 *  4. calculateScore()       – percentage of correct items (0–100).
 *  5. calculateXpGained()    – XP reward based on score, difficulty and speed.
 */

import type { ErrorType, ReadingResult } from '../models';

const SPOKEN_LETTER_MAP: Record<string, string> = {
  a: 'a',
  e: 'e',
  i: 'i',
  o: 'o',
  u: 'u',
  be: 'b',
  ve: 'b',
  ce: 'c',
  de: 'd',
  efa: 'f',
  ge: 'g',
  hac: 'h',
  hache: 'h',
  jota: 'j',
  ka: 'k',
  ele: 'l',
  ela: 'l',
  eme: 'm',
  ema: 'm',
  ene: 'n',
  ena: 'n',
  eneida: 'n',
  enye: 'n',
  enya: 'n',
  pe: 'p',
  cu: 'q',
  que: 'q',
  erre: 'r',
  erra: 'r',
  ese: 's',
  essa: 's',
  te: 't',
  uve: 'b',
  ube: 'b',
  equis: 'x',
  ix: 'x',
  zeta: 'z',
};

const SPOKEN_BIGRAM_LETTER_MAP: Record<string, string> = {
  'i grega': 'y',
  'doble ve': 'w',
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z\s]/g, '')
    // b and v are phonetically identical in Catalan/Spanish; treat them as equal
    .replace(/v/g, 'b')
    .trim();
}

/**
 * Converts spoken text into a single-letter candidate for sound exercises.
 * Examples:
 *  - "be" -> "b"
 *  - "i grega" -> "y"
 *  - "doble ve" -> "w"
 *  - "a" -> "a"
 */
export function extractSoundToken(recognized: string): string {
  const normalized = normalize(recognized);
  if (!normalized) return '';

  if (SPOKEN_BIGRAM_LETTER_MAP[normalized]) {
    return SPOKEN_BIGRAM_LETTER_MAP[normalized];
  }

  const words = normalized.split(/\s+/).filter(Boolean);
  for (let i = 0; i < words.length - 1; i++) {
    const pair = `${words[i]} ${words[i + 1]}`;
    if (SPOKEN_BIGRAM_LETTER_MAP[pair]) {
      return SPOKEN_BIGRAM_LETTER_MAP[pair];
    }
  }

  for (const word of words) {
    if (/^[a-z]$/.test(word)) return word;
    if (SPOKEN_LETTER_MAP[word]) return SPOKEN_LETTER_MAP[word];
  }

  // Fallback: if the recognizer produced plain text, take first letter.
  const merged = words.join('');
  return merged ? merged[0] : '';
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

export function calculateSimilarity(expected: string, recognized: string): number {
  const a = normalize(expected);
  const b = normalize(recognized);
  if (a === b) return 1;
  if (!a || !b) return 0;

  // For short tokens (syllables, ≤ 4 chars), also accept the answer when the
  // expected syllable appears as a whole word inside the recognized transcript.
  // Speech recognizers often embed bare syllables in longer phrases (e.g. "la pa").
  if (a.length <= 4) {
    const recognizedWords = b.split(/\s+/);
    if (recognizedWords.includes(a)) return 1;
  }

  const maxLen = Math.max(a.length, b.length);
  const distance = levenshtein(a, b);
  return Math.max(0, 1 - distance / maxLen);
}

export function calculateSyllableSimilarity(expected: string, recognized: string): number {
  const normalizedExpected = normalize(expected).replace(/\s/g, '');
  const recognizedWords = normalize(recognized).split(/\s+/).filter(Boolean);
  if (!normalizedExpected || recognizedWords.length === 0) return 0;

  let bestSimilarity = calculateSimilarity(normalizedExpected, recognized);
  for (const word of recognizedWords) {
    if (word.length < normalizedExpected.length) {
      bestSimilarity = Math.max(bestSimilarity, calculateSimilarity(normalizedExpected, word));
      continue;
    }

    const prefix = word.slice(0, normalizedExpected.length);
    const suffix = word.slice(-normalizedExpected.length);
    bestSimilarity = Math.max(
      bestSimilarity,
      calculateSimilarity(normalizedExpected, prefix),
      calculateSimilarity(normalizedExpected, suffix),
    );
  }

  return bestSimilarity;
}

export function classifyResult(similarity: number): ReadingResult {
  if (similarity >= 0.8) return 'correct';
  if (similarity >= 0.55) return 'almost';
  return 'incorrect';
}

export function detectErrors(expected: string, recognized: string): ErrorType[] {
  const errors: ErrorType[] = [];
  const a = normalize(expected);
  const b = normalize(recognized);

  if (!a || !b) return errors;

  // b/d confusion
  const swapBD = (s: string) => s.replace(/b/g, 'X').replace(/d/g, 'b').replace(/X/g, 'd');
  if (normalize(swapBD(a)) === b || normalize(swapBD(b)) === a) {
    errors.push('b_d_confusion');
  }

  // p/q confusion
  const swapPQ = (s: string) => s.replace(/p/g, 'X').replace(/q/g, 'p').replace(/X/g, 'q');
  if (normalize(swapPQ(a)) === b || normalize(swapPQ(b)) === a) {
    errors.push('p_q_confusion');
  }

  // omission: recognized is shorter than expected
  if (b.length < a.length * 0.8) {
    errors.push('omission');
  }

  // addition: recognized is longer than expected
  if (b.length > a.length * 1.2) {
    errors.push('addition');
  }

  // repetition: recognized has repeated words
  const words = b.split(/\s+/);
  const uniqueWords = new Set(words);
  if (uniqueWords.size < words.length * 0.8) {
    errors.push('repetition');
  }

  // inversion: letters in wrong order
  const aChars = a.replace(/\s/g, '');
  const bChars = b.replace(/\s/g, '');
  if (aChars.length === bChars.length && aChars !== bChars) {
    const sorted = (s: string) => s.split('').sort().join('');
    if (sorted(aChars) === sorted(bChars)) {
      errors.push('inversion');
    }
  }

  return errors;
}

export function calculateScore(correctItems: number, totalItems: number): number {
  if (totalItems === 0) return 0;
  return Math.round((correctItems / totalItems) * 100);
}

export function calculateXpGained(score: number, difficulty: string, timeMs: number): number {
  const base = difficulty === 'easy' ? 10 : difficulty === 'medium' ? 20 : 35;
  const scoreBonus = Math.round((score / 100) * base);
  const speedBonus = timeMs < 3000 ? 5 : timeMs < 5000 ? 2 : 0;
  return scoreBonus + speedBonus;
}
