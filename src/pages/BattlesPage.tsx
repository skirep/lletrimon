import { useEffect, useState } from 'react';
import type {
  BattleChallenge,
  BattlePokemon,
  BattleTeamSize,
  PokemonCollectionItem,
  Profile,
} from '../models';
import type { RankingEntry } from '../storage/profileStorage';
import { usePokemonCollection } from '../hooks';
import { battleService } from '../services/battleService';
import { BattleReplay } from '../components/gamification';
import styles from './BattlesPage.module.css';

interface BattlesPageProps {
  profile: Profile;
}

function toBattlePokemon(pokemon: PokemonCollectionItem): BattlePokemon {
  return {
    pokemonId: pokemon.pokemonId,
    name: pokemon.name,
    imageUrl: pokemon.imageUrl,
    power: pokemon.power,
  };
}

function Team({ pokemon }: { pokemon: BattlePokemon[] | null }) {
  if (!pokemon) return <div className={styles.teamPending}>Equip pendent de seleccionar</div>;
  return (
    <div className={styles.team}>
      {[...pokemon].sort((left, right) => right.power - left.power).map((fighter) => (
        <div className={styles.teamPokemon} key={fighter.pokemonId}>
          {fighter.imageUrl
            ? <img src={fighter.imageUrl} alt={fighter.name} />
            : <span className={styles.pokemonFallback}>?</span>}
          <div>
            <strong>{fighter.name}</strong>
            <span>Força {fighter.power}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function statusLabel(status: BattleChallenge['status']): string {
  if (status === 'pending') return 'Esperant resposta';
  if (status === 'accepted') return 'Preparant la lluita';
  if (status === 'declined') return 'Repte rebutjat';
  return 'Lluita completada';
}

export function BattlesPage({ profile }: BattlesPageProps) {
  const { collection, loading: collectionLoading } = usePokemonCollection(profile.id);
  const unlocked = collection
    .filter((pokemon) => pokemon.unlocked)
    .sort((left, right) => right.power - left.power || left.name.localeCompare(right.name));
  const [teamSize, setTeamSize] = useState<BattleTeamSize>(1);
  const [selectedRivalId, setSelectedRivalId] = useState('');
  const [selectedPokemonIds, setSelectedPokemonIds] = useState<number[]>([]);
  const [acceptingChallengeId, setAcceptingChallengeId] = useState<string | null>(null);
  const [acceptTeamIds, setAcceptTeamIds] = useState<number[]>([]);
  const [challenges, setChallenges] = useState<BattleChallenge[]>([]);
  const [rivals, setRivals] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoPlayChallengeId, setAutoPlayChallengeId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      let data = await battleService.list(profile.id);
      const newlyAccepted = data.challenges.filter((challenge) => challenge.status === 'accepted');
      if (newlyAccepted.length > 0) {
        await Promise.all(newlyAccepted.map((challenge) => battleService.open(challenge.id)));
        setAutoPlayChallengeId(newlyAccepted[0]?.id ?? null);
        data = await battleService.list(profile.id);
      }
      setChallenges(data.challenges);
      setRivals(data.rivals);
      if (!selectedRivalId && data.rivals[0]) setSelectedRivalId(data.rivals[0].profileId);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No s’han pogut carregar els reptes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [profile.id]);

  const setSize = (size: BattleTeamSize) => {
    setTeamSize(size);
    setSelectedPokemonIds([]);
  };

  const togglePokemon = (pokemonId: number, selected: number[], update: (ids: number[]) => void, limit: number) => {
    if (selected.includes(pokemonId)) {
      update(selected.filter((id) => id !== pokemonId));
    } else if (selected.length < limit) {
      update([...selected, pokemonId]);
    }
  };

  const createChallenge = async () => {
    if (!selectedRivalId || selectedPokemonIds.length !== teamSize) return;
    setBusy(true);
    setError(null);
    try {
      const team = selectedPokemonIds
        .map((id) => unlocked.find((pokemon) => pokemon.pokemonId === id))
        .filter((pokemon): pokemon is PokemonCollectionItem => Boolean(pokemon))
        .map(toBattlePokemon)
        .sort((left, right) => right.power - left.power);
      await battleService.create(profile.id, selectedRivalId, teamSize, team);
      setSelectedPokemonIds([]);
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'No s’ha pogut crear el repte.');
    } finally {
      setBusy(false);
    }
  };

  const respond = async (challenge: BattleChallenge, accept: boolean) => {
    if (accept && acceptTeamIds.length !== challenge.teamSize) return;
    setBusy(true);
    setError(null);
    try {
      const team = accept
        ? acceptTeamIds
            .map((id) => unlocked.find((pokemon) => pokemon.pokemonId === id))
            .filter((pokemon): pokemon is PokemonCollectionItem => Boolean(pokemon))
            .map(toBattlePokemon)
            .sort((left, right) => right.power - left.power)
        : null;
      await battleService.respond(challenge.id, accept, team);
      setAcceptingChallengeId(null);
      setAcceptTeamIds([]);
      await load();
    } catch (respondError) {
      setError(respondError instanceof Error ? respondError.message : 'No s’ha pogut respondre el repte.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`page ${styles.page}`}>
      <div className={styles.titleRow}>
        <div>
          <h1 className="page-title">Lluites multijugador</h1>
          <p className={styles.subtitle}>Repta un altre entrenador i torneu quan vulgueu. El resultat serà el mateix per a tots dos.</p>
        </div>
        <button type="button" className={styles.refreshButton} onClick={() => void load()} disabled={loading || busy} aria-label="Actualitza els reptes" title="Actualitza els reptes">↻</button>
      </div>

      {error && <div className={styles.error} role="alert">{error}</div>}

      <section className={styles.createSection}>
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.eyebrow}>Nou repte</span>
            <h2>Prepara el teu equip</h2>
          </div>
          <div className={styles.sizeControl} aria-label="Mida de l’equip">
            <button type="button" className={teamSize === 1 ? styles.sizeActive : ''} onClick={() => setSize(1)}>1 Pokémon</button>
            <button type="button" className={teamSize === 3 ? styles.sizeActive : ''} onClick={() => setSize(3)}>3 Pokémon</button>
            <button type="button" className={teamSize === 6 ? styles.sizeActive : ''} onClick={() => setSize(6)}>6 Pokémon</button>
          </div>
        </div>

        <label className={styles.rivalField}>
          <span>Entrenador rival</span>
          <select value={selectedRivalId} onChange={(event) => setSelectedRivalId(event.target.value)} disabled={rivals.length === 0}>
            {rivals.length === 0 && <option value="">Encara no hi ha altres entrenadors</option>}
            {rivals.map((rival) => <option key={rival.profileId} value={rival.profileId}>{rival.displayName} · Nivell {rival.level}</option>)}
          </select>
        </label>

        <div className={styles.pokemonGrid}>
          {collectionLoading && <p>Carregant la teva col·lecció...</p>}
          {!collectionLoading && unlocked.length === 0 && <p>Desbloqueja un Pokémon abans de crear un repte.</p>}
          {unlocked.map((pokemon) => {
            const selected = selectedPokemonIds.includes(pokemon.pokemonId);
            return (
              <button
                type="button"
                key={pokemon.pokemonId}
                className={`${styles.pokemonChoice} ${selected ? styles.pokemonSelected : ''}`}
                onClick={() => togglePokemon(pokemon.pokemonId, selectedPokemonIds, setSelectedPokemonIds, teamSize)}
                aria-pressed={selected}
              >
                {pokemon.imageUrl && <img src={pokemon.imageUrl} alt="" />}
                <span>{pokemon.name}</span>
                <small>Força {pokemon.power}</small>
              </button>
            );
          })}
        </div>

        <button type="button" className={styles.challengeButton} onClick={() => void createChallenge()} disabled={busy || !selectedRivalId || selectedPokemonIds.length !== teamSize}>
          Envia el repte ({selectedPokemonIds.length}/{teamSize})
        </button>
      </section>

      <section className={styles.inboxSection}>
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.eyebrow}>Bústia de combats</span>
            <h2>Reptes recents</h2>
          </div>
          <span className={styles.challengeCount}>{challenges.length}</span>
        </div>

        {loading && <p className={styles.empty}>Carregant reptes...</p>}
        {!loading && challenges.length === 0 && <p className={styles.empty}>Encara no tens cap repte. Tria un rival i inaugura l’arena.</p>}

        <div className={styles.challengeList}>
          {challenges.map((challenge) => {
            const isIncoming = challenge.opponentProfileId === profile.id;
            const isAccepting = acceptingChallengeId === challenge.id;
            const won = challenge.result?.winnerProfileId === profile.id;
            return (
              <article className={styles.challengeCard} key={challenge.id}>
                <div className={styles.challengeHeader}>
                  <div>
                    <span className={styles.direction}>{isIncoming ? 'Repte rebut' : 'Repte enviat'}</span>
                    <h3>{challenge.challengerName} contra {challenge.opponentName}</h3>
                  </div>
                  <span className={`${styles.status} ${styles[challenge.status]}`}>{statusLabel(challenge.status)}</span>
                </div>

                <div className={styles.versus}>
                  <div><h4>{challenge.challengerName}</h4><Team pokemon={challenge.challengerTeam} /></div>
                  <strong>VS</strong>
                  <div><h4>{challenge.opponentName}</h4><Team pokemon={challenge.opponentTeam} /></div>
                </div>

                {isIncoming && challenge.status === 'pending' && !isAccepting && (
                  <div className={styles.actions}>
                    <button type="button" className={styles.acceptButton} onClick={() => { setAcceptingChallengeId(challenge.id); setAcceptTeamIds([]); }}>Accepta i tria equip</button>
                    <button type="button" className={styles.declineButton} onClick={() => void respond(challenge, false)} disabled={busy}>Rebutja</button>
                  </div>
                )}

                {isIncoming && challenge.status === 'pending' && isAccepting && (
                  <div className={styles.acceptPanel}>
                    <p>Tria {challenge.teamSize} Pokémon per respondre:</p>
                    <div className={styles.pokemonGrid}>
                      {unlocked.map((pokemon) => {
                        const selected = acceptTeamIds.includes(pokemon.pokemonId);
                        return (
                          <button
                            type="button"
                            key={pokemon.pokemonId}
                            className={`${styles.pokemonChoice} ${selected ? styles.pokemonSelected : ''}`}
                            onClick={() => togglePokemon(pokemon.pokemonId, acceptTeamIds, setAcceptTeamIds, challenge.teamSize)}
                            aria-pressed={selected}
                          >
                            {pokemon.imageUrl && <img src={pokemon.imageUrl} alt="" />}
                            <span>{pokemon.name}</span>
                            <small>Força {pokemon.power}</small>
                          </button>
                        );
                      })}
                    </div>
                    <div className={styles.actions}>
                      <button type="button" className={styles.acceptButton} onClick={() => void respond(challenge, true)} disabled={busy || acceptTeamIds.length !== challenge.teamSize}>Confirma l’equip ({acceptTeamIds.length}/{challenge.teamSize})</button>
                      <button type="button" className={styles.declineButton} onClick={() => setAcceptingChallengeId(null)}>Cancel·la</button>
                    </div>
                  </div>
                )}

                {challenge.result && (
                  <>
                    <div className={`${styles.result} ${won ? styles.victory : styles.defeat}`}>
                      <div>
                        <span>{won ? 'Victòria' : 'Derrota'}</span>
                        <strong>{challenge.result.challengerScore} - {challenge.result.opponentScore}</strong>
                      </div>
                      <p>{challenge.result.summary}</p>
                    </div>
                    <BattleReplay challenge={challenge} autoPlay={autoPlayChallengeId === challenge.id} />
                  </>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}