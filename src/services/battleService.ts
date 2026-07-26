import { supabase } from '../lib/supabase';
import type {
  BattleChallenge,
  BattleChallengeStatus,
  BattlePokemon,
  BattleResult,
  BattleTeamSize,
} from '../models';
import type { RankingEntry } from '../storage/profileStorage';
import { loadRankings } from '../storage/profileStorage';

interface BattleRow {
  id: string;
  challenger_profile_id: string;
  opponent_profile_id: string;
  team_size: number;
  challenger_team: BattlePokemon[];
  opponent_team: BattlePokemon[] | null;
  status: BattleChallengeStatus;
  result: BattleResult | null;
  created_at: number;
  responded_at: number | null;
  simulated_at: number | null;
}

function mapChallenge(row: BattleRow, names: Map<string, string>): BattleChallenge {
  return {
    id: row.id,
    challengerProfileId: row.challenger_profile_id,
    opponentProfileId: row.opponent_profile_id,
    challengerName: names.get(row.challenger_profile_id) ?? 'Entrenador',
    opponentName: names.get(row.opponent_profile_id) ?? 'Entrenador',
    teamSize: row.team_size as BattleTeamSize,
    challengerTeam: row.challenger_team,
    opponentTeam: row.opponent_team,
    status: row.status,
    result: row.result,
    createdAt: row.created_at,
    respondedAt: row.responded_at,
    simulatedAt: row.simulated_at,
  };
}

async function getNames(): Promise<{ rankings: RankingEntry[]; names: Map<string, string> }> {
  const rankings = await loadRankings();
  return {
    rankings,
    names: new Map(rankings.map((ranking) => [ranking.profileId, ranking.displayName])),
  };
}

async function throwIfError(error: { message: string } | null): Promise<void> {
  if (error) throw new Error(error.message);
}

export const battleService = {
  async list(profileId: string): Promise<{ challenges: BattleChallenge[]; rivals: RankingEntry[] }> {
    const [{ data, error }, { rankings, names }] = await Promise.all([
      supabase
        .from('battle_challenges')
        .select('*')
        .or(`challenger_profile_id.eq.${profileId},opponent_profile_id.eq.${profileId}`)
        .order('created_at', { ascending: false }),
      getNames(),
    ]);
    await throwIfError(error);
    return {
      challenges: ((data ?? []) as BattleRow[]).map((row) => mapChallenge(row, names)),
      rivals: rankings.filter((ranking) => ranking.profileId !== profileId),
    };
  },

  async create(
    challengerProfileId: string,
    opponentProfileId: string,
    teamSize: BattleTeamSize,
    challengerTeam: BattlePokemon[],
  ): Promise<void> {
    const { error } = await supabase.from('battle_challenges').insert({
      challenger_profile_id: challengerProfileId,
      opponent_profile_id: opponentProfileId,
      team_size: teamSize,
      challenger_team: challengerTeam,
    });
    await throwIfError(error);
  },

  async respond(challengeId: string, accept: boolean, team: BattlePokemon[] | null): Promise<void> {
    const { error } = await supabase.rpc('respond_to_battle_challenge', {
      challenge_id: challengeId,
      accept_challenge: accept,
      selected_team: team,
    });
    await throwIfError(error);
  },

  async open(challengeId: string): Promise<void> {
    const { error } = await supabase.rpc('open_battle_challenge', { challenge_id: challengeId });
    await throwIfError(error);
  },
};