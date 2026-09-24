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

export type PokemonExerciseType = ExerciseType;

export interface PokemonPath {
  pathId: string;
  pokemonId: number;
  fallbackName: string;
  exerciseType: PokemonExerciseType;
  difficulty: Difficulty;
  setIds: string[];
  minScorePercent: number;
  minCompletedSessions: number;
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

export type BattleTeamSize = 1 | 3 | 6;
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

const POKEMON_CORE_STAGE_THRESHOLDS = [
  { key: 'bronze', label: 'Bronze', minScorePercent: 40, minCompletedSessions: 1, powerBonus: 0 },
  { key: 'silver', label: 'Plata', minScorePercent: 60, minCompletedSessions: 1, powerBonus: 12 },
  { key: 'gold', label: 'Or', minScorePercent: 80, minCompletedSessions: 1, powerBonus: 28 },
  { key: 'legend', label: 'Llegenda', minScorePercent: 95, minCompletedSessions: 1, powerBonus: 46 },
  { key: 'master', label: 'Mestre', minScorePercent: 100, minCompletedSessions: 1, powerBonus: 58 },
] as const;

const POKEMON_HARD_BONUS_STAGE_THRESHOLDS = [
  { key: 'master-2', label: 'Mestre II', minScorePercent: 100, minCompletedSessions: 2, powerBonus: 70 },
] as const;

const POKEMON_TRACKS = [
  {
    exerciseType: 'sounds' as const,
    basePower: 12,
    description: 'La branca de sons reforça la discriminació auditiva amb reptes bàsics i avançats.',
    setIds: ['sounds-easy-1', 'sounds-medium-1', 'sounds-hard-1', 'sounds-easy-2', 'sounds-medium-2', 'sounds-hard-2'],
    bonusStageSetIds: [] as string[],
  },
  {
    exerciseType: 'syllables' as const,
    basePower: 18,
    description: 'La branca de síl·labes creix des del bàsic fins al gran repte de 100.',
    setIds: ['syl-easy-1', 'syl-easy-2', 'syl-easy-3', 'syl-medium-1', 'syl-medium-2', 'syl-medium-3', 'syl-hard-100', 'syl-random-50', 'syl-direct-indirect-50', 'syl-hard-2', 'syl-easy-4', 'syl-medium-4', 'syl-easy-5', 'syl-easy-6', 'syl-medium-5', 'syl-medium-6', 'syl-hard-3', 'syl-hard-4'],
    bonusStageSetIds: ['syl-hard-100', 'syl-random-50', 'syl-direct-indirect-50', 'syl-hard-2', 'syl-hard-3', 'syl-hard-4'],
  },
  {
    exerciseType: 'words' as const,
    basePower: 28,
    description: 'La branca de paraules transforma cada percentatge en més potència d’atac.',
    setIds: ['words-easy-1', 'words-easy-2', 'words-easy-3', 'words-easy-4', 'words-easy-5', 'words-medium-1', 'words-medium-2', 'words-medium-3', 'words-hard-1', 'words-hard-2', 'words-hard-3', 'w-hard-100', 'words-random-50', 'words-hard-4', 'words-easy-6', 'words-medium-4', 'words-easy-7', 'words-easy-8', 'words-medium-5', 'words-medium-6', 'words-hard-5', 'words-hard-6'],
    bonusStageSetIds: ['words-hard-1', 'words-hard-2', 'words-hard-3', 'w-hard-100', 'words-random-50', 'words-hard-4', 'words-hard-5', 'words-hard-6'],
  },
  {
    exerciseType: 'pseudowords' as const,
    basePower: 34,
    description: 'La branca de pseudoparaules premia la descodificació i la fluïdesa lectora.',
    setIds: ['pseudo-easy-1', 'pseudo-easy-2', 'pseudo-easy-3', 'pseudo-medium-1', 'pseudo-medium-2', 'pseudo-medium-3', 'pseudo-hard-1', 'pseudo-hard-2', 'pseudo-hard-3', 'p-hard-100'],
    bonusStageSetIds: ['pseudo-hard-1', 'pseudo-hard-2', 'pseudo-hard-3', 'p-hard-100'],
  },
  {
    exerciseType: 'sentences' as const,
    basePower: 42,
    description: 'La branca de frases culmina en el Pokémon més tècnic i llegendari.',
    setIds: ['sent-easy-1', 'sent-easy-2', 'sent-easy-3', 'sent-medium-1', 'sent-medium-2', 'sent-medium-3', 'sent-hard-1', 'sent-hard-2', 'sent-hard-3', 'f-hard-100', 'sent-hard-4', 'sent-easy-4', 'sent-medium-4', 'sent-easy-5', 'sent-easy-6', 'sent-medium-5', 'sent-medium-6', 'sent-hard-5', 'sent-hard-6'],
    bonusStageSetIds: ['sent-hard-1', 'sent-hard-2', 'sent-hard-3', 'f-hard-100', 'sent-hard-4', 'sent-hard-5', 'sent-hard-6'],
  },
] as const;

const FIXED_POKEMON_PATHS = {
  'syl-hard-2-bronze': { pokemonId: 232, fallbackName: 'Donphan' },
  'syl-hard-2-silver': { pokemonId: 231, fallbackName: 'Phanpy' },
  'syl-hard-2-gold': { pokemonId: 230, fallbackName: 'Kingdra' },
  'syl-hard-2-legend': { pokemonId: 249, fallbackName: 'Lugia' },
  'syl-hard-100-bronze': { pokemonId: 233, fallbackName: 'Porygon2' },
  'syl-hard-100-silver': { pokemonId: 234, fallbackName: 'Stantler' },
  'syl-hard-100-gold': { pokemonId: 235, fallbackName: 'Smeargle' },
  'words-hard-4-bronze': { pokemonId: 237, fallbackName: 'Hitmontop' },
  'words-hard-4-silver': { pokemonId: 238, fallbackName: 'Smoochum' },
  'words-hard-4-gold': { pokemonId: 239, fallbackName: 'Elekid' },
  'words-hard-4-legend': { pokemonId: 250, fallbackName: 'Ho-Oh' },
  'words-hard-3-gold': { pokemonId: 240, fallbackName: 'Magby' },
  'pseudo-hard-3-bronze': { pokemonId: 241, fallbackName: 'Miltank' },
  'pseudo-hard-3-silver': { pokemonId: 242, fallbackName: 'Blissey' },
  'pseudo-hard-3-gold': { pokemonId: 236, fallbackName: 'Tyrogue' },
  'pseudo-hard-3-legend': { pokemonId: 384, fallbackName: 'Rayquaza' },
  'sent-hard-4-gold': { pokemonId: 246, fallbackName: 'Larvitar' },
  'sent-hard-4-legend': { pokemonId: 487, fallbackName: 'Giratina' },
  'sent-hard-3-bronze': { pokemonId: 247, fallbackName: 'Pupitar' },
  'sent-hard-3-silver': { pokemonId: 248, fallbackName: 'Tyranitar' },
} as const;

const RESERVED_POKEMON_IDS = new Set<number>(
  Object.values(FIXED_POKEMON_PATHS).map(({ pokemonId }) => pokemonId),
);

function buildPokemonPaths(): PokemonPath[] {
  const paths: PokemonPath[] = [];
  const assignedPokemonIds = new Set<number>();
  let pokemonId = 1;
  while (RESERVED_POKEMON_IDS.has(pokemonId) || assignedPokemonIds.has(pokemonId)) pokemonId += 1;

  for (const track of POKEMON_TRACKS) {
    for (const setId of track.setIds) {
      const difficulty = setId.includes('easy') ? 'easy' : setId.includes('medium') ? 'medium' : 'hard';
      const stageThresholds = track.bonusStageSetIds.some((bonusStageSetId) => bonusStageSetId === setId)
        ? [...POKEMON_CORE_STAGE_THRESHOLDS, ...POKEMON_HARD_BONUS_STAGE_THRESHOLDS]
        : POKEMON_CORE_STAGE_THRESHOLDS;

      for (const stage of stageThresholds) {
        const pathId = `${setId}-${stage.key}`;
        const fixedPokemon = FIXED_POKEMON_PATHS[pathId as keyof typeof FIXED_POKEMON_PATHS];
        let assignedPokemonId = fixedPokemon?.pokemonId ?? pokemonId;
        if (!fixedPokemon) {
          while (RESERVED_POKEMON_IDS.has(assignedPokemonId) || assignedPokemonIds.has(assignedPokemonId)) {
            assignedPokemonId += 1;
          }
        } else if (assignedPokemonIds.has(assignedPokemonId)) {
          continue;
        }
        assignedPokemonIds.add(assignedPokemonId);

        paths.push({
          pathId,
          pokemonId: assignedPokemonId,
          fallbackName: fixedPokemon?.fallbackName ?? `Pokémon ${assignedPokemonId}`,
          exerciseType: track.exerciseType,
          difficulty,
          setIds: [setId],
          minScorePercent: stage.minScorePercent,
          minCompletedSessions: stage.minCompletedSessions,
          basePower: track.basePower + stage.powerBonus,
          tierLabel: stage.label,
          description: `${track.description} Objectiu mínim: ${stage.minScorePercent}% en ${stage.minCompletedSessions} sessió/ns.`,
        });

        if (!fixedPokemon) {
          pokemonId = assignedPokemonId + 1;
          while (RESERVED_POKEMON_IDS.has(pokemonId) || assignedPokemonIds.has(pokemonId)) pokemonId += 1;
        }
      }
    }
  }

  return paths;
}

export const POKEMON_PATHS: PokemonPath[] = buildPokemonPaths();


/** Number of exercises a player must complete each day to meet the daily goal. */
export const DAILY_GOAL_TARGET = 5;
