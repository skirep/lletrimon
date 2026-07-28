import { useState, useCallback, useEffect, useRef } from 'react';
import styles from './ExerciseRunner.module.css';
import { ExerciseText } from '../components/exercise';
import { Button } from '../components/common';
import { useSettings, useSpeechRecognition } from '../hooks';
import { calculateSimilarity, calculateSyllableSimilarity, classifyResult, detectErrors, calculateScore, extractSoundToken } from '../scoring';
import { sessionStorage } from '../storage';
import { gamificationService } from '../gamification';
import { shuffleItems } from '../exercises';
import { generateId } from '../utils';
import { WhisperEngine } from '../speech';
import { Capacitor } from '@capacitor/core';
import type { ExerciseSet, Profile, ExerciseAttempt, ExerciseSession } from '../models';

/**
 * ExerciseRunner – runs a single exercise set item by item using speech recognition.
 *
 * Item lifecycle (phase state machine):
 *  'ready'     → Speech recognition starts; a countdown timer is shown.
 *  'listening' → Microphone is open; the player reads the displayed text aloud.
 *                The item times out after the configured seconds for this
 *                exercise type if no speech is detected.
 *  'done'      → All items have been processed; the session is saved and
 *                gamification is processed (XP, badges, streak…).
 *
 */

interface ExerciseRunnerProps {
  profile: Profile;
  set: ExerciseSet;
  onFinish: () => void;
}

const SPEECH_GRACE_MS = 200;
const SHORT_TIMER_SPEECH_GRACE_MS = 1200;
// Whisper needs extra grace time: the API call itself takes 1-3 seconds after
// the audio recording stops, so we wait longer before giving up.
const WHISPER_SPEECH_GRACE_MS = 5000;

/** Web uses Whisper only for sounds; Android WebView uses it for every type. */
const WHISPER_TYPES = new Set(['sounds']);

