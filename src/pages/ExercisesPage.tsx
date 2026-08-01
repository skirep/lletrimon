import { useEffect, useState } from 'react';
import styles from './ExercisesPage.module.css';
import { Button } from '../components/common';
import { ExerciseRunner } from './ExerciseRunner';
import { EndlessRunner } from './EndlessRunner';
import { getAllSets, getSetById, getSetsByType, getSetsByTypeAndDifficulty } from '../exercises';
import { PokemonCollection } from '../components/gamification';
import { usePokemonCollection, useRecommendedMission } from '../hooks';
import type { ExerciseType, Difficulty, ExerciseSet, ExerciseItem, Profile } from '../models';

/**
 * ExercisesPage – exercise catalogue and launcher.
 *
 * The player follows three optional filter steps before starting:
 *  1. **Type**       – sounds / syllables / words / pseudowords / sentences.
 *  2. **Difficulty** – easy / medium / hard.
 *  3. **Set**        – one of the available exercise sets matching the filters.
 *
 * Once a set is selected the player can either:
 *  - Start a **standard run** (fixed number of items, shuffled).
 *  - Start an **endless run** (all items from the current filter, looping
 *    until the player exits or makes an error in syllable-hard mode).
 *
 * Rendering ExerciseRunner or EndlessRunner is handled inline: when `running`
 * or `endlessRunning` is true the corresponding component replaces this page.
 */

const TYPE_OPTIONS: Record<ExerciseType, { icon: string; label: string; description: string }> = {
  sounds: { icon: '🔊', label: 'Sons', description: 'Escolta i practica cada so' },
  syllables: { icon: '🔤', label: 'Síl·labes', description: 'Ajunta lletres i sons' },
  words: { icon: '📝', label: 'Paraules', description: 'Llegeix paraules senceres' },
  pseudowords: { icon: '🔮', label: 'Paraules inventades', description: 'Supera un repte de lectura' },
  sentences: { icon: '📖', label: 'Frases', description: 'Llegeix històries curtes' },
};

const COMING_SOON_TYPES: ExerciseType[] = ['sounds'];

function isComingSoonType(type: ExerciseType): boolean {
  return COMING_SOON_TYPES.includes(type);
}

const DIFFICULTY_OPTIONS: Record<Difficulty, { icon: string; label: string; description: string }> = {
  easy: { icon: '🌱', label: 'Fàcil', description: 'Per començar' },
  medium: { icon: '⭐', label: 'Mitjà', description: 'Un bon repte' },
  hard: { icon: '🔥', label: 'Difícil', description: 'Aventura experta' },
};

interface ExercisesPageProps {
  profile: Profile;
  initialSetId?: string | null;
  onInitialSetConsumed?: () => void;
}

