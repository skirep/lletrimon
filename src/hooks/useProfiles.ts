import { useState, useEffect, useCallback } from 'react';
import { profileStorage, sessionStorage, loadProfilesFromSupabase, loadRankings, loadGamificationFromSupabase, loadSettingsFromSupabase } from '../storage';
import type { Profile, ProfileStats } from '../models';
import type { RankingEntry } from '../storage';
import { generateId } from '../utils';

export type DatabaseReadStatus = 'idle' | 'loading' | 'success' | 'error';

export function useProfiles(userId?: string) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [databaseReadStatus, setDatabaseReadStatus] = useState<DatabaseReadStatus>('idle');
  const [databaseReadError, setDatabaseReadError] = useState<string | null>(null);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (userId) {
        setDatabaseReadStatus('loading');
        setDatabaseReadError(null);
        const cloud = await loadProfilesFromSupabase(userId);
        for (const p of cloud) {
          await profileStorage.upsertFromCloud(p);
          void loadGamificationFromSupabase(p.id);
          void loadSettingsFromSupabase(p.id);
        }
        const local = await profileStorage.getAll(userId);
        setProfiles(local.length > 0 ? local : cloud);
        setDatabaseReadStatus('success');
        setLoadedUserId(userId);
      } else {
        setDatabaseReadStatus('idle');
        setDatabaseReadError(null);
        setLoadedUserId(null);
        const data = await profileStorage.getAll();
        setProfiles(data);
      }
    } catch (error) {
      if (userId) {
        const local = await profileStorage.getAll(userId);
        setProfiles(local);
        setDatabaseReadStatus('error');
        setDatabaseReadError(error instanceof Error ? error.message : 'No s’han pogut llegir les dades de la base de dades.');
        setLoadedUserId(userId);
      } else {
        throw error;
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  const createProfile = useCallback(async (name: string, avatar: string, isAdmin = false) => {
    const profile: Profile = {
      id: generateId(),
      userId,
      name,
      avatar,
      isAdmin,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await profileStorage.create(profile);
    await load();
    return profile;
  }, [userId, load]);

  const updateProfile = useCallback(async (profile: Profile) => {
    await profileStorage.update(profile);
    setProfiles((prev) => prev.map((p) => p.id === profile.id ? profile : p));
  }, []);

  const deleteProfile = useCallback(async (id: string) => {
    await profileStorage.delete(id);
    setProfiles((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return {
    profiles,
    loading,
    createProfile,
    updateProfile,
    deleteProfile,
    refresh: load,
    databaseReadStatus,
    databaseReadError,
    loadedUserId,
  };
}

export function useProfileStats(profileId: string | null) {
  const [stats, setStats] = useState<ProfileStats | null>(null);

  useEffect(() => {
    if (!profileId) { setStats(null); return; }
    profileStorage.getStats(profileId).then((s) => setStats(s ?? null));
  }, [profileId]);

  return stats;
}

export function useRankings(profileId?: string) {
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (profileId) {
        await sessionStorage.getAllByProfile(profileId);
        await profileStorage.syncRanking(profileId);
      }
      const data = await loadRankings();
      if (!cancelled) {
        setRankings(data);
        setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [profileId]);

  return { rankings, loading };
}
