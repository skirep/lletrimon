import { useEffect, useState } from 'react';
import styles from './BadgesPage.module.css';
import { PokemonCollection } from '../components/gamification';
import { usePokemonCollection } from '../hooks';
import type { Profile, PokemonCollectionItem } from '../models';

const POKEDEX_SECTIONS = [
  {
    id: 'syllables-route',
    title: 'Camí de síl·labes',
    description: 'Pokémon que creixen completant els conjunts de síl·labes. Cada un s’activa a un percentatge diferent.',
    match: (pokemon: PokemonCollectionItem) => pokemon.exerciseType === 'syllables',
    evolutionLabel: '40% → 60% → 80% → 95%',
  },
  {
    id: 'words-route',
    title: 'Camí de paraules',
    description: 'Paraules fàcils, mitjanes i difícils: a mesura que puges el percentatge, apareixen Pokémon més potents.',
    match: (pokemon: PokemonCollectionItem) => pokemon.exerciseType === 'words',
    evolutionLabel: '40% → 60% → 80% → 95%',
  },
  {
    id: 'sentences-route',
    title: 'Camí de frases',
    description: 'La ruta més tècnica. Aquí es troben els Pokémon més difícils i la fita Mew.',
    match: (pokemon: PokemonCollectionItem) => pokemon.exerciseType === 'sentences',
    evolutionLabel: '40% → 60% → 80% → 95%',
  },
  {
    id: 'pseudowords-route',
    title: 'Camí de pseudoparaules',
    description: 'Entrena descodificació i precisió amb paraules inventades per desbloquejar noves criatures.',
    match: (pokemon: PokemonCollectionItem) => pokemon.exerciseType === 'pseudowords',
    evolutionLabel: '40% → 60% → 80% → 95%',
  },
  {
    id: 'sounds-route',
    title: 'Camí de sons',
    description: 'Practica els sons bàsics i consolida la base fonològica per pujar de nivell.',
    match: (pokemon: PokemonCollectionItem) => pokemon.exerciseType === 'sounds',
    evolutionLabel: '40% → 60% → 80% → 95%',
  },
] as const;

const DIFFICULTY_RANK: Record<PokemonCollectionItem['difficulty'], number> = {
  easy: 1,
  medium: 2,
  hard: 3,
};

const ATTACKS_BY_TYPE: Record<PokemonCollectionItem['exerciseType'], string[]> = {
  syllables: ['Impacte sil·làbic', 'Rafega vocal', 'Combo de consonants'],
  words: ['Foc de paraules', 'Tall lèxic', 'Crit d’ortografia'],
  sentences: ['Onada sintàctica', 'Raig de frase llarga', 'Tempesta narrativa'],
  pseudowords: ['Vòrtex inventat', 'Impuls fonètic', 'Fletxa de descodificació'],
  sounds: ['Eco fonològic', 'Cop sonor', 'Ressonància precisa'],
};

const ATTACKS_BY_DIFFICULTY: Record<PokemonCollectionItem['difficulty'], string[]> = {
  easy: ['Cop àgil', 'Empenta ràpida', 'Brisa lleugera'],
  medium: ['Tornado tàctic', 'Impacte sostingut', 'Descàrrega precisa'],
  hard: ['Explosió mestra', 'Rugir llegendari', 'Tempesta definitiva'],
};

interface BattleTurn {
  attackerId: number;
  defenderId: number;
  attackerName: string;
  defenderName: string;
  attackName: string;
  damage: number;
  defenderHp: number;
  isSpecialAttack: boolean;
}

interface BattleResult {
  winner: PokemonCollectionItem;
  loser: PokemonCollectionItem;
  winnerPower: number;
  loserPower: number;
  commentary: string;
  turns: BattleTurn[];
  fighterStates: Array<{ pokemonId: number; currentHp: number; maxHp: number }>;
}

interface BattleHistoryEntry {
  id: number;
  winnerName: string;
  loserName: string;
  winnerPower: number;
  loserPower: number;
  summary: string;
}

