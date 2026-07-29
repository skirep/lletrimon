import { useState, useCallback, useEffect, useRef } from 'react';
import styles from './EndlessRunner.module.css';
import { ExerciseText, ResultFeedback } from '../components/exercise';
import { Button } from '../components/common';
import { useSettings, useSpeechRecognition } from '../hooks';
import { calculateSimilarity, calculateSyllableSimilarity, classifyResult, detectErrors, calculateScore } from '../scoring';
import { shuffleItems } from '../exercises';
import { sessionStorage } from '../storage';
import { gamificationService } from '../gamification';
import { generateId } from '../utils';
import { WhisperEngine } from '../speech';
import { Capacitor } from '@capacitor/core';
import type { ExerciseItem, Profile, ReadingResult, ExerciseAttempt, ExerciseSession, ExerciseType, Difficulty } from '../models';

interface EndlessRunnerProps {
  profile: Profile;
  itemPool: ExerciseItem[];
  label: string;
  sessionType: ExerciseType;
  sessionDifficulty: Difficulty;
  onFinish: () => void;
}

const CORRECT_DISPLAY_MS = 600;
const ERROR_DISPLAY_MS = 1500;
const WHISPER_SPEECH_GRACE_MS = 5000;

/** Web uses Whisper only for sounds; Android WebView uses it for every type. */
const WHISPER_TYPES = new Set<ExerciseType>(['sounds']);

