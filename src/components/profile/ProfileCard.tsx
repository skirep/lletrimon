import styles from './ProfileCard.module.css';
import { Avatar, ProgressBar } from '../common';
import type { Profile, ProfileStats } from '../../models';
import { getXpToNextLevel } from '../../models';

interface ProfileCardProps {
  profile: Profile;
  stats?: ProfileStats;
  selected?: boolean;
  onClick?: () => void;
}

export function ProfileCard({ profile, stats, selected, onClick }: ProfileCardProps) {
  const xpInfo = stats ? getXpToNextLevel(stats.experience) : null;

  return (
    <button
      className={`${styles.card} ${selected ? styles.selected : ''}`}
      onClick={onClick}
    >
      <Avatar avatarId={profile.avatar} size="lg" name={profile.name} />
      <div className={styles.info}>
        <span className={styles.name}>{profile.name}</span>
        {profile.isAdmin && <span className={styles.adminBadge}>👑 Administrador</span>}
        {stats && (
          <>
            <span className={styles.level}>Nivell {stats.level} ⭐</span>
            {xpInfo && (
              <ProgressBar
                value={xpInfo.current}
                max={xpInfo.needed}
                color="var(--color-secondary)"
              />
            )}
          </>
        )}
      </div>
    </button>
  );
}
