import { useEffect, useState } from 'react';
import { buildPokemonCollection } from '../gamification';
import type { PokemonCollectionItem } from '../models';
import { sessionStorage } from '../storage';

export function usePokemonCollection(profileId: string | null) {
  const [collection, setCollection] = useState<PokemonCollectionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);

    const load = async () => {
      const sessions = profileId ? await sessionStorage.getAllByProfile(profileId) : [];
      const nextCollection = await buildPokemonCollection(sessions);

      if (!cancelled) {
        setCollection(nextCollection);
        setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [profileId]);

  return { collection, loading };
}