export function ExercisesPage({ profile, initialSetId = null, onInitialSetConsumed }: ExercisesPageProps) {
  const { collection: pokemonCollection, loading: pokemonLoading } = usePokemonCollection(profile.id);
  const { mission, loading: missionLoading, refresh: refreshMission } = useRecommendedMission(profile.id);
  const [selectedType, setSelectedType] = useState<ExerciseType | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty | null>(null);
  const initialPlayableSet = initialSetId ? getSetById(initialSetId) : null;
  const [selectedSet, setSelectedSet] = useState<ExerciseSet | null>(() => {
    if (!initialPlayableSet) return null;
    return isComingSoonType(initialPlayableSet.type) ? null : initialPlayableSet;
  });
  const [running, setRunning] = useState(() => Boolean(initialPlayableSet && !isComingSoonType(initialPlayableSet.type)));
  const [endlessRunning, setEndlessRunning] = useState(false);
  const [endlessPool, setEndlessPool] = useState<ExerciseItem[]>([]);
  const [endlessLabel, setEndlessLabel] = useState('');

  const allTypes: ExerciseType[] = ['sounds', 'syllables', 'words', 'pseudowords', 'sentences'];
  const difficulties: Difficulty[] = ['easy', 'medium', 'hard'];

  const availableSets = (selectedType && selectedDifficulty
    ? getSetsByTypeAndDifficulty(selectedType, selectedDifficulty)
    : selectedType
    ? getSetsByType(selectedType)
    : getAllSets())
    .filter((set) => !isComingSoonType(set.type));
  const featuredPokemon = (selectedType
    ? pokemonCollection.filter((pokemon) => pokemon.exerciseType === selectedType)
    : pokemonCollection
  ).slice(0, 6);

  useEffect(() => {
    if (initialSetId) onInitialSetConsumed?.();
  }, [initialSetId, onInitialSetConsumed]);

  const startMission = (set: ExerciseSet) => {
    if (isComingSoonType(set.type)) return;
    setSelectedType(set.type);
    setSelectedDifficulty(set.difficulty);
    setSelectedSet(set);
    setRunning(true);
  };

  if (running && selectedSet) {
    return (
      <ExerciseRunner
        profile={profile}
        set={selectedSet}
        onFinish={() => {
          setRunning(false);
          setSelectedSet(null);
          refreshMission();
        }}
      />
    );
  }

  if (endlessRunning && endlessPool.length > 0) {
    return (
      <EndlessRunner
        profile={profile}
        itemPool={endlessPool}
        label={endlessLabel}
        sessionType={selectedType ?? endlessPool[0].type}
        sessionDifficulty={selectedDifficulty ?? endlessPool[0].difficulty}
        onFinish={() => setEndlessRunning(false)}
      />
    );
  }

  return (
    <div className={`page ${styles.page}`}>
      <header className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Zona d&apos;entrenament</span>
          <h1>Què vols practicar avui?</h1>
          <p>Tria una aventura i llegeix en veu alta.</p>
        </div>
        <span className={styles.heroIcon} aria-hidden="true">🎤</span>
      </header>

      {(mission || missionLoading) && (
        <section className={styles.missionBanner}>
          {missionLoading || !mission ? (
            <span>Calculant la teva missió...</span>
          ) : (
            <>
              <div className={styles.missionBannerText}>
                <span className={styles.missionBannerLabel}>⭐ Fet per a tu · Objectiu {mission.targetScore}%</span>
                <strong>{mission.set.title}</strong>
                <span>{mission.reason}</span>
              </div>
              <Button onClick={() => startMission(mission.set)}>Comença ara</Button>
            </>
          )}
        </section>
      )}

      <section className={styles.stepSection} aria-labelledby="type-heading">
        <div className={styles.stepHeading}>
          <span className={styles.stepNumber}>1</span>
          <div>
            <h2 id="type-heading">Què vols llegir?</h2>
            <p>Toca una opció</p>
          </div>
        </div>
        <div className={styles.typeGrid}>
          {allTypes.map((type) => (
            <button
              key={type}
              className={`${styles.typeBtn} ${selectedType === type ? styles.typeSelected : ''} ${isComingSoonType(type) ? styles.typeDisabled : ''}`}
              onClick={() => {
                if (isComingSoonType(type)) return;
                const nextType = selectedType === type ? null : type;
                setSelectedType(nextType);
                setSelectedDifficulty(null);
                setSelectedSet(null);
              }}
              disabled={isComingSoonType(type)}
              aria-pressed={selectedType === type}
            >
              <span className={styles.typeIcon} aria-hidden="true">{TYPE_OPTIONS[type].icon}</span>
              <span className={styles.choiceText}>
                <strong>{TYPE_OPTIONS[type].label}</strong>
                <small>{isComingSoonType(type) ? 'Pròximament' : TYPE_OPTIONS[type].description}</small>
              </span>
              {selectedType === type && <span className={styles.checkmark} aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      </section>

      <section className={`${styles.stepSection} ${!selectedType ? styles.stepLocked : ''}`} aria-labelledby="difficulty-heading">
        <div className={styles.stepHeading}>
          <span className={styles.stepNumber}>2</span>
          <div>
            <h2 id="difficulty-heading">Tria el teu nivell</h2>
            <p>{selectedType ? 'Pots canviar-lo quan vulguis' : 'Primer tria què vols llegir'}</p>
          </div>
        </div>
        <div className={styles.diffGrid}>
          {difficulties.map((d) => (
            <button
              key={d}
              className={`${styles.diffBtn} ${styles[`difficulty${d}`]} ${selectedDifficulty === d ? styles.diffSelected : ''}`}
              onClick={() => {
                setSelectedDifficulty(selectedDifficulty === d ? null : d);
                setSelectedSet(null);
              }}
              disabled={!selectedType}
              aria-pressed={selectedDifficulty === d}
            >
              <span className={styles.diffIcon} aria-hidden="true">{DIFFICULTY_OPTIONS[d].icon}</span>
              <strong>{DIFFICULTY_OPTIONS[d].label}</strong>
              <small>{DIFFICULTY_OPTIONS[d].description}</small>
            </button>
          ))}
        </div>
      </section>

      <section className={`${styles.stepSection} ${!selectedDifficulty ? styles.stepLocked : ''}`} aria-labelledby="exercise-heading">
        <div className={styles.stepHeading}>
          <span className={styles.stepNumber}>3</span>
          <div>
            <h2 id="exercise-heading">Escull una aventura</h2>
            <p>{selectedDifficulty ? `${availableSets.length} jocs preparats` : 'Tria un nivell per continuar'}</p>
          </div>
        </div>
        {selectedType && selectedDifficulty && (
          <div className={styles.setList}>
            {availableSets.map((set, setIndex) => (
              <button
                key={set.id}
                className={`${styles.setCard} ${selectedSet?.id === set.id ? styles.setSelected : ''}`}
                onClick={() => setSelectedSet(selectedSet?.id === set.id ? null : set)}
                aria-pressed={selectedSet?.id === set.id}
              >
                <span className={styles.setNumber} aria-hidden="true">{setIndex + 1}</span>
                <span className={styles.setContent}>
                  <strong className={styles.setTitle}>{set.title}</strong>
                  <span className={styles.setMeta}>🎯 {set.randomCount ?? set.items.length} lectures</span>
                </span>
                <span className={styles.setArrow} aria-hidden="true">{selectedSet?.id === set.id ? '✓' : '›'}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {selectedSet && (
        <div className={styles.startBar}>
          <div className={styles.selectedInfo}>
            <strong>{selectedSet.title}</strong>
            <span>{selectedSet.randomCount ?? selectedSet.items.length} lectures · El micròfon s&apos;engegarà sol</span>
          </div>
          <Button size="lg" onClick={() => setRunning(true)}>
            Comença! ▶
          </Button>
        </div>
      )}

      {selectedType && selectedDifficulty && (
        <section className={styles.endlessSection}>
          <div>
            <span className={styles.endlessLabel}>Per a valents</span>
            <h2>♾️ Repte sense fi</h2>
            <p>Llegeix sense parar i supera la teva millor ratxa.</p>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              const pool = availableSets.flatMap((set) => set.items);
              if (pool.length === 0) return;
              setEndlessPool(pool);
              setEndlessLabel(TYPE_OPTIONS[selectedType].label);
              setEndlessRunning(true);
            }}
            disabled={availableSets.flatMap((set) => set.items).length === 0}
          >
            Juga sense fi
          </Button>
        </section>
      )}

      <details className={styles.rewardsSection}>
        <summary>
          <span>🏆 Els meus premis</span>
          <strong>{featuredPokemon.filter((pokemon) => pokemon.unlocked).length}/{featuredPokemon.length || 0}</strong>
        </summary>
        <PokemonCollection
          collection={featuredPokemon}
          loading={pokemonLoading}
          emptyMessage="Encara no hi ha Pokémon disponibles per mostrar."
        />
      </details>
    </div>
  );
}