export function EndlessRunner({ profile, itemPool, sessionType, sessionDifficulty, onFinish }: EndlessRunnerProps) {
  const { settings, loading: settingsLoading } = useSettings(profile.id);

  // Choose engine based on exercise type (same logic as ExerciseRunner).
  const useWhisper = Capacitor.getPlatform() === 'android' || WHISPER_TYPES.has(sessionType);
  const speechEngine = useRef(useWhisper ? new WhisperEngine() : undefined).current;
  const grammarHints = useRef(useWhisper ? [] : itemPool.map((item) => item.text)).current;

  const { transcript, alternatives, lastAudioBase64, isListening, error, isSupported, start, stop, setTranscript } = useSpeechRecognition(speechEngine, grammarHints);

  const shuffledPoolRef = useRef(shuffleItems(itemPool));
  const poolIndexRef = useRef(0);

  const firstItem = shuffledPoolRef.current[0] ?? itemPool[0];
  const [currentItem, setCurrentItem] = useState<ExerciseItem>(firstItem);
  const currentItemRef = useRef<ExerciseItem>(firstItem);

  const [streak, setStreak] = useState(0);
  const streakRef = useRef(0);

  const [phase, setPhase] = useState<'ready' | 'listening' | 'paused' | 'result' | 'done'>('ready');
  const phaseRef = useRef<'ready' | 'listening' | 'paused' | 'result' | 'done'>('ready');

  const [lastResult, setLastResult] = useState<{ result: ReadingResult; recognized: string; similarity: number } | null>(null);
  const [timeLeftMs, setTimeLeftMs] = useState(0);

  const transcriptRef = useRef('');
  const alternativesRef = useRef<Array<{ transcript: string; confidence: number }>>([]);
  const startTimeRef = useRef(0);
  const sessionStartRef = useRef(Date.now());
  const itemDeadlineRef = useRef(0);
  const timedOutRef = useRef(false);
  const awaitingWhisperResultRef = useRef(false);
  const readTimeoutRef = useRef<number | null>(null);
  const graceTimeoutRef = useRef<number | null>(null);
  const nextTimeoutRef = useRef<number | null>(null);
  const resumeDurationMsRef = useRef<number | null>(null);
  const attemptsRef = useRef<ExerciseAttempt[]>([]);
  const completingRef = useRef(false);

  const clearTimer = useCallback((timer: { current: number | null }) => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const getNextItem = useCallback(() => {
    poolIndexRef.current++;
    if (poolIndexRef.current >= shuffledPoolRef.current.length) {
      shuffledPoolRef.current = shuffleItems(itemPool);
      poolIndexRef.current = 0;
    }
    const item = shuffledPoolRef.current[poolIndexRef.current];
    currentItemRef.current = item;
    setCurrentItem(item);
    return item;
  }, [itemPool]);

  const evaluateCurrentAttempt = useCallback((recognizedText: string) => {
    if (phaseRef.current !== 'listening' || timedOutRef.current) return;
    awaitingWhisperResultRef.current = false;
    clearTimer(readTimeoutRef);
    clearTimer(graceTimeoutRef);
    const timeMs = Date.now() - startTimeRef.current;

    // Try all speech alternatives and pick the one that best matches the expected text.
    const compareText = sessionType === 'syllables' ? calculateSyllableSimilarity : calculateSimilarity;
    let bestText = recognizedText;
    let bestSimilarity = compareText(currentItemRef.current.text, recognizedText);
    for (const alt of alternativesRef.current) {
      const sim = compareText(currentItemRef.current.text, alt.transcript);
      if (sim > bestSimilarity) {
        bestSimilarity = sim;
        bestText = alt.transcript;
      }
    }

    const similarity = bestSimilarity;
    const result = classifyResult(similarity);
    const attempt: ExerciseAttempt = {
      itemId: currentItemRef.current.id,
      expected: currentItemRef.current.text,
      recognized: bestText,
      recordedAudioBase64: sessionType === 'sounds' ? (lastAudioBase64 ?? undefined) : undefined,
      result,
      similarity,
      errorTypes: detectErrors(currentItemRef.current.text, bestText),
      timeMs,
      timestamp: Date.now(),
    };
    attemptsRef.current = [...attemptsRef.current, attempt];
    setLastResult({ result, recognized: bestText, similarity });
    if (result === 'correct') {
      streakRef.current++;
      setStreak(streakRef.current);
    }
    setPhase('result');
  }, [clearTimer, sessionType, lastAudioBase64]);

  const completeSession = useCallback(async (finalAttempts: ExerciseAttempt[]) => {
    if (completingRef.current) return;
    completingRef.current = true;

    if (finalAttempts.length === 0) {
      return;
    }

    const completedAt = Date.now();
    const correctItems = finalAttempts.filter((attempt) => attempt.result === 'correct').length;
    const totalItems = finalAttempts.length;
    const score = calculateScore(correctItems, totalItems);
    const averageTimeMs = Math.round(
      finalAttempts.reduce((acc, attempt) => acc + attempt.timeMs, 0) / totalItems,
    );
    const session: ExerciseSession = {
      id: generateId(),
      profileId: profile.id,
      setId: `endless-${sessionType}-${sessionDifficulty}`,
      type: sessionType,
      difficulty: sessionDifficulty,
      attempts: finalAttempts,
      startedAt: sessionStartRef.current,
      completedAt,
      score,
      totalItems,
      correctItems,
      averageTimeMs,
    };

    try {
      await sessionStorage.save(session);
    } catch (err) {
      console.error('Error saving endless session:', err);
    }

    try {
      await gamificationService.processSession(session);
    } catch (err) {
      console.error('Error processing endless gamification:', err);
    }
  }, [profile.id, sessionDifficulty, sessionType]);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);
  useEffect(() => { alternativesRef.current = alternatives; }, [alternatives]);

  // ready → listening
  useEffect(() => {
    if (phase !== 'ready' || settingsLoading) return;
    setTranscript('');
    transcriptRef.current = '';
    setLastResult(null);
    timedOutRef.current = false;
    awaitingWhisperResultRef.current = false;
    const configuredSeconds = settings.exerciseSpeeds?.[sessionType] ?? settings.speed;
    const configuredDurationMs = Math.max(1000, Math.round(configuredSeconds * 1000));
    const durationMs = resumeDurationMsRef.current ?? configuredDurationMs;
    resumeDurationMsRef.current = null;
    startTimeRef.current = Date.now();
    itemDeadlineRef.current = startTimeRef.current + durationMs;
    setTimeLeftMs(durationMs);
    setPhase('listening');
    start();
    readTimeoutRef.current = window.setTimeout(() => {
      awaitingWhisperResultRef.current = useWhisper;
      stop();
      setTimeLeftMs(0);
      if (useWhisper) {
        graceTimeoutRef.current = window.setTimeout(() => {
          awaitingWhisperResultRef.current = false;
          timedOutRef.current = true;
          setPhase('done');
        }, WHISPER_SPEECH_GRACE_MS);
      } else {
        timedOutRef.current = true;
        setPhase('done');
      }
    }, durationMs);
    return () => {
      clearTimer(readTimeoutRef);
      clearTimer(graceTimeoutRef);
    };
  }, [phase, settingsLoading, settings.speed, settings.exerciseSpeeds, sessionType, start, stop, setTranscript, clearTimer, evaluateCurrentAttempt, useWhisper]);

  // Timer countdown
  useEffect(() => {
    if (phase !== 'listening') return;
    const intervalId = window.setInterval(() => {
      setTimeLeftMs(Math.max(0, itemDeadlineRef.current - Date.now()));
    }, 100);
    return () => window.clearInterval(intervalId);
  }, [phase]);

  // When recognition ends naturally
  useEffect(() => {
    if (isListening || phase !== 'listening' || timedOutRef.current) return;
    if (awaitingWhisperResultRef.current && !transcript.trim()) return;
    evaluateCurrentAttempt(transcriptRef.current);
  }, [isListening, phase, transcript, evaluateCurrentAttempt]);

  // result → next or done
  useEffect(() => {
    if (phase !== 'result' || !lastResult) return;
    const delay = lastResult.result === 'correct' ? CORRECT_DISPLAY_MS : ERROR_DISPLAY_MS;
    nextTimeoutRef.current = window.setTimeout(() => {
      if (lastResult.result === 'correct') {
        getNextItem();
        setPhase('ready');
      } else {
        setPhase('done');
      }
    }, delay);
    return () => { clearTimer(nextTimeoutRef); };
  }, [phase, lastResult, getNextItem, clearTimer]);

  useEffect(() => {
    if (phase === 'done') {
      void completeSession(attemptsRef.current);
    }
  }, [phase, completeSession]);

  // Cleanup on unmount
  useEffect(() => () => {
    awaitingWhisperResultRef.current = false;
    clearTimer(readTimeoutRef);
    clearTimer(graceTimeoutRef);
    clearTimer(nextTimeoutRef);
    stop();
  }, [clearTimer, stop]);

  const handlePlayAgain = useCallback(() => {
    shuffledPoolRef.current = shuffleItems(itemPool);
    poolIndexRef.current = 0;
    const item = shuffledPoolRef.current[0];
    currentItemRef.current = item;
    setCurrentItem(item);
    attemptsRef.current = [];
    sessionStartRef.current = Date.now();
    completingRef.current = false;
    resumeDurationMsRef.current = null;
    streakRef.current = 0;
    setStreak(0);
    setLastResult(null);
    setPhase('ready');
  }, [itemPool]);

  const handlePause = useCallback(() => {
    if (phase !== 'listening') return;
    const remaining = Math.max(0, itemDeadlineRef.current - Date.now());
    setTimeLeftMs(remaining);
    resumeDurationMsRef.current = remaining;
    clearTimer(readTimeoutRef);
    clearTimer(graceTimeoutRef);
    stop();
    setPhase('paused');
  }, [phase, clearTimer, stop]);

  const handleResume = useCallback(() => {
    if (phase !== 'paused') return;
    setPhase('ready');
  }, [phase]);

  if (phase === 'done') {
    const s = streakRef.current;
    const emoji = s >= 20 ? '🏆' : s >= 10 ? '🎉' : s >= 5 ? '👍' : '💪';
    return (
      <div className={`page ${styles.done}`}>
        <span className={styles.doneEmoji}>{emoji}</span>
        <h1 className={styles.doneTitle}>Fi del joc!</h1>
        <div className={`card ${styles.streakCard}`}>
          <div className={styles.streakValue}>{s}</div>
          <div className="text-muted">{s === 1 ? 'encert seguit' : 'encerts seguits'}</div>
          {lastResult && lastResult.result !== 'correct' && (
            <div className={styles.lastAttempt}>
              <div>Esperada: <strong>{currentItem.text}</strong></div>
              {lastResult.recognized && (
                <div>Reconegut: <em>{lastResult.recognized}</em></div>
              )}
            </div>
          )}
          {!lastResult && (
            <div className={styles.lastAttempt}>Temps esgotat!</div>
          )}
        </div>
        <Button size="lg" variant="primary" onClick={handlePlayAgain}>
          🔄 Tornar a jugar
        </Button>
        <Button size="lg" onClick={onFinish}>
          🏠 Tornar a l&apos;inici
        </Button>
      </div>
    );
  }

  return (
    <div className={`page ${styles.runner}`}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.streak}>🔥 {streak}</span>
        <button className={styles.closeBtn} onClick={onFinish} aria-label="Sortir">✕</button>
      </div>

      {/* Instruction */}
      <p className={`text-muted ${styles.instruction}`}>🎤 Llegeix en veu alta · erra un cop i el joc s'acaba</p>

      <ExerciseText text={currentItem.text} />

      {error && <p className="text-error text-center">{error}</p>}
      {!isSupported && <p className="text-error text-center">🎤 Micròfon no disponible en aquest navegador</p>}

      {settings.showReadingFeedback && lastResult && (
        <ResultFeedback
          result={lastResult.result}
          expected={currentItem.text}
          recognized={lastResult.recognized}
          similarity={lastResult.similarity}
        />
      )}

      <div className={styles.controls}>
        {phase === 'listening' && (
          <>
            <p className="text-muted">⏱️ {Math.ceil(timeLeftMs / 1000)}s</p>
            <Button variant="secondary" size="sm" onClick={handlePause}>⏸️ Pausa</Button>
          </>
        )}
        {phase === 'paused' && (
          <>
            <p className="text-muted">Partida en pausa</p>
            <Button variant="primary" size="sm" onClick={handleResume}>▶️ Continuar</Button>
          </>
        )}
        {phase === 'result' && lastResult?.result === 'correct' && (
          <p className="text-muted">Preparant el següent...</p>
        )}
      </div>
    </div>
  );
}
