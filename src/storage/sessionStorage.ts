import { db } from './database';
import type { ExerciseSession } from '../models';
import { supabase } from '../lib/supabase';

async function syncSessionToSupabase(session: ExerciseSession): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from('profile_sessions').upsert({
    id: session.id,
    profile_id: session.profileId,
    set_id: session.setId,
    type: session.type,
    difficulty: session.difficulty,
    attempts: session.attempts,
    started_at: session.startedAt,
    completed_at: session.completedAt ?? null,
    score: session.score,
    total_items: session.totalItems,
    correct_items: session.correctItems,
    average_time_ms: session.averageTimeMs,
  }, { onConflict: 'id' });
  if (error) {
    console.error('Failed to sync session to Supabase:', error.message);
  }
}

function mapSessionRow(row: Record<string, unknown>): ExerciseSession {
  return {
    id: row.id as string,
    profileId: row.profile_id as string,
    setId: row.set_id as string,
    type: row.type as ExerciseSession['type'],
    difficulty: row.difficulty as ExerciseSession['difficulty'],
    attempts: (row.attempts as ExerciseSession['attempts']) ?? [],
    startedAt: row.started_at as number,
    completedAt: (row.completed_at as number | null) ?? undefined,
    score: row.score as number,
    totalItems: row.total_items as number,
    correctItems: row.correct_items as number,
    averageTimeMs: row.average_time_ms as number,
  };
}

async function loadAllSessionsFromSupabase(profileId: string): Promise<ExerciseSession[] | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const pageSize = 1000;
  const sessions: ExerciseSession[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('profile_sessions')
      .select('*')
      .eq('profile_id', profileId)
      .order('completed_at', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) {
      console.error('Failed to load sessions from Supabase:', error.message);
      return null;
    }
    sessions.push(...(data ?? []).map((row) => mapSessionRow(row)));
    if (!data || data.length < pageSize) break;
  }
  return sessions;
}

async function loadRecentSessionsFromSupabase(profileId: string, since: number): Promise<ExerciseSession[]> {
  const { data, error } = await supabase
    .from('profile_sessions')
    .select('*')
    .eq('profile_id', profileId)
    .gte('completed_at', since)
    .order('completed_at', { ascending: false })
    .limit(50);
  if (error || !data) return [];
  return data.map((row) => mapSessionRow(row));
}

export const sessionStorage = {
  async save(session: ExerciseSession): Promise<void> {
    await db.sessions.put(session);
    await syncSessionToSupabase(session);
  },

  async getByProfile(profileId: string, limit = 50): Promise<ExerciseSession[]> {
    return db.sessions
      .where('profileId')
      .equals(profileId)
      .reverse()
      .limit(limit)
      .toArray();
  },

  async getAllByProfile(profileId: string): Promise<ExerciseSession[]> {
    const local = await db.sessions
      .where('profileId')
      .equals(profileId)
      .toArray();
    const cloud = await loadAllSessionsFromSupabase(profileId);
    if (cloud) {
      const cloudIds = new Set(cloud.map((session) => session.id));
      await Promise.all(
        local
          .filter((session) => !cloudIds.has(session.id))
          .map((session) => syncSessionToSupabase(session)),
      );
      if (cloud.length > 0) {
        await db.sessions.bulkPut(cloud);
      }
    }
    return db.sessions
      .where('profileId')
      .equals(profileId)
      .toArray();
  },

  async getRecentByProfile(profileId: string, days = 30): Promise<ExerciseSession[]> {
    const since = Date.now() - days * 24 * 60 * 60 * 1000;
    const local = await db.sessions
      .where('profileId')
      .equals(profileId)
      .and((s) => (s.completedAt ?? 0) >= since)
      .toArray();
    if (local.length > 0) return local;
    const cloud = await loadRecentSessionsFromSupabase(profileId, since);
    if (cloud.length > 0) {
      await db.sessions.bulkPut(cloud);
    }
    return cloud;
  },

  async countByType(profileId: string, type: string): Promise<number> {
    return db.sessions
      .where('profileId')
      .equals(profileId)
      .and((s) => s.type === type && s.completedAt !== undefined)
      .count();
  },
};
