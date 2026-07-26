import { useEffect, useState } from 'react';
import type { BattleChallenge } from '../../models';
import { battleService } from '../../services/battleService';
import { BattleReplay } from './BattleReplay';
import styles from './HomeBattles.module.css';

interface HomeBattlesProps {
  profileId: string;
  onOpenArena: () => void;
}

function TeamSprites({ challenge }: { challenge: BattleChallenge }) {
  const pokemon = [...challenge.challengerTeam, ...(challenge.opponentTeam ?? [])]
    .sort((left, right) => right.power - left.power);
  return (
    <div className={styles.sprites} aria-label={`${pokemon.length} Pokémon preparats`}>
      {pokemon.map((fighter, index) => fighter.imageUrl
        ? <img key={`${fighter.pokemonId}-${index}`} src={fighter.imageUrl} alt={fighter.name} title={`${fighter.name} · Força ${fighter.power}`} />
        : <span key={`${fighter.pokemonId}-${index}`}>?</span>)}
    </div>
  );
}

export function HomeBattles({ profileId, onOpenArena }: HomeBattlesProps) {
  const [challenges, setChallenges] = useState<BattleChallenge[]>([]);
  const [autoPlayId, setAutoPlayId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        let data = await battleService.list(profileId);
        const accepted = data.challenges.filter((challenge) => challenge.status === 'accepted');
        if (accepted.length > 0) {
          await Promise.all(accepted.map((challenge) => battleService.open(challenge.id)));
          data = await battleService.list(profileId);
        }
        if (!cancelled) {
          setAutoPlayId(accepted[0]?.id ?? null);
          setChallenges(data.challenges.filter((challenge) => challenge.status !== 'declined').slice(0, 3));
        }
      } catch {
        if (!cancelled) setChallenges([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [profileId]);

  return (
    <section className={styles.section} aria-labelledby="home-battles-title">
      <div className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>Arena asíncrona</span>
          <h2 id="home-battles-title">Les teves lluites</h2>
        </div>
        <button type="button" onClick={onOpenArena}>Obre l’arena</button>
      </div>

      {loading && <div className={styles.empty}>Consultant els combats...</div>}
      {!loading && challenges.length === 0 && (
        <button type="button" className={styles.emptyAction} onClick={onOpenArena}>
          Encara no hi ha combats. Crea el primer repte.
        </button>
      )}

      <div className={styles.list}>
        {challenges.map((challenge) => {
          const isPending = challenge.status === 'pending';
          const isIncoming = challenge.opponentProfileId === profileId;
          return (
            <article className={styles.battle} key={challenge.id}>
              <div className={styles.summary}>
                <div className={styles.names}>
                  <span className={`${styles.state} ${isPending ? styles.pending : styles.completed}`}>
                    {isPending ? (isIncoming ? 'Espera la teva resposta' : 'Repte enviat') : 'Combat completat'}
                  </span>
                  <strong>{challenge.challengerName} <small>contra</small> {challenge.opponentName}</strong>
                  <span>{challenge.teamSize} Pokémon per equip</span>
                </div>
                <TeamSprites challenge={challenge} />
                {challenge.result && (
                  <div className={styles.score}>{challenge.result.challengerScore}<span>-</span>{challenge.result.opponentScore}</div>
                )}
              </div>
              {challenge.result && <BattleReplay challenge={challenge} autoPlay={autoPlayId === challenge.id} />}
            </article>
          );
        })}
      </div>
    </section>
  );
}