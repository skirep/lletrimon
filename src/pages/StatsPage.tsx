import { useState, useEffect } from 'react';
import styles from './StatsPage.module.css';
import { sessionStorage } from '../storage';
import { formatDate, formatTime, percentageStr } from '../utils';
import { useProfileStats, useRankings } from '../hooks';
import { POKEMON_PATHS, type Profile, type ExerciseSession } from '../models';

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

function RankingsTab({ currentProfileId }: { currentProfileId: string }) {
  const { rankings, loading } = useRankings();

  if (loading) {
    return <p className="text-muted text-center">Carregant rànquing...</p>;
  }

  if (rankings.length === 0) {
    return (
      <div className={styles.rankingsEmpty}>
        <span>🏆</span>
        <p className="text-muted">El rànquing encara no té entrades. Completa exercicis per aparèixer-hi!</p>
      </div>
    );
  }

  return (
    <div className={styles.rankingsList}>
      {rankings.map((entry, index) => {
        const isMe = entry.profileId === currentProfileId;
        return (
          <div
            key={entry.profileId}
            className={`card ${styles.rankingCard} ${isMe ? styles.rankingCardMe : ''}`}
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
            <div className={styles.rankingStats}>
              <span className={styles.rankingLevel}>Niv. {entry.level}</span>
              <span className={styles.rankingXp}>{entry.experience} XP</span>
            </div>
            <div className={styles.rankingPokemon}>
              <span className={styles.rankingPokemonCount}>
                {entry.pokemonIds.length}/{TOTAL_POKEMON} Pokémon
              </span>
              <div className={styles.rankingPokemonList} aria-label={`${entry.pokemonIds.length} Pokémon desbloquejats`}>
                {entry.pokemonIds.slice(-8).map((pokemonId) => (
                  <img
                    key={pokemonId}
                    className={styles.rankingPokemonSprite}
                    src={POKEMON_SPRITE_URL(pokemonId)}
                    alt={`Pokémon número ${pokemonId}`}
                    loading="lazy"
                  />
                ))}
                {entry.pokemonIds.length > 8 && (
                  <span className={styles.rankingPokemonMore}>+{entry.pokemonIds.length - 8}</span>
                )}
                {entry.pokemonIds.length === 0 && (
                  <span className={styles.rankingPokemonEmpty}>Encara cap</span>
                )}
              </div>
            </div>
          </div>
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
      <h1 className="page-title">Estadístiques</h1>

      <details className="info-box">
        <summary>ℹ️ Com funciona aquesta pantalla?</summary>
        <div className="info-box-content">
          <p>Aquí pots seguir el teu progrés:</p>
          <ul>
            <li><strong>📊 Les meves:</strong> veu el total d'exercicis, la puntuació mitjana, el millor resultat, el temps total practicat i els errors més freqüents que has comès.</li>
            <li><strong>🏆 Rànquing:</strong> compara el teu nivell, XP i col·lecció de Pokémon amb els d'altres jugadors de tot arreu.</li>
          </ul>
          <p>Com més exercicis facis, millor reflectiran les estadístiques el teu progrés real.</p>
        </div>
      </details>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === 'personal' ? styles.tabActive : ''}`}
          onClick={() => setTab('personal')}
        >
          📊 Les meves
        </button>
        <button
          className={`${styles.tab} ${tab === 'rankings' ? styles.tabActive : ''}`}
          onClick={() => setTab('rankings')}
        >
          🏆 Rànquing
        </button>
      </div>

      {tab === 'rankings' && <RankingsTab currentProfileId={profile.id} />}

      {tab === 'personal' && (
        <>
          {!hasAnyStats ? (
            <div className={styles.emptyPersonal}>
              <span className={styles.emptyIcon}>📊</span>
              <p className="text-muted">Encara no tens cap exercici completat. Practica per veure les estadístiques!</p>
            </div>
          ) : (
            <>
              <div className={styles.summaryGrid}>
                <div className={`card ${styles.statCard}`}>
                  <span className={styles.statValue}>{stats?.totalExercises ?? sessions.length}</span>
                  <span className={styles.statLabel}>Exercicis</span>
                </div>
                <div className={`card ${styles.statCard}`}>
                  <span className={styles.statValue}>{avgScore}%</span>
                  <span className={styles.statLabel}>Mitjana</span>
                </div>
                <div className={`card ${styles.statCard}`}>
                  <span className={styles.statValue}>{bestScore !== null ? `${bestScore}%` : '—'}</span>
                  <span className={styles.statLabel}>Millor</span>
                </div>
                <div className={`card ${styles.statCard}`}>
                  <span className={styles.statValue}>{totalMinutes} min</span>
                  <span className={styles.statLabel}>Temps total</span>
                </div>
              </div>

              {topErrors.length > 0 && (
                <section className={`card ${styles.errorSection}`}>
                  <h2 className={styles.sectionTitle}>Errors més freqüents</h2>
                  <div className={styles.errorList}>
                    {topErrors.map(([err, count]) => (
                      <div key={err} className={styles.errorRow}>
                        <span className={styles.errorName}>{ERROR_LABELS[err] ?? err}</span>
                        <span className={styles.errorCount}>{count}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className={styles.sessionSection}>
                <h2 className={styles.sectionTitle}>Sessions recents</h2>
                {hasRecentSessions ? (
                  <div className={styles.sessionList}>
                    {sessions.slice(0, 15).map((session) => (
                      <div key={session.id} className={`card ${styles.sessionCard}`}>
                        <div className={styles.sessionScore} style={{
                          color: session.score >= 80 ? 'var(--color-success)' : session.score >= 50 ? 'var(--color-warning)' : 'var(--color-error)'
                        }}>
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
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={`card ${styles.sessionCard}`}>
                    <p className="text-muted">No hi ha sessions recents desades en aquest dispositiu.</p>
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