export function ExerciseRunner({ profile, set, onFinish }: ExerciseRunnerProps) {
  const [items] = useState(() => shuffleItems(set.items));
  const [index, setIndex] = useState(0);
  const [attempts, setAttempts] = useState<ExerciseAttempt[]>([]);
  const [phase, setPhase] = useState<'ready' | 'listening' | 'done'>('ready');
  const [timeLeftMs, setTimeLeftMs] = useState(0);
  const startTimeRef = useRef<number>(0);
  const sessionStartRef = useRef<number>(Date.now());
  const itemDeadlineRef = useRef<number>(0);
  const timedOutRef = useRef(false);
  const readTimeoutRef = useRef<number | null>(null);
  const graceTimeoutRef = useRef<number | null>(null);
  const currentDurationMsRef = useRef(0);
  const attemptsRef = useRef<ExerciseAttempt[]>([]);
  const completingRef = useRef(false);
  const phaseRef = useRef<'ready' | 'listening' | 'done'>('ready');
  const transcriptRef = useRef('');
  const alternativesRef = useRef<Array<{ transcript: string; confidence: number }>>([]);

  // Choose engine and grammar hints based on exercise type.
  // Android WebView does not provide a dependable Web Speech implementation.
  const useWhisper = Capacitor.getPlatform() === 'android' || WHISPER_TYPES.has(set.type);
  const speechEngine = useRef(useWhisper ? new WhisperEngine() : undefined).current;
  const grammarHints = useRef(useWhisper ? [] : items.map((item) => item.text)).current;

  const { settings, loading: settingsLoading } = useSettings(profile.id);
  const { transcript, alternatives, isListening, error, isSupported, start, stop, setTranscript } = useSpeechRecognition(speechEngine, grammarHints);

  const currentItem = items[index];

  const clearTimer = useCallback((timer: { current: number | null }) => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const completeSession = useCallback(async (finalAttempts: ExerciseAttempt[]) => {
    if (completingRef.current) return;
    completingRef.current = true;
    const completedAt = Date.now();
    const correctItems = finalAttempts.filter((a) => a.result === 'correct').length;
    const totalItems = finalAttempts.length;
    const score = calculateScore(correctItems, totalItems);
    const avgTime = finalAttempts.length > 0
      ? finalAttempts.reduce((s, a) => s + a.timeMs, 0) / finalAttempts.length
      : 0;

    const session: ExerciseSession = {
      id: generateId(),
      profileId: profile.id,
      setId: set.id,
      type: set.type,
      difficulty: set.difficulty,
      attempts: finalAttempts,
      startedAt: sessionStartRef.current,
      completedAt,
      score,
      totalItems,
      correctItems,
      averageTimeMs: avgTime,
    };
    try {
      await sessionStorage.save(session);
    } catch (err) {
      console.error('Error saving session:', err);
    }
    try {
      await gamificationService.processSession(session);
    } catch (err) {
      console.error('Error processing gamification:', err);
    }
    setPhase('done');
  }, [profile.id, set.id, set.type, set.difficulty]);

  const evaluateCurrentAttempt = useCallback((recognizedText: string, allowWhenTimedOut = false) => {
    if (phaseRef.current !== 'listening' || (!allowWhenTimedOut && timedOutRef.current) || !currentItem) return;
    clearTimer(readTimeoutRef);
    clearTimer(graceTimeoutRef);
    const timeMs = Date.now() - startTimeRef.current;

    // Try all speech alternatives and pick the one that best matches the expected text.
    // This significantly improves recognition of short syllables that aren't real words,
    // since the speech engine's top result often misidentifies them.
    const toComparableText = (value: string) => set.type === 'sounds' ? extractSoundToken(value) : value;
    const compareText = set.type === 'syllables' ? calculateSyllableSimilarity : calculateSimilarity;
    let bestText = toComparableText(recognizedText);
    let bestSimilarity = compareText(currentItem.text, bestText);
    for (const alt of alternativesRef.current) {
      const candidateText = toComparableText(alt.transcript);
      const sim = compareText(currentItem.text, candidateText);
      if (sim > bestSimilarity) {
        bestSimilarity = sim;
        bestText = candidateText;
      }
    }

    const similarity = bestSimilarity;
    const result = classifyResult(similarity);
    const errorTypes = detectErrors(currentItem.text, bestText);
    const attempt: ExerciseAttempt = {
      itemId: currentItem.id,
      expected: currentItem.text,
      recognized: bestText,
      result,
      similarity,
      errorTypes,
      timeMs,
      timestamp: Date.now(),
    };
    const updatedAttempts = [...attemptsRef.current, attempt];
    attemptsRef.current = updatedAttempts;
    setAttempts(updatedAttempts);

    if (index + 1 < items.length) {
      setIndex((i) => i + 1);
      setPhase('ready');
      return;
    }

    void completeSession(updatedAttempts);
  }, [currentItem, clearTimer, index, items.length, completeSession]);

  const handleReadTimeout = useCallback(() => {
    if (phaseRef.current !== 'listening' || timedOutRef.current || !currentItem) return;
    clearTimer(readTimeoutRef);
    setTimeLeftMs(0);
    timedOutRef.current = true;

    const finalizeNoSpeech = () => {
      const attempt: ExerciseAttempt = {
        itemId: currentItem.id,
        expected: currentItem.text,
        recognized: '',
        result: 'incorrect',
        similarity: 0,
        errorTypes: detectErrors(currentItem.text, ''),
        timeMs: Date.now() - startTimeRef.current,
        timestamp: Date.now(),
      };
      const updatedAttempts = [...attemptsRef.current, attempt];
      attemptsRef.current = updatedAttempts;
      setAttempts(updatedAttempts);

      if (index + 1 < items.length) {
        setIndex((i) => i + 1);
        setPhase('ready');
        return;
      }

      void completeSession(updatedAttempts);
    };

    const tryFinalizeFromCapturedSpeech = () => {
      const recognized = transcriptRef.current.trim();
      stop();
      if (recognized) {
        evaluateCurrentAttempt(recognized, true);
        return;
      }
      finalizeNoSpeech();
    };

    const recognizedAtTimeout = transcriptRef.current.trim();
    if (recognizedAtTimeout) {
      stop();
      evaluateCurrentAttempt(recognizedAtTimeout, true);
      return;
    }

    const graceMs = useWhisper
      ? WHISPER_SPEECH_GRACE_MS
      : currentDurationMsRef.current <= 1000
        ? SHORT_TIMER_SPEECH_GRACE_MS
        : SPEECH_GRACE_MS;
    clearTimer(graceTimeoutRef);
    graceTimeoutRef.current = window.setTimeout(tryFinalizeFromCapturedSpeech, graceMs);
  }, [clearTimer, stop, currentItem, index, items.length, completeSession, evaluateCurrentAttempt, useWhisper]);

  useEffect(() => {
    attemptsRef.current = attempts;
  }, [attempts]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    alternativesRef.current = alternatives;
  }, [alternatives]);

  useEffect(() => {
    if (items.length === 0) {
      setPhase('done');
      return;
    }
    if (phase !== 'ready' || settingsLoading) return;
    // Ensure any previous recognition instance is fully stopped before restarting.
    stop();
    setTranscript('');
    transcriptRef.current = '';
    timedOutRef.current = false;
    const configuredSeconds = settings.exerciseSpeeds?.[set.type] ?? settings.speed;
    const durationMs = Math.max(1000, Math.round(configuredSeconds * 1000));
    currentDurationMsRef.current = durationMs;
    startTimeRef.current = Date.now();
    itemDeadlineRef.current = startTimeRef.current + durationMs;
    setTimeLeftMs(durationMs);
    setPhase('listening');
    start();
    readTimeoutRef.current = window.setTimeout(handleReadTimeout, durationMs);

    return () => {
      clearTimer(readTimeoutRef);
    };
  }, [phase, settingsLoading, settings.speed, settings.exerciseSpeeds, set.type, start, stop, setTranscript, clearTimer, evaluateCurrentAttempt, handleReadTimeout]);

  useEffect(() => {
    if (phase !== 'listening') return;
    const intervalId = window.setInterval(() => {
      const remaining = Math.max(0, itemDeadlineRef.current - Date.now());
      if (remaining <= 0) {
        handleReadTimeout();
        return;
      }
      setTimeLeftMs(remaining);
    }, 100);
    return () => window.clearInterval(intervalId);
  }, [phase, handleReadTimeout]);

  // When recognition ends automatically, evaluate and transition to result phase
  useEffect(() => {
    if (phase !== 'listening' || timedOutRef.current || isListening) return;
    const recognized = transcriptRef.current.trim();
    if (!recognized) return;
    evaluateCurrentAttempt(recognized);
  }, [isListening, phase, evaluateCurrentAttempt]);

  useEffect(() => () => {
    clearTimer(readTimeoutRef);
    clearTimer(graceTimeoutRef);
    stop();
  }, [clearTimer, stop]);

  if (phase === 'done') {
    const correctItems = attempts.filter((a) => a.result === 'correct').length;
    const score = calculateScore(correctItems, attempts.length);
    return (
      <div className={`page ${styles.done}`}>
        <span className={styles.doneEmoji}>{score >= 80 ? '🎉' : score >= 50 ? '👍' : '💪'}</span>
        <h1 className={styles.doneTitle}>Exercici completat!</h1>
        <div className={`card ${styles.scoreCard}`}>
          <div className={styles.scoreValue}>{score}%</div>
          <div className="text-muted">de respostes correctes</div>
          <div className={styles.scoreDetail}>
            {correctItems} de {attempts.length} elements llegits bé
          </div>
        </div>
        <div className={`card ${styles.summaryCard}`}>
          <h2 className={styles.summaryTitle}>Resum de l&apos;exercici</h2>
          {attempts.map((attempt, attemptIndex) => {
            const isCorrect = attempt.result === 'correct';
            const statusLabel = isCorrect ? 'Bé' : 'No';
            const recognizedLabel = attempt.recognized.trim() ? attempt.recognized : 'Sense resposta';

            return (
              <div key={`${attempt.itemId}-${attempt.timestamp}`} className={styles.summaryRow}>
                <div className={styles.summaryHeader}>
                  <span className={styles.summaryIndex}>#{attemptIndex + 1}</span>
                  <span className={isCorrect ? styles.summaryOk : styles.summaryBad}>{statusLabel}</span>
                </div>
                <div className={styles.summaryLine}><strong>Esperat:</strong> {attempt.expected}</div>
                <div className={styles.summaryLine}><strong>Has dit:</strong> {recognizedLabel}</div>
              </div>
            );
          })}
        </div>
        <Button size="lg" onClick={onFinish}>
          🏠 Tornar a l&apos;inici
        </Button>
      </div>
    );
  }

  if (!currentItem) {
    return (
      <div className={`page ${styles.done}`}>
        <Button size="lg" onClick={onFinish}>
          🏠 Tornar a l&apos;inici
        </Button>
      </div>
    );
  }

  return (
    <div className={`page ${styles.runner}`}>
      {/* Progress */}
      <div className={styles.progress}>
        <span className="text-muted">{index + 1} / {items.length}</span>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${((index) / items.length) * 100}%` }} />
        </div>
        <button className={styles.closeBtn} onClick={onFinish} aria-label="Sortir">✕</button>
      </div>

      {/* Instruction */}
      <p className={`text-muted ${styles.instruction}`}>🎤 Llegeix en veu alta el text que apareix a la pantalla</p>

      {set.type === 'sounds' && (
        <div className={styles.soundHint} role="note" aria-live="polite">
          <strong>🔊 Mode sons:</strong> digues només el so d&apos;una lletra (per exemple: <em>"b"</em>, <em>"a"</em>, <em>"r"</em>).
        </div>
      )}

      {/* Text to read */}
      <ExerciseText text={currentItem.text} />

      {/* Error display */}
      {error && <p className="text-error text-center">{error}</p>}
      {!isSupported && <p className="text-error text-center">🎤 Micròfon no disponible en aquest navegador</p>}

      {/* Controls */}
      <div className={styles.controls}>
        {phase === 'listening' && (
          <p className="text-muted">⏱️ Temps restant: {Math.ceil(timeLeftMs / 1000)}s</p>
        )}
      </div>
    </div>
  );
}