function getMaxHp(pokemon: PokemonCollectionItem): number {
  const difficultyBonus = pokemon.difficulty === 'easy' ? 0 : pokemon.difficulty === 'medium' ? 12 : 24;
  return 90 + difficultyBonus + Math.round(pokemon.power * 0.7);
}

function getAttackLine(attacker: PokemonCollectionItem, turnIndex: number) {
  const typeAttacks = ATTACKS_BY_TYPE[attacker.exerciseType];
  const difficultyAttacks = ATTACKS_BY_DIFFICULTY[attacker.difficulty];
  const attackPool = [...typeAttacks, ...difficultyAttacks];
  return attackPool[turnIndex % attackPool.length] ?? attackPool[0];
}

function getSpecialAttackLine(attacker: PokemonCollectionItem) {
  return attacker.specialAttackName ?? `${attacker.name} absolut`;
}

function getBattleSummary(winner: PokemonCollectionItem, loser: PokemonCollectionItem, winnerPower: number, loserPower: number) {
  if (winnerPower - loserPower > 18) {
    return `${winner.name} ha arrasat el combat i deixa ${loser.name} sense opcions.`;
  }

  return `${winner.name} ha superat ${loser.name} després d’un duel molt igualat.`;
}

interface BadgesPageProps {
  profile: Profile;
}

