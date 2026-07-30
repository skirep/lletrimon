import { profileStorage, gamificationStorage, sessionStorage } from '../storage';
import { BADGES, type BadgeId, type PokemonCollectionItem } from '../models';
import { calculateXpGained } from '../scoring';
import { getNewlyUnlockedPokemon } from './pokemonCollection';
import type { ExerciseSession } from '../models';

export interface GamificationResult {
  xpGained: number;
  newBadges: BadgeId[];
  newPokemon: PokemonCollectionItem[];
  levelUp: boolean;
  newLevel: number;
  streakUpdated: boolean;
  newStreak: number;
  dailyGoalCompleted: boolean;
}

/**
 * gamificationService – processes an exercise session and awards XP, badges,
 * updates streaks and daily goals.
 *
 * Call processSession() immediately after saving a completed ExerciseSession.
 * It runs all reward checks atomically and returns a GamificationResult that
 * callers can use to display congratulation overlays to the player.
 */
export const gamificationService = {
  /**
   * Process a completed exercise session and update all gamification state.
   *
   * Steps performed:
   *  1. Calculate XP gained from score, difficulty and average response time.
   *  2. Add XP to the profile and detect a level-up.
   *  3. Update aggregate stats (totalExercises, totalCorrect, totalTimeMs…).
   *  4. Update the daily streak (increments if the player hasn't already
   *     logged an exercise today; resets if a day was missed).
   *  5. Increment the daily goal counter.
   *  6. Check every badge condition; award any that are newly met.
   *
   * @returns GamificationResult with XP gained, new badges, level-up flag,
   *          current streak and daily-goal completion status.
   */
  async processSession(session: ExerciseSession): Promise<GamificationResult> {
    const { profileId, difficulty, score, totalItems, correctItems } = session;
    const avgTime = session.averageTimeMs;
    const storedSessions = await sessionStorage.getAllByProfile(profileId);
    const nextSessions = storedSessions.some((storedSession) => storedSession.id === session.id)
      ? storedSessions
      : [...storedSessions, session];
    const previousSessions = nextSessions.filter((storedSession) => storedSession.id !== session.id);

    const xpGained = calculateXpGained(score, difficulty, avgTime);
    const statsBefore = await profileStorage.getStats(profileId);
    const statsAfter = await profileStorage.addExperience(profileId, xpGained);

    const levelUp = (statsBefore?.level ?? 1) < statsAfter.level;
    const newLevel = statsAfter.level;

    // Update stats
    const currentStats = await profileStorage.getStats(profileId);
    if (currentStats) {
      const updatedErrorFrequency = { ...currentStats.errorFrequency };
      for (const attempt of session.attempts) {
        for (const errorType of attempt.errorTypes) {
          updatedErrorFrequency[errorType] = (updatedErrorFrequency[errorType] ?? 0) + 1;
        }
      }

      const updatedStats = {
        ...currentStats,
        totalExercises: currentStats.totalExercises + 1,
        totalCorrect: currentStats.totalCorrect + correctItems,
        totalAttempts: currentStats.totalAttempts + totalItems,
        totalTimeMs: currentStats.totalTimeMs + (session.completedAt ?? 0) - session.startedAt,
        lastSessionDate: Date.now(),
        errorFrequency: updatedErrorFrequency,
      };
      await profileStorage.updateStats(updatedStats);
    }

    // Streak
    const streak = await gamificationStorage.updateStreak(profileId);
    const streakUpdated = streak.lastDate === new Date().toISOString().slice(0, 10);

    // Daily goal
    const dailyGoal = await gamificationStorage.incrementDailyGoal(profileId);

    // Badges
    const newBadges: BadgeId[] = [];
    const sessionCount = await sessionStorage.countByType(profileId, session.type);
    const newPokemon = await getNewlyUnlockedPokemon(previousSessions, nextSessions);

    const badgesToCheck: Array<{ id: BadgeId; condition: () => boolean }> = [
      { id: 'first_exercise', condition: () => sessionCount >= 1 },
      { id: 'streak_3', condition: () => streak.current >= 3 },
      { id: 'streak_7', condition: () => streak.current >= 7 },
      { id: 'streak_30', condition: () => streak.current >= 30 },
      { id: 'perfect_10', condition: () => score === 100 },
      { id: 'speed_reader', condition: () => avgTime < 2000 && correctItems >= 5 },
      { id: 'syllable_master', condition: () => session.type === 'syllables' && sessionCount >= 20 },
      { id: 'word_master', condition: () => session.type === 'words' && sessionCount >= 20 },
      { id: 'sentence_master', condition: () => session.type === 'sentences' && sessionCount >= 10 },
      { id: 'level_5', condition: () => newLevel >= 5 },
      { id: 'level_10', condition: () => newLevel >= 10 },
    ];

    for (const { id, condition } of badgesToCheck) {
      if (condition()) {
        const awarded = await gamificationStorage.awardBadge(profileId, id);
        if (awarded) newBadges.push(id);
      }
    }

    return {
      xpGained,
      newBadges,
      newPokemon,
      levelUp,
      newLevel,
      streakUpdated,
      newStreak: streak.current,
      dailyGoalCompleted: dailyGoal.completed && dailyGoal.completedExercises === dailyGoal.targetExercises,
    };
  },

  /** Returns all badge definitions (used to render the Badges/collection page). */
  async getAvailableBadges() {
    return Object.values(BADGES);
  },
};
