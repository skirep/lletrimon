import { useState, useEffect } from 'react';
import styles from './StatsPage.module.css';
import { ProgressBar } from '../components/common';
import { sessionStorage } from '../storage';
import { formatDate, formatTime, percentageStr } from '../utils';
import { useProfileStats, useRankings } from '../hooks';
import { POKEMON_PATHS, type Profile, type ExerciseSession } from '../models';
import { pokeApiService } from '../services/pokeApiService';

const EXERCISE_TYPE_LABELS = {
  sounds: 'Sons',
  syllables: 'Síl·labes',
  words: 'Paraules',
  pseudowords: 'Pseudoparaules',
  sentences: 'Frases',
} as const;

interface StatsPageProps {
  profile: Profile;
}

type StatsTab = 'personal' | 'rankings';

const POKEMON_SPRITE_URL = (pokemonId: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemonId}.png`;

const TOTAL_POKEMON = POKEMON_PATHS.length;

function RankingPokemonSprite({ pokemonId }: { pokemonId: number }) {
  const fallbackName = POKEMON_PATHS.find((path) => path.pokemonId === pokemonId)?.fallbackName ?? `Pokémon ${pokemonId}`;
  const [pokemonName, setPokemonName] = useState(fallbackName);

  useEffect(() => {
    let cancelled = false;

    void pokeApiService.getPokemon(pokemonId, fallbackName).then((pokemon) => {
      if (!cancelled) setPokemonName(pokemon.name);
    });

    return () => {
      cancelled = true;
    };
  }, [fallbackName, pokemonId]);

  return (
    <img
      className={styles.rankingPokemonSprite}
      src={POKEMON_SPRITE_URL(pokemonId)}
      alt={pokemonName}
      title={pokemonName}
      loading="lazy"
    />
  );
}

function RankingsTab({ currentProfileId }: { currentProfileId: string }) {
  const { rankings, loading } = useRankings();

  if (loading) {
    return <p className={styles.loadingMessage}>Preparant la classificació...</p>;
  }

  if (rankings.length === 0) {
    return (
      <div className={styles.rankingsEmpty}>
        <span aria-hidden="true">🏆</span>
        <h2>Sigues el primer!</h2>
        <p>Completa exercicis i apareixeràs a la classificació.</p>
      </div>
    );
  }

  return (
    <div className={styles.rankingsList}>
      {rankings.map((entry, index) => {
        const isMe = entry.profileId === currentProfileId;
        return (
          <article
            key={entry.profileId}
            className={`${styles.rankingCard} ${isMe ? styles.rankingCardMe : ''}`}
          >
            <span className={styles.rankingPos}>
              {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
            </span>
            <div className={styles.rankingInfo}>
              <span className={styles.rankingName}>
                {entry.displayName}
                {isMe && <span className={styles.rankingMeTag}> (tu)</span>}
              </span>
              {(entry.school || entry.location) && (
                <span className={styles.rankingMeta}>
                  {[entry.school, entry.location].filter(Boolean).join(' · ')}
                </span>
              )}
            </div>
            <div className={styles.rankingStats} aria-label={`Nivell ${entry.level}, ${entry.experience} punts d'experiència`}>
              <span className={styles.rankingLevel}>Niv. {entry.level}</span>
              <span className={styles.rankingXp}>{entry.experience} XP</span>
            </div>
            <div className={styles.rankingPokemon}>
              <span className={styles.rankingPokemonCount}>
                {entry.pokemonIds.length}/{TOTAL_POKEMON} Pokémon
              </span>
              <div className={styles.rankingPokemonList} aria-label={`${entry.pokemonIds.length} Pokémon desbloquejats`}>
                {entry.pokemonIds.slice(-8).map((pokemonId) => (
                  <RankingPokemonSprite key={pokemonId} pokemonId={pokemonId} />
                ))}
                {entry.pokemonIds.length > 8 && (
                  <span className={styles.rankingPokemonMore}>+{entry.pokemonIds.length - 8}</span>
                )}
                {entry.pokemonIds.length === 0 && (
                  <span className={styles.rankingPokemonEmpty}>Encara cap</span>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function StatsPage({ profile }: StatsPageProps) {
  const [sessions, setSessions] = useState<ExerciseSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<StatsTab>('personal');
  const stats = useProfileStats(profile.id);

  useEffect(() => {
    sessionStorage.getRecentByProfile(profile.id, 30).then((s) => {
      setSessions(s.filter((x) => x.completedAt !== undefined).sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)));
      setLoading(false);
    });
  }, [profile.id]);

  if (loading) {
    return <div className="page"><p className="text-muted text-center">Carregant...</p></div>;
  }

  const hasSummaryStats = (stats?.totalExercises ?? 0) > 0;
  const hasRecentSessions = sessions.length > 0;
  const hasAnyStats = hasSummaryStats || hasRecentSessions;
  const avgScore = stats && stats.totalAttempts > 0
    ? Math.round((stats.totalCorrect / stats.totalAttempts) * 100)
    : (hasRecentSessions ? Math.round(sessions.reduce((sum, session) => sum + session.score, 0) / sessions.length) : 0);
  const bestScore = hasRecentSessions ? Math.max(...sessions.map((session) => session.score)) : null;
  const totalTimeMs = stats?.totalTimeMs ?? sessions.reduce((sum, session) => sum + ((session.completedAt ?? 0) - session.startedAt), 0);
  const totalMinutes = totalTimeMs > 0 ? Math.max(1, Math.round(totalTimeMs / 60000)) : 0;
  const errorMap = { ...stats?.errorFrequency };
  if (Object.keys(errorMap).length === 0) {
    for (const session of sessions) {
      for (const attempt of session.attempts) {
        for (const err of attempt.errorTypes) {
          errorMap[err] = (errorMap[err] ?? 0) + 1;
        }
      }
    }
  }
  const topErrors = Object.entries(errorMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const typeBreakdown = Object.entries(EXERCISE_TYPE_LABELS).map(([type, label]) => {
    const typeSessions = sessions.filter((session) => session.type === type);
    const average = typeSessions.length > 0
      ? Math.round(typeSessions.reduce((sum, session) => sum + session.score, 0) / typeSessions.length)
      : 0;
    return { type, label, count: typeSessions.length, average };
  }).filter((item) => item.count > 0);
  const progressMessage = avgScore >= 90
    ? 'Fantàstic! Estàs llegint amb molta precisió.'
    : avgScore >= 70
      ? 'Molt bé! Cada sessió et fa avançar.'
      : 'Continua practicant: cada intent compta.';
  const ERROR_LABELS: Record<string, string> = {
    b_d_confusion: 'Confusió b/d',
    p_q_confusion: 'Confusió p/q',
    omission: 'Omissió de lletres',
    inversion: 'Inversió',
    repetition: 'Repetició',
    substitution: 'Substitució',
    addition: 'Addició de síl·labes',
  };

  return (
    <div className={`page ${styles.page}`}>
      <header className={styles.pageHeader}>
        <span className={styles.eyebrow}>Segueix avançant</span>
        <h1>El teu progrés</h1>
        <p>Aquí pots veure tot el que has aconseguit, {profile.name}.</p>
      </header>

      <div className={styles.tabs} role="tablist" aria-label="Vistes d'estadístiques">
        <button
          className={`${styles.tab} ${tab === 'personal' ? styles.tabActive : ''}`}
          onClick={() => setTab('personal')}
          role="tab"
          aria-selected={tab === 'personal'}
        >
          <span aria-hidden="true">📈</span> El meu progrés
        </button>
        <button
          className={`${styles.tab} ${tab === 'rankings' ? styles.tabActive : ''}`}
          onClick={() => setTab('rankings')}
          role="tab"
          aria-selected={tab === 'rankings'}
        >
          <span aria-hidden="true">🏆</span> Classificació
        </button>
      </div>

      {tab === 'rankings' && <RankingsTab currentProfileId={profile.id} />}

      {tab === 'personal' && (
        <>
          {!hasAnyStats ? (
            <div className={styles.emptyPersonal}>
              <span className={styles.emptyIcon} aria-hidden="true">🌱</span>
              <h2>El teu camí comença aquí</h2>
              <p>Completa el primer exercici i veuràs com creix el teu progrés.</p>
            </div>
          ) : (
            <>
              <section className={styles.scoreHero} aria-labelledby="score-title">
                <div className={styles.scoreCopy}>
                  <span className={styles.scoreLabel}>La teva mitjana</span>
                  <div className={styles.scoreValue} id="score-title">{avgScore}%</div>
                  <p>{progressMessage}</p>
                </div>
                <div className={styles.scoreProgress}>
                  <ProgressBar
                    value={avgScore}
                    max={100}
                    color={avgScore >= 80 ? 'var(--color-success)' : 'var(--color-primary)'}
                  />
                  <span>Has encertat {avgScore} de cada 100 elements.</span>
                </div>
              </section>

              <div className={styles.summaryGrid}>
                <div className={styles.statCard}>
                  <span className={styles.statIcon} aria-hidden="true">📚</span>
                  <span className={styles.statValue}>{stats?.totalExercises ?? sessions.length}</span>
                  <span className={styles.statLabel}>Exercicis fets</span>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statIcon} aria-hidden="true">⭐</span>
                  <span className={styles.statValue}>{bestScore !== null ? `${bestScore}%` : '—'}</span>
                  <span className={styles.statLabel}>Millor resultat</span>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statIcon} aria-hidden="true">⏱️</span>
                  <span className={styles.statValue}>{totalMinutes} min</span>
                  <span className={styles.statLabel}>Temps llegint</span>
                </div>
              </div>

              {typeBreakdown.length > 0 && (
                <section className={styles.progressSection}>
                  <div className={styles.sectionHeading}>
                    <div>
                      <span className={styles.sectionEyebrow}>Per activitat</span>
                      <h2 className={styles.sectionTitle}>Com et va?</h2>
                    </div>
                    <span className={styles.sectionHint}>Últimes {sessions.length} sessions</span>
                  </div>
                  <div className={styles.typeList}>
                    {typeBreakdown.map((item) => (
                      <div key={item.type} className={styles.typeRow}>
                        <div className={styles.typeHeader}>
                          <span>{item.label}</span>
                          <strong>{item.average}%</strong>
                        </div>
                        <ProgressBar value={item.average} max={100} color="var(--color-primary)" />
                        <span className={styles.typeCount}>{item.count} {item.count === 1 ? 'sessió' : 'sessions'}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {topErrors.length > 0 && (
                <section className={styles.errorSection}>
                  <span className={styles.sectionEyebrow}>Un petit repte</span>
                  <h2 className={styles.sectionTitle}>Coses per practicar</h2>
                  <p className={styles.sectionDescription}>Aquestes són les que pots entrenar una mica més.</p>
                  <div className={styles.errorList}>
                    {topErrors.map(([err, count]) => (
                      <div key={err} className={styles.errorRow}>
                        <span className={styles.errorName}>{ERROR_LABELS[err] ?? err}</span>
                        <span className={styles.errorCount}>{count} {count === 1 ? 'vegada' : 'vegades'}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className={styles.sessionSection}>
                <div className={styles.sectionHeading}>
                  <div>
                    <span className={styles.sectionEyebrow}>El teu historial</span>
                    <h2 className={styles.sectionTitle}>Últimes sessions</h2>
                  </div>
                </div>
                {hasRecentSessions ? (
                  <div className={styles.sessionList}>
                    {sessions.slice(0, 15).map((session) => (
                      <article key={session.id} className={styles.sessionCard}>
                        <div className={`${styles.sessionScore} ${session.score >= 80 ? styles.scoreHigh : session.score >= 50 ? styles.scoreMedium : styles.scoreLow}`}>
                          {session.score}%
                        </div>
                        <div className={styles.sessionInfo}>
                          <div className={styles.sessionType}>{EXERCISE_TYPE_LABELS[session.type] ?? session.type}</div>
                          <div className={styles.sessionMeta}>
                            {percentageStr(session.correctItems, session.totalItems)} correctes
                            · {formatTime(Math.round(session.averageTimeMs))} per element
                          </div>
                        </div>
                        <div className={styles.sessionDate}>
                          {formatDate(session.completedAt ?? session.startedAt)}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className={styles.sessionCard}>
                    <p>No hi ha sessions recents desades en aquest dispositiu.</p>
                  </div>
                )}
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
