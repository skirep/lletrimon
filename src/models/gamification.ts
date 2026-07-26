import type { Difficulty, ExerciseType } from './exercise';

/**
 * Gamification model: badges, Pokémon rewards, daily goals and streaks.
 *
 * Achievement flow overview
 * ─────────────────────────
 * 1. After every exercise session the gamificationService evaluates which
 *    badges the player has newly earned.
 * 2. A badge is awarded at most once per profile.  The set of eligible badges
 *    is defined by BADGES and the unlock conditions are checked in
 *    gamificationService.processSession().
 * 3. Pokémon are now tied to explicit exercise paths:
 *    - each Pokémon has one or more assigned exercise sets
 *    - completing those sets increases its progress and battle power
 *    - more advanced exercise groups yield stronger Pokémon
 */

export type BadgeId =
  | 'first_exercise'
  | 'streak_3'
  | 'streak_7'
  | 'streak_30'
  | 'perfect_10'
  | 'speed_reader'
  | 'syllable_master'
  | 'word_master'
  | 'sentence_master'
  | 'level_5'
  | 'level_10';

export interface Badge {
  id: BadgeId;
  name: string;
  description: string;
  icon: string;
  condition: string;
}

export interface ProfileBadge {
  profileId: string;
  badgeId: BadgeId;
  earnedAt: number;
}

export type PokemonExerciseType = Exclude<ExerciseType, 'pseudowords' | 'sounds'>;

export interface PokemonPath {
  pathId: string;
  pokemonId: number;
  fallbackName: string;
  exerciseType: PokemonExerciseType;
  difficulty: Difficulty;
  setIds: string[];
  minScorePercent: number;
  basePower: number;
  tierLabel: string;
  description: string;
}

export interface PokemonDetails {
  id: number;
  name: string;
  imageUrl: string | null;
}

export interface PokemonCollectionItem extends PokemonPath, PokemonDetails {
  unlocked: boolean;
  unlockCondition: string;
  assignedExerciseTitles: string[];
  completedSetIds: string[];
  completedSessions: number;
  progressPercent: number;
  bestScore: number;
  power: number;
  specialAttackUnlocked: boolean;
  specialAttackName: string | null;
  specialAttackCondition: string | null;
}

export type BattleTeamSize = 1 | 3;
export type BattleChallengeStatus = 'pending' | 'accepted' | 'declined' | 'completed';

export interface BattlePokemon {
  pokemonId: number;
  name: string;
  imageUrl: string | null;
  power: number;
}

export interface BattleResult {
  winnerProfileId: string;
  challengerScore: number;
  opponentScore: number;
  summary: string;
}

export interface BattleChallenge {
  id: string;
  challengerProfileId: string;
  opponentProfileId: string;
  challengerName: string;
  opponentName: string;
  teamSize: BattleTeamSize;
  challengerTeam: BattlePokemon[];
  opponentTeam: BattlePokemon[] | null;
  status: BattleChallengeStatus;
  result: BattleResult | null;
  createdAt: number;
  respondedAt: number | null;
  simulatedAt: number | null;
}

export interface DailyGoal {
  profileId: string;
  date: string;
  targetExercises: number;
  completedExercises: number;
  completed: boolean;
}

export interface Streak {
  profileId: string;
  current: number;
  longest: number;
  lastDate: string;
}