export function BadgesPage({ profile }: BadgesPageProps) {
  const { collection, loading } = usePokemonCollection(profile.id);
  const unlockedPokemon = collection.filter((pokemon) => pokemon.unlocked).length;
  const unlockedCollection = collection.filter((pokemon) => pokemon.unlocked);
  const [selectedPokemonIds, setSelectedPokemonIds] = useState<number[]>([]);
  const [battleResult, setBattleResult] = useState<BattleResult | null>(null);
  const [battleHistory, setBattleHistory] = useState<BattleHistoryEntry[]>([]);
  const [battlePlan, setBattlePlan] = useState<BattleResult | null>(null);
  const [activeTurnIndex, setActiveTurnIndex] = useState<number | null>(null);
  const [battlePhase, setBattlePhase] = useState<'charge' | 'impact'>('charge');
  const [animatedHp, setAnimatedHp] = useState<Record<number, number>>({});

  const selectedPokemon = selectedPokemonIds
    .map((pokemonId) => unlockedCollection.find((pokemon) => pokemon.pokemonId === pokemonId) ?? null)
    .filter((pokemon): pokemon is PokemonCollectionItem => pokemon !== null);
  const activeTurn = battlePlan && activeTurnIndex !== null ? battlePlan.turns[activeTurnIndex] : null;
  const isBattling = battlePlan !== null;

  useEffect(() => {
    if (!battlePlan || activeTurnIndex === null) return;

    const turn = battlePlan.turns[activeTurnIndex];
    if (!turn) return;

    setBattlePhase('charge');
    const impactTimer = window.setTimeout(() => {
      setBattlePhase('impact');
      setAnimatedHp((current) => ({ ...current, [turn.defenderId]: turn.defenderHp }));
    }, 420);

    const nextTurnTimer = window.setTimeout(() => {
      if (activeTurnIndex + 1 < battlePlan.turns.length) {
        setActiveTurnIndex(activeTurnIndex + 1);
        return;
      }

      setBattleResult(battlePlan);
      setBattleHistory((current) => [
        {
          id: Date.now(),
          winnerName: battlePlan.winner.name,
          loserName: battlePlan.loser.name,
          winnerPower: battlePlan.winnerPower,
          loserPower: battlePlan.loserPower,
          summary: battlePlan.commentary,
        },
        ...current,
      ].slice(0, 6));
      setBattlePlan(null);
      setActiveTurnIndex(null);
    }, 980);

    return () => {
      window.clearTimeout(impactTimer);
      window.clearTimeout(nextTurnTimer);
    };
  }, [activeTurnIndex, battlePlan]);

  const toggleBattlePokemon = (pokemon: PokemonCollectionItem) => {
    if (!pokemon.unlocked || isBattling) return;

    setBattleResult(null);
    setSelectedPokemonIds((prev) => {
      if (prev.includes(pokemon.pokemonId)) {
        return prev.filter((id) => id !== pokemon.pokemonId);
      }

      if (prev.length < 2) {
        return [...prev, pokemon.pokemonId];
      }

      return [prev[1], pokemon.pokemonId];
    });
  };

  const simulateBattle = () => {
    if (selectedPokemon.length !== 2 || isBattling) return;

    const [firstPokemon, secondPokemon] = selectedPokemon;
    const fighterStates = [
      { pokemon: firstPokemon, currentHp: getMaxHp(firstPokemon), maxHp: getMaxHp(firstPokemon) },
      { pokemon: secondPokemon, currentHp: getMaxHp(secondPokemon), maxHp: getMaxHp(secondPokemon) },
    ];

    const turns: BattleTurn[] = [];
    let attackerIndex = firstPokemon.power >= secondPokemon.power ? 0 : 1;
    let round = 0;

    while (fighterStates[0].currentHp > 0 && fighterStates[1].currentHp > 0 && round < 8) {
      const defenderIndex = attackerIndex === 0 ? 1 : 0;
      const attacker = fighterStates[attackerIndex].pokemon;
      const defender = fighterStates[defenderIndex].pokemon;
      const damageBase = Math.max(8, Math.round(attacker.power * 0.18));
      const difficultyBonus = attacker.difficulty === 'easy' ? 2 : attacker.difficulty === 'medium' ? 5 : 9;
      const isSpecialAttack = attacker.specialAttackUnlocked && round === 0;
      const damage = damageBase + difficultyBonus + Math.floor(Math.random() * 10) + (isSpecialAttack ? 22 : 0);
      fighterStates[defenderIndex].currentHp = Math.max(0, fighterStates[defenderIndex].currentHp - damage);

      turns.push({
        attackerId: attacker.pokemonId,
        defenderId: defender.pokemonId,
        attackerName: attacker.name,
        defenderName: defender.name,
        attackName: isSpecialAttack ? getSpecialAttackLine(attacker) : getAttackLine(attacker, round),
        damage,
        defenderHp: fighterStates[defenderIndex].currentHp,
        isSpecialAttack,
      });

      attackerIndex = defenderIndex;
      round += 1;
    }

    const firstState = fighterStates[0];
    const secondState = fighterStates[1];
    const firstWins = firstState.currentHp >= secondState.currentHp;
    const winner = firstWins ? firstPokemon : secondPokemon;
    const loser = firstWins ? secondPokemon : firstPokemon;
    const winnerPower = firstWins ? firstPokemon.power : secondPokemon.power;
    const loserPower = firstWins ? secondPokemon.power : firstPokemon.power;
    const commentary = getBattleSummary(winner, loser, winnerPower, loserPower);

    const result: BattleResult = {
      winner,
      loser,
      winnerPower,
      loserPower,
      commentary,
      turns,
      fighterStates: fighterStates.map((state) => ({
        pokemonId: state.pokemon.pokemonId,
        currentHp: state.currentHp,
        maxHp: state.maxHp,
      })),
    };

    setBattleResult(null);
    setAnimatedHp(Object.fromEntries(fighterStates.map((state) => [state.pokemon.pokemonId, state.maxHp])));
    setBattlePlan(result);
    setActiveTurnIndex(0);
  };

  return (
    <div className={`page ${styles.page}`}>
      <h1 className="page-title">Pokédex de logros</h1>

      <details className="info-box">
        <summary>ℹ️ Com funciona aquesta pantalla?</summary>
        <div className="info-box-content">
          <p>Cada Pokémon està vinculat a exercicis reals del joc. Si superes aquests exercicis, el Pokémon es desbloqueja i guanya força.</p>
          <ul>
            <li><strong>Síl·labes:</strong> obren la branca Bulbasaur → Ivysaur → Venusaur.</li>
            <li><strong>Paraules:</strong> fan créixer Charmander → Charmeleon → Charizard.</li>
            <li><strong>Frases:</strong> desbloquegen Dratini → Dragonair → Mew.</li>
            <li><strong>Pseudoparaules i sons:</strong> també tenen rutes pròpies amb Pokémon desbloquejables.</li>
          </ul>
          <p>A la mini-lluita pots triar dos Pokémon desbloquejats. El seu poder depèn del nivell base i dels exercicis superats d’aquell camí.</p>
        </div>
      </details>

      <section className={`card ${styles.heroCard}`}>
        <div>
          <div className={styles.heroEyebrow}>Progrés general</div>
          <h2 className={styles.heroTitle}>Has desbloquejat {unlockedPokemon} Pokémon</h2>
          <p className={styles.heroText}>
            La teva Pokédex ara segueix el teu recorregut lector real. Cada criatura té uns exercicis associats i creix quan els vas superant.
          </p>
        </div>
        <div className={styles.heroCounter}>{unlockedPokemon}/{collection.length || 0}</div>
      </section>

      <section className={`card ${styles.battleCard}`}>
        <div className={styles.battleHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Arena Pokémon</h2>
            <p className={styles.sectionText}>Selecciona dos Pokémon desbloquejats de les categories de sota i fes-los lluitar.</p>
          </div>
          <button
            type="button"
            className={styles.battleBtn}
            onClick={simulateBattle}
            disabled={selectedPokemon.length !== 2 || isBattling}
          >
            {isBattling ? 'Lluitant...' : '⚔ Simula la lluita'}
          </button>
        </div>

        <div className={`${styles.battleArena} ${isBattling ? styles.battleArenaActive : ''}`}>
          {selectedPokemon.map((pokemon, fighterIndex) => {
            const isAttacker = activeTurn?.attackerId === pokemon.pokemonId;
            const isDefender = activeTurn?.defenderId === pokemon.pokemonId;
            const currentHp = animatedHp[pokemon.pokemonId]
              ?? battleResult?.fighterStates.find((state) => state.pokemonId === pokemon.pokemonId)?.currentHp
              ?? getMaxHp(pokemon);
            const maxHp = battleResult?.fighterStates.find((state) => state.pokemonId === pokemon.pokemonId)?.maxHp ?? getMaxHp(pokemon);

            return (
            <article
              key={pokemon.pokemonId}
              className={`${styles.fighterCard} ${fighterIndex === 0 ? styles.fighterLeft : styles.fighterRight} ${isAttacker ? styles.fighterAttacking : ''} ${isDefender && battlePhase === 'impact' ? styles.fighterHit : ''} ${battleResult?.winner.pokemonId === pokemon.pokemonId ? styles.fighterWinner : ''} ${battleResult?.loser.pokemonId === pokemon.pokemonId ? styles.fighterLoser : ''}`}
            >
              {pokemon.imageUrl ? <img className={styles.fighterArt} src={pokemon.imageUrl} alt={pokemon.name} /> : <div className={styles.fighterPlaceholder}>⚡</div>}
              <div className={styles.fighterName}>{pokemon.name}</div>
              <div className={styles.fighterMeta}>{pokemon.unlockCondition}</div>
              <div className={styles.fighterPower}>Força {pokemon.power}</div>
              <div className={styles.hpBlock}>
                <div className={styles.hpHeader}>
                  <span>HP</span>
                  <span>{currentHp}/{maxHp}</span>
                </div>
                <div className={styles.hpBar}>
                  <div
                    className={styles.hpFill}
                    style={{ width: `${Math.round((currentHp / maxHp) * 100)}%` }}
                  />
                </div>
              </div>
            </article>
            );
          })}
          {activeTurn && battlePhase === 'impact' && <div className={styles.impactFlash} aria-hidden="true" />}
          {activeTurn && (
            <div className={`${styles.attackCallout} ${activeTurn.isSpecialAttack ? styles.attackCalloutSpecial : ''}`}>
              <strong>{activeTurn.attackName}</strong>
              {battlePhase === 'impact' && <span>−{activeTurn.damage} HP</span>}
            </div>
          )}
          {selectedPokemon.length < 2 && Array.from({ length: 2 - selectedPokemon.length }, (_, idx) => (
            <div key={`empty-${idx}`} className={styles.fighterEmpty}>Tria un Pokémon desbloquejat</div>
          ))}
        </div>

        {battleResult && (
          <div className={styles.battleResult} key={battleResult.turns.length}>
            <div className={styles.battleWinner}>{battleResult.winner.name} guanya!</div>
            <div className={styles.battleScores}>
              {battleResult.winner.name}: {battleResult.winnerPower} · {battleResult.loser.name}: {battleResult.loserPower}
            </div>
            <div className={styles.battleLog}>
              {battleResult.turns.map((turn, index) => (
                <div key={`${turn.attackerId}-${index}`} className={`${styles.battleLine} ${turn.isSpecialAttack ? styles.battleLineSpecial : ''}`}>
                  {turn.attackerName} {turn.isSpecialAttack ? 'desplega' : 'usa'} {turn.attackName} contra {turn.defenderName} i fa {turn.damage} de mal. HP restant: {turn.defenderHp}
                </div>
              ))}
            </div>
            <p className={styles.battleCommentary}>{battleResult.commentary}</p>
          </div>
        )}

        {battleHistory.length > 0 && (
          <div className={styles.historyCard}>
            <h3 className={styles.historyTitle}>Historial recent de combats</h3>
            <div className={styles.historyList}>
              {battleHistory.map((entry) => (
                <div key={entry.id} className={styles.historyItem}>
                  <div className={styles.historyNames}>{entry.winnerName} vs {entry.loserName}</div>
                  <div className={styles.historyMeta}>Força {entry.winnerPower} · {entry.loserPower}</div>
                  <div className={styles.historySummary}>{entry.summary}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {POKEDEX_SECTIONS.map((section) => {
        const sectionCollection = collection
          .filter(section.match)
          .sort((left, right) => right.power - left.power || DIFFICULTY_RANK[right.difficulty] - DIFFICULTY_RANK[left.difficulty]);
        const sectionUnlocked = sectionCollection.filter((pokemon) => pokemon.unlocked).length;

        return (
          <section key={section.id} className={`card ${styles.sectionCard}`}>
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.sectionTitle}>{section.title}</h2>
                <p className={styles.sectionText}>{section.description}</p>
              </div>
              <div className={styles.sectionCounter}>{sectionUnlocked}/{sectionCollection.length}</div>
            </div>
            <div className={styles.evolutionTrack}>
              {[40, 60, 80, 95].map((threshold, index) => (
                <div key={`${section.id}-${threshold}`} className={styles.evolutionNodeWrap}>
                  <div className={styles.evolutionNodeHint}>
                    <div className={styles.evolutionNodeHintPercent}>{threshold}%</div>
                    <div className={styles.evolutionNodeHintLabel}>
                      {index === 0 ? 'Bronze' : index === 1 ? 'Plata' : index === 2 ? 'Or' : 'Llegenda'}
                    </div>
                  </div>
                  {index < 3 && <div className={styles.evolutionArrow}>→</div>}
                </div>
              ))}
            </div>
            <div className={styles.evolutionCaption}>{section.evolutionLabel}</div>
            <PokemonCollection
              collection={sectionCollection}
              loading={loading}
              selectedIds={selectedPokemonIds}
              onSelectPokemon={toggleBattlePokemon}
              emptyMessage="No hi ha Pokémon en aquesta categoria encara."
            />
          </section>
        );
      })}
    </div>
  );
}
