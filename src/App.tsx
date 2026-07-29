import { useState, useEffect } from 'react';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { AppProvider, useAppContext, AuthProvider, useAuth } from './services';
import { ProfilesPage } from './pages/ProfilesPage';
import { AuthPage } from './pages/AuthPage';
import { HomePage } from './pages/HomePage';
import { ExercisesPage } from './pages/ExercisesPage';
import { StatsPage } from './pages/StatsPage';
import { BadgesPage } from './pages/BadgesPage';
import { BattlesPage } from './pages/BattlesPage';
import { SettingsPage } from './pages/SettingsPage';
import { BottomNav } from './components/layout';
import { DatabaseReadIndicator, LoadingSpinner, WalkingPikachu } from './components/common';
import { useSettings, useProfiles } from './hooks';
import type { Profile, AppSettings as AppSettingsData } from './models';
import styles from './App.module.css';

type Page = 'home' | 'exercises' | 'stats' | 'badges' | 'battles' | 'settings';
type MicrophonePermissionState = 'unknown' | 'granted' | 'denied' | 'unsupported';

const POKEMON_SKIN_ART = {
  mew: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/151.png',
  mewtwo: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/150.png',
  pikachu: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png',
  charizard: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/6.png',
  meowth: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/52.png',
  arbok: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/24.png',
} as const;

async function requestMicrophonePermission(): Promise<Exclude<MicrophonePermissionState, 'unknown'>> {
  if (!navigator.mediaDevices?.getUserMedia) {
    return 'unsupported';
  }

  const permissionsApi = navigator.permissions as Permissions | undefined;
  if (permissionsApi?.query) {
    try {
      const permissionStatus = await permissionsApi.query({ name: 'microphone' as PermissionName });
      if (permissionStatus.state === 'granted') {
        return 'granted';
      }
      if (permissionStatus.state === 'denied') {
        return 'denied';
      }
    } catch {
      // Ignore unsupported permission names and fall back to requesting access.
    }
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return 'granted';
  } catch {
    return 'denied';
  }
}

function AppSettings({ settings }: { settings: AppSettingsData }) {
  useEffect(() => {
    document.documentElement.dataset.scheme = settings.colorScheme;
    document.documentElement.dataset.skin = settings.skin;
    document.documentElement.dataset.dyslexia = String(settings.dyslexiaMode);
    document.documentElement.dataset.fontSize = settings.fontSize;
    document.documentElement.dataset.uppercase = String(settings.uppercaseText);
  }, [settings]);

  if (settings.skin === 'pokemon') {
    return (
      <>
        <img className={`${styles.skinArt} ${styles.skinArtLeft}`} src={POKEMON_SKIN_ART.mew} alt="" aria-hidden="true" />
        <img className={`${styles.skinArt} ${styles.skinArtRight}`} src={POKEMON_SKIN_ART.mewtwo} alt="" aria-hidden="true" />
      </>
    );
  }

  if (settings.skin === 'pikachu-ash') {
    return (
      <>
        <img className={`${styles.skinArt} ${styles.skinArtLeft}`} src={POKEMON_SKIN_ART.pikachu} alt="" aria-hidden="true" />
        <img className={`${styles.skinArt} ${styles.skinArtRight}`} src={POKEMON_SKIN_ART.charizard} alt="" aria-hidden="true" />
        <WalkingPikachu />
      </>
    );
  }

  if (settings.skin === 'team-rocket') {
    return (
      <>
        <img className={`${styles.skinArt} ${styles.skinArtLeft}`} src={POKEMON_SKIN_ART.meowth} alt="" aria-hidden="true" />
        <img className={`${styles.skinArt} ${styles.skinArtRight}`} src={POKEMON_SKIN_ART.arbok} alt="" aria-hidden="true" />
      </>
    );
  }

  return null;
}

function AppContent() {
  const { user, loading: authLoading } = useAuth();
  const { currentProfile, setCurrentProfile } = useAppContext();
  const {
    loading: profilesLoading,
    updateProfile,
    databaseReadStatus,
    databaseReadError,
    loadedUserId,
  } = useProfiles(user?.id);
  const { settings, update: updateSettings } = useSettings(currentProfile?.id ?? null);
  const [page, setPage] = useState<Page>('home');
  const [requestedExerciseSetId, setRequestedExerciseSetId] = useState<string | null>(null);
  const [microphonePermission, setMicrophonePermission] = useState<MicrophonePermissionState>('unknown');
  const waitingForDatabaseRead = Boolean(user && loadedUserId !== user.id);

  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;

    let disposed = false;
    let listener: PluginListenerHandle | undefined;
    void CapacitorApp.addListener('backButton', () => {
      if (!user || !currentProfile || page === 'home') {
        void CapacitorApp.exitApp();
      } else {
        setRequestedExerciseSetId(null);
        setPage('home');
      }
    }).then((handle) => {
      if (disposed) {
        void handle.remove();
      } else {
        listener = handle;
      }
    });

    return () => {
      disposed = true;
      void listener?.remove();
    };
  }, [currentProfile, page, user]);

  useEffect(() => {
    let cancelled = false;

    void requestMicrophonePermission().then((state) => {
      if (!cancelled) {
        setMicrophonePermission(state);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setCurrentProfile(null);
    }
  }, [user, setCurrentProfile]);

  if (authLoading || (user && (profilesLoading || waitingForDatabaseRead))) return <LoadingSpinner />;

  if (!user) return <AuthPage />;

  const databaseIndicator = databaseReadStatus !== 'idle' ? (
    <div className={styles.statusIndicator}>
      <DatabaseReadIndicator status={databaseReadStatus} errorMessage={databaseReadError} />
    </div>
  ) : null;
  const microphonePermissionWarning = microphonePermission === 'denied' ? (
    <div className={styles.microphonePermissionWarning} role="alert">
      Cal activar el permís del micròfon al navegador o als ajustos de l’aplicació per fer els exercicis de lectura en veu alta.
    </div>
  ) : null;

  if (!currentProfile) {
    return (
      <>
        {databaseIndicator}
        {microphonePermissionWarning}
        <ProfilesPage onSelect={(p: Profile) => {
          setCurrentProfile(p);
          setPage('home');
        }} />
      </>
    );
  }

  const renderPage = () => {
    switch (page) {
      case 'home': return (
        <HomePage
          profile={currentProfile}
          onNavigate={(p) => setPage(p as Page)}
          onStartMission={(setId) => {
            setRequestedExerciseSetId(setId);
            setPage('exercises');
          }}
          onSwitchProfile={() => setCurrentProfile(null)}
        />
      );
      case 'exercises': return (
        <ExercisesPage
          profile={currentProfile}
          initialSetId={requestedExerciseSetId}
          onInitialSetConsumed={() => setRequestedExerciseSetId(null)}
        />
      );
      case 'stats': return <StatsPage profile={currentProfile} />;
      case 'badges': return <BadgesPage profile={currentProfile} />;
      case 'battles': return <BattlesPage profile={currentProfile} />;
      case 'settings': return <SettingsPage profile={currentProfile} settings={settings} onUpdateSettings={updateSettings} onUpdateProfile={async (p) => { await updateProfile(p); setCurrentProfile(p); }} />;
    }
  };

  return (
    <>
      <AppSettings settings={settings} />
      {databaseIndicator}
      {microphonePermissionWarning}
      <div className={styles.appLayout}>
        <BottomNav currentPage={page} onNavigate={(p) => setPage(p as Page)} />
        <main className={styles.appMain}>
          {renderPage()}
        </main>
      </div>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </AuthProvider>
  );
}
