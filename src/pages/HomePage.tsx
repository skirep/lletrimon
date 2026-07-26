import styles from './HomePage.module.css';
import { Avatar, ProgressBar } from '../components/common';
import { Button } from '../components/common';
import { HomeBattles } from '../components/gamification';
import { useProfileStats, useGamification, useRecommendedMission } from '../hooks';
import { getXpToNextLevel } from '../models';
import type { Profile } from '../models';

interface HomePageProps {
  profile: Profile;
  onNavigate: (page: string) => void;
  onStartMission: (setId: string) => void;
  onSwitchProfile: () => void;
}

export function HomePage({ profile, onNavigate, onStartMission, onSwitchProfile }: HomePageProps) {
  const stats = useProfileStats(profile.id);
  const { streak, dailyGoal } = useGamification(profile.id);
  const { mission, loading: missionLoading } = useRecommendedMission(profile.id);
  const xpInfo = stats ? getXpToNextLevel(stats.experience) : null;

  return (
    <div className={`page ${styles.page}`}>
      <header className={styles.hero}>
        <div className={styles.profileHeader}>
          <button className={styles.avatarBtn} onClick={onSwitchProfile} title="Canviar de perfil" aria-label="Canviar de perfil">
            <Avatar avatarId={profile.avatar} size="md" name={profile.name} />
          </button>
          <div className={styles.profileInfo}>
            <span className={styles.eyebrow}>A punt per llegir?</span>
            <h1 className={styles.greeting}>Hola, {profile.name}!</h1>
          </div>
          {stats && <span className={styles.level}>Nivell {stats.level}</span>}
        </div>
        {xpInfo && (
          <div className={styles.xpBlock}>
            <div className={styles.progressHeader}>
              <span>Progrés del nivell</span>
              <strong>{xpInfo.current} de {xpInfo.needed} XP</strong>
            </div>
            <ProgressBar value={xpInfo.current} max={xpInfo.needed} color="var(--color-secondary)" />
          </div>
        )}
      </header>

      {(dailyGoal || streak) && (
        <section className={styles.todaySection} aria-labelledby="today-title">
          <h2 id="today-title" className={styles.sectionTitle}>Avui</h2>
          <div className={styles.todayGrid}>
            {dailyGoal && (
              <div className={`${styles.todayCard} ${dailyGoal.completed ? styles.todayCardDone : ''}`}>
                <span className={styles.todayIcon} aria-hidden="true">🎯</span>
                <div className={styles.todayInfo}>
                  <span className={styles.todayLabel}>{dailyGoal.completed ? 'Objectiu fet!' : 'Objectiu diari'}</span>
                  <strong>{dailyGoal.completedExercises} de {dailyGoal.targetExercises}</strong>
                  <ProgressBar
                    value={dailyGoal.completedExercises}
                    max={dailyGoal.targetExercises}
                    color={dailyGoal.completed ? 'var(--color-success)' : 'var(--color-primary)'}
                  />
                </div>
              </div>
            )}
            {streak && (
              <div className={styles.todayCard}>
                <span className={styles.todayIcon} aria-hidden="true">🔥</span>
                <div className={styles.todayInfo}>
                  <span className={styles.todayLabel}>Ratxa</span>
                  <strong>{streak.current} {streak.current === 1 ? 'dia seguit' : 'dies seguits'}</strong>
                  <span className={styles.todayHint}>Rècord: {streak.longest} dies</span>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {(mission || missionLoading) && (
        <section className={styles.missionCard} aria-labelledby="mission-title">
          {missionLoading || !mission ? (
            <div className={styles.missionLoading}>Preparant la teva següent missió...</div>
          ) : (
            <>
              <div className={styles.missionTopline}>
                <span className={styles.missionLabel}>La teva pròxima missió</span>
                <span className={styles.missionTarget}>Meta: {mission.targetScore}%</span>
              </div>
              <h2 id="mission-title" className={styles.missionTitle}>{mission.set.title}</h2>
              <p className={styles.missionReason}>{mission.reason}</p>
              <div className={styles.missionProgress}>
                <div className={styles.missionProgressHeader}>
                  <span>La teva millor marca</span>
                  <strong>{mission.bestScore}%</strong>
                </div>
                <ProgressBar value={mission.bestScore} max={mission.targetScore} color="var(--color-primary)" />
              </div>
              <div className={styles.missionFooter}>
                <span>{mission.set.items.length} elements · {mission.attempts === 0 ? 'És nova!' : `${mission.attempts} intents`}</span>
                <Button className={styles.missionButton} size="lg" onClick={() => onStartMission(mission.set.id)}>
                  Comença
                </Button>
              </div>
            </>
          )}
        </section>
      )}

      <HomeBattles profileId={profile.id} onOpenArena={() => onNavigate('battles')} />

      <section className={styles.actions} aria-labelledby="explore-title">
        <h2 id="explore-title" className={styles.sectionTitle}>Tria què vols fer</h2>
        <Button
          className={styles.actionBtn}
          variant="primary"
          size="lg"
          onClick={() => onNavigate('exercises')}
        >
          <span aria-hidden="true">📖</span> Practicar lectura
        </Button>
        <div className={styles.grid2}>
          <Button variant="secondary" onClick={() => onNavigate('stats')}>
            <span aria-hidden="true">📊</span> El meu progrés
          </Button>
          <Button variant="secondary" onClick={() => onNavigate('badges')}>
            <span aria-hidden="true">⭐</span> Col·lecció
          </Button>
          <Button variant="secondary" onClick={() => onNavigate('battles')}>
            <span aria-hidden="true">⚔️</span> Lluites
          </Button>
        </div>
      </section>
    </div>
  );
}