/** Full catalogue of streak and mastery badges displayed on the Badges page. */
export const BADGES: Record<BadgeId, Badge> = {
  first_exercise: {
    id: 'first_exercise',
    name: 'Primer Pas',
    description: 'Has completat el teu primer exercici!',
    icon: '⭐',
    condition: 'Completa 1 exercici',
  },
  streak_3: {
    id: 'streak_3',
    name: 'Constant',
    description: '3 dies consecutius llegint!',
    icon: '🔥',
    condition: '3 dies de ratxa',
  },
  streak_7: {
    id: 'streak_7',
    name: 'Setmana de Foc',
    description: '7 dies consecutius llegint!',
    icon: '🔥🔥',
    condition: '7 dies de ratxa',
  },
  streak_30: {
    id: 'streak_30',
    name: 'Lector Imparable',
    description: '30 dies consecutius llegint!',
    icon: '🏆',
    condition: '30 dies de ratxa',
  },
  perfect_10: {
    id: 'perfect_10',
    name: 'Perfecte!',
    description: 'Has encertat 10 exercicis seguits!',
    icon: '💯',
    condition: '10 encerts seguits',
  },
  speed_reader: {
    id: 'speed_reader',
    name: 'Lector Ràpid',
    description: 'Has llegit 5 paraules en menys de 2 segons cadascuna!',
    icon: '⚡',
    condition: 'Llegeix 5 paraules ràpides',
  },
  syllable_master: {
    id: 'syllable_master',
    name: 'Mestre de Síl·labes',
    description: 'Has completat 20 exercicis de síl·labes!',
    icon: '🎯',
    condition: '20 exercicis de síl·labes',
  },
  word_master: {
    id: 'word_master',
    name: 'Mestre de Paraules',
    description: 'Has completat 20 exercicis de paraules!',
    icon: '📚',
    condition: '20 exercicis de paraules',
  },
  sentence_master: {
    id: 'sentence_master',
    name: 'Mestre de Frases',
    description: 'Has completat 10 exercicis de frases!',
    icon: '📖',
    condition: '10 exercicis de frases',
  },
  level_5: {
    id: 'level_5',
    name: 'Nivell 5',
    description: 'Has arribat al nivell 5!',
    icon: '🌟',
    condition: 'Arriba al nivell 5',
  },
  level_10: {
    id: 'level_10',
    name: 'Nivell 10',
    description: 'Has arribat al nivell 10!',
    icon: '👑',
    condition: 'Arriba al nivell 10',
  },
};

const POKEMON_STAGE_THRESHOLDS = [
  { key: 'bronze', label: 'Bronze', minScorePercent: 40, powerBonus: 0 },
  { key: 'silver', label: 'Plata', minScorePercent: 60, powerBonus: 12 },
  { key: 'gold', label: 'Or', minScorePercent: 80, powerBonus: 28 },
  { key: 'legend', label: 'Llegenda', minScorePercent: 95, powerBonus: 46 },
] as const;

const POKEMON_TRACKS = [
  {
    exerciseType: 'syllables' as const,
    basePower: 18,
    description: 'La branca de síl·labes creix des del bàsic fins al gran repte de 100.',
    setIds: ['syl-easy-1', 'syl-easy-2', 'syl-easy-3', 'syl-medium-1', 'syl-medium-2', 'syl-medium-3', 'syl-hard-100'],
  },
  {
    exerciseType: 'words' as const,
    basePower: 28,
    description: 'La branca de paraules transforma cada percentatge en més potència d’atac.',
    setIds: ['words-easy-1', 'words-easy-2', 'words-easy-3', 'words-easy-4', 'words-easy-5', 'words-medium-1', 'words-medium-2', 'words-medium-3', 'words-hard-1', 'words-hard-2', 'words-hard-3', 'w-hard-100'],
  },
  {
    exerciseType: 'sentences' as const,
    basePower: 42,
    description: 'La branca de frases culmina en el Pokémon més tècnic i llegendari.',
    setIds: ['sent-easy-1', 'sent-easy-2', 'sent-easy-3', 'sent-medium-1', 'sent-medium-2', 'sent-medium-3', 'sent-hard-1', 'sent-hard-2', 'sent-hard-3', 'f-hard-100'],
  },
] as const;

function buildPokemonPaths(): PokemonPath[] {
  const paths: PokemonPath[] = [];
  let pokemonId = 1;

  for (const track of POKEMON_TRACKS) {
    for (const setId of track.setIds) {
      for (const stage of POKEMON_STAGE_THRESHOLDS) {
        const isLegendarySentencePath = track.exerciseType === 'sentences' && setId === 'f-hard-100' && stage.key === 'legend';
        const assignedPokemonId = isLegendarySentencePath ? 151 : pokemonId;

        paths.push({
          pathId: `${setId}-${stage.key}`,
          pokemonId: assignedPokemonId,
          fallbackName: isLegendarySentencePath ? 'Mew' : `Pokémon ${assignedPokemonId}`,
          exerciseType: track.exerciseType,
          difficulty: setId.includes('easy') ? 'easy' : setId.includes('medium') ? 'medium' : 'hard',
          setIds: [setId],
          minScorePercent: stage.minScorePercent,
          basePower: track.basePower + stage.powerBonus,
          tierLabel: stage.label,
          description: `${track.description} Objectiu mínim: ${stage.minScorePercent}%.`,
        });

        if (!isLegendarySentencePath) {
          pokemonId += 1;
        }
      }
    }
  }

  return paths;
}

export const POKEMON_PATHS: PokemonPath[] = buildPokemonPaths();


/** Number of exercises a player must complete each day to meet the daily goal. */
export const DAILY_GOAL_TARGET = 5;
