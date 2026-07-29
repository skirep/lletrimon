import { db } from './database';
import type { Profile, ProfileStats } from '../models';
import { getLevelFromXp, POKEMON_PATHS } from '../models';
import { supabase } from '../lib/supabase';

function createEmptyProfileStats(profileId: string): ProfileStats {
  return {
    profileId,
    totalExercises: 0,
    totalCorrect: 0,
    totalAttempts: 0,
    totalTimeMs: 0,
    consecutiveDays: 0,
    lastSessionDate: 0,
    experience: 0,
    level: 1,
    errorFrequency: {},
  };
}

async function syncToSupabase(profile: Profile): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from('profiles').upsert({
    id: profile.id,
    user_id: user.id,
    name: profile.name,
    avatar: profile.avatar,
    school: profile.school ?? null,
    location: profile.location ?? null,
    created_at: profile.createdAt,
    updated_at: profile.updatedAt,
  }, { onConflict: 'id' });
  if (error) {
    console.error('Failed to sync profile to Supabase:', error.message);
  }
}

async function syncStatsToSupabase(stats: ProfileStats): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from('profile_stats').upsert({
    profile_id: stats.profileId,
    total_exercises: stats.totalExercises,
    total_correct: stats.totalCorrect,
    total_attempts: stats.totalAttempts,
    total_time_ms: stats.totalTimeMs,
    consecutive_days: stats.consecutiveDays,
    last_session_date: stats.lastSessionDate,
    experience: stats.experience,
    level: stats.level,
    error_frequency: stats.errorFrequency,
  }, { onConflict: 'profile_id' });
  if (error) {
    console.error('Failed to sync stats to Supabase:', error.message);
  }
}

export async function loadStatsFromSupabase(profileId: string): Promise<ProfileStats | null> {
  const { data, error } = await supabase
    .from('profile_stats')
    .select('*')
    .eq('profile_id', profileId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    profileId: data.profile_id as string,
    totalExercises: data.total_exercises as number,
    totalCorrect: data.total_correct as number,
    totalAttempts: data.total_attempts as number,
    totalTimeMs: data.total_time_ms as number,
    consecutiveDays: data.consecutive_days as number,
    lastSessionDate: data.last_session_date as number,
    experience: data.experience as number,
    level: data.level as number,
    errorFrequency: (data.error_frequency as Record<string, number>) ?? {},
  };
}

async function syncRankingToSupabase(profile: Profile, stats: ProfileStats): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await syncToSupabase(profile);
  const sessions = await db.sessions.where('profileId').equals(profile.id).toArray();
  const pokemonIds = POKEMON_PATHS
    .filter((path) => sessions.some((session) => path.setIds.includes(session.setId) && session.score >= path.minScorePercent))
    .map((path) => path.pokemonId);
  const ranking = {
    profile_id: profile.id,
    display_name: profile.name,
    school: profile.school ?? null,
    location: profile.location ?? null,
    level: stats.level,
    experience: stats.experience,
    total_exercises: stats.totalExercises,
    pokemon_ids: pokemonIds,
    updated_at: Date.now(),
  };
  let { error } = await supabase.from('rankings').upsert(ranking, { onConflict: 'profile_id' });
  if (error?.message.includes('pokemon_ids')) {
    const { pokemon_ids: _pokemonIds, ...legacyRanking } = ranking;
    ({ error } = await supabase.from('rankings').upsert(legacyRanking, { onConflict: 'profile_id' }));
  }
  if (error) {
    console.error('Failed to sync ranking to Supabase:', error.message);
  }
}

export interface RankingEntry {
  profileId: string;
  displayName: string;
  school?: string;
  location?: string;
  level: number;
  experience: number;
  totalExercises: number;
  pokemonIds: number[];
}

export async function loadRankings(): Promise<RankingEntry[]> {
  const { data, error } = await supabase
    .from('rankings')
    .select('*')
    .order('experience', { ascending: false })
    .limit(100);
  if (error || !data) return [];
  return data.map((r) => ({
    profileId: r.profile_id as string,
    displayName: r.display_name as string,
    school: (r.school as string | null) ?? undefined,
    location: (r.location as string | null) ?? undefined,
    level: r.level as number,
    experience: r.experience as number,
    totalExercises: r.total_exercises as number,
    pokemonIds: Array.isArray(r.pokemon_ids) ? r.pokemon_ids as number[] : [],
  }));
}

