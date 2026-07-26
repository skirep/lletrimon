import styles from './BottomNav.module.css';

interface NavItem {
  id: string;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Inici', icon: '🏠' },
  { id: 'exercises', label: 'Exercicis', icon: '📚' },
  { id: 'stats', label: 'Estadístiques', icon: '📊' },
  { id: 'badges', label: 'Pokémon', icon: '🐾' },
  { id: 'battles', label: 'Lluites', icon: '⚔️' },
  { id: 'settings', label: 'Ajustos', icon: '⚙️' },
];

interface BottomNavProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export function BottomNav({ currentPage, onNavigate }: BottomNavProps) {
  return (
    <nav className={styles.nav} aria-label="Navegació principal">
      <div className={styles.brand} aria-hidden="true">
        <span className={styles.brandIcon}>🔤</span>
        <span className={styles.brandName}>Lletrimon</span>
      </div>
      <div className={styles.items}>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`${styles.item} ${currentPage === item.id ? styles.active : ''}`}
            onClick={() => onNavigate(item.id)}
            aria-label={item.label}
            aria-current={currentPage === item.id ? 'page' : undefined}
          >
            <span className={styles.icon}>{item.icon}</span>
            <span className={styles.label}>{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