async function deleteFromSupabase(id: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('profiles').delete().eq('id', id).eq('user_id', user.id);
}

export async function loadProfilesFromSupabase(userId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .order('name');
  if (error) throw new Error(error.message);
  if (!data) return [];
  return data.map((r) => ({
    id: r.id as string,
    userId: r.user_id as string,
    name: r.name as string,
    avatar: r.avatar as string,
    isAdmin: false,
    school: (r.school as string | null) ?? undefined,
    location: (r.location as string | null) ?? undefined,
    createdAt: r.created_at as number,
    updatedAt: r.updated_at as number,
  }));
}

export const profileStorage = {
  async getAll(userId?: string): Promise<Profile[]> {
    if (userId) {
      return db.profiles.where('userId').equals(userId).sortBy('name');
    }
    return db.profiles.orderBy('name').toArray();
  },

  async getById(id: string): Promise<Profile | undefined> {
    return db.profiles.get(id);
  },

  async create(profile: Profile): Promise<void> {
    await db.profiles.add({ ...profile, isAdmin: profile.isAdmin ?? false });
    await db.profileStats.add(createEmptyProfileStats(profile.id));
    void syncToSupabase(profile);
  },

  async upsertFromCloud(profile: Profile): Promise<void> {
    const local = await db.profiles.get(profile.id);
    await db.profiles.put({
      ...profile,
      isAdmin: profile.isAdmin ?? local?.isAdmin ?? false,
    });
    const cloudStats = await loadStatsFromSupabase(profile.id);
    if (cloudStats) {
      const localStats = await db.profileStats.get(profile.id);
      if (!localStats || cloudStats.totalExercises >= localStats.totalExercises) {
        await db.profileStats.put(cloudStats);
      }
    } else {
      const stats = await db.profileStats.get(profile.id);
      if (!stats) {
        await db.profileStats.add(createEmptyProfileStats(profile.id));
      }
    }
  },

  async update(profile: Profile): Promise<void> {
    await db.profiles.put(profile);
    const stats = await db.profileStats.get(profile.id);
    if (stats) {
      void syncRankingToSupabase(profile, stats);
    } else {
      void syncToSupabase(profile);
    }
  },

  async delete(id: string): Promise<void> {
    await db.transaction('rw', [db.profiles, db.profileStats, db.sessions, db.badges, db.dailyGoals, db.streaks, db.settings], async () => {
      await db.profiles.delete(id);
      await db.profileStats.delete(id);
      await db.sessions.where('profileId').equals(id).delete();
      await db.badges.where('profileId').equals(id).delete();
      await db.dailyGoals.where('profileId').equals(id).delete();
      await db.streaks.delete(id);
      await db.settings.delete(id);
    });
    void deleteFromSupabase(id);
  },

  async getStats(profileId: string): Promise<ProfileStats | undefined> {
    return db.profileStats.get(profileId);
  },

  async addExperience(profileId: string, xp: number): Promise<ProfileStats> {
    let stats = await db.profileStats.get(profileId);
    if (!stats) {
      stats = createEmptyProfileStats(profileId);
      await db.profileStats.add(stats);
    }
    const newXp = stats.experience + xp;
    const updated: ProfileStats = {
      ...stats,
      experience: newXp,
      level: getLevelFromXp(newXp),
    };
    await db.profileStats.put(updated);
    void syncStatsToSupabase(updated);
    return updated;
  },

  async updateStats(stats: ProfileStats): Promise<void> {
    await db.profileStats.put(stats);
    const profile = await db.profiles.get(stats.profileId);
    await Promise.all([
      profile ? syncRankingToSupabase(profile, stats) : Promise.resolve(),
      syncStatsToSupabase(stats),
    ]);
  },

  async syncRanking(profileId: string): Promise<void> {
    const [profile, stats] = await Promise.all([
      db.profiles.get(profileId),
      db.profileStats.get(profileId),
    ]);
    if (profile && stats) {
      await syncRankingToSupabase(profile, stats);
    }
  },
};
