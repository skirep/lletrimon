import { useState } from 'react';
import styles from './SettingsPage.module.css';
import type {
  Profile,
  FontSize,
  ColorScheme,
  SkinId,
  AppSettings,
  ExerciseType,
  SpeechRecognitionExerciseType,
} from '../models';

interface SettingsPageProps {
  profile: Profile;
  settings: AppSettings;
  onUpdateSettings: (partial: Partial<Omit<AppSettings, 'profileId'>>) => Promise<void>;
  onUpdateProfile: (profile: Profile) => Promise<void>;
}

const FONT_SIZES: { id: FontSize; label: string }[] = [
  { id: 'small', label: 'Petit' },
  { id: 'medium', label: 'Mitjà' },
  { id: 'large', label: 'Gran' },
  { id: 'xlarge', label: 'Molt gran' },
];

const COLOR_SCHEMES: { id: ColorScheme; label: string; emoji: string }[] = [
  { id: 'default', label: 'Per defecte', emoji: '🎨' },
  { id: 'high-contrast', label: 'Alt contrast', emoji: '⚫' },
  { id: 'warm', label: 'Calentet', emoji: '🟡' },
  { id: 'cool', label: 'Fresquet', emoji: '🔵' },
];

const SKINS: { id: SkinId; label: string; description: string; emoji: string }[] = [
  { id: 'original', label: 'Original', description: 'L\'aspecte clàssic de Lletrimon', emoji: '📖' },
  { id: 'pokemon', label: 'Pokémon', description: 'Amb la Mew i la MewTwo', emoji: '✨' },
  { id: 'pikachu-ash', label: 'Pikachu i Ash', description: 'Amb el Pikachu i el Charizard', emoji: '⚡' },
  { id: 'team-rocket', label: 'Team Rocket', description: 'Prepareu-vos per a la batalla!', emoji: '🚀' },
];

const READING_SPEEDS: { id: number; label: string }[] = [
  { id: 1, label: 'Ràpida (1s)' },
  { id: 2, label: 'Normal (2s)' },
  { id: 4, label: 'Tranquil·la (4s)' },
  { id: 6, label: 'Molt tranquil·la (6s)' },
  { id: 10, label: 'Super tranquil·la (10s)' },
  { id: 12, label: 'Ultra tranquil·la (12s)' },
];

const EXERCISE_SPEED_TYPES: { id: ExerciseType; label: string }[] = [
  { id: 'sounds', label: 'Sons' },
  { id: 'syllables', label: 'Síl·labes' },
  { id: 'words', label: 'Paraules' },
  { id: 'pseudowords', label: 'Pseudoparaules' },
  { id: 'sentences', label: 'Frases' },
];

const SPEECH_RECOGNITION_TYPES: { id: SpeechRecognitionExerciseType; label: string }[] = [
  { id: 'syllables', label: 'Síl·labes' },
  { id: 'words', label: 'Paraules' },
  { id: 'pseudowords', label: 'Paraules inventades' },
  { id: 'sentences', label: 'Frases' },
];

const CORRECT_THRESHOLD_OPTIONS = [0.65, 0.7, 0.75, 0.8, 0.85, 0.9];
const ALMOST_THRESHOLD_OPTIONS = [0.35, 0.45, 0.55, 0.65, 0.75];

export function SettingsPage({ profile, settings, onUpdateSettings: update, onUpdateProfile }: SettingsPageProps) {
  const [name, setName] = useState(profile.name);
  const [school, setSchool] = useState(profile.school ?? '');
  const [location, setLocation] = useState(profile.location ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await onUpdateProfile({
      ...profile,
      name: name.trim(),
      school: school.trim() || undefined,
      location: location.trim() || undefined,
      updatedAt: Date.now(),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className={`page ${styles.page}`}>
      <h1 className="page-title">Ajustos</h1>

      <details className="info-box">
        <summary>ℹ️ Com funciona aquesta pantalla?</summary>
        <div className="info-box-content">
          <p>Aquí pots personalitzar l'experiència de l'aplicació:</p>
          <ul>
            <li><strong>Perfil:</strong> canvia el teu nom, escola i població per aparèixer al rànquing.</li>
            <li><strong>Mida de la lletra:</strong> ajusta la mida del text per llegir-lo millor.</li>
            <li><strong>Colors / Skin:</strong> tria l'aspecte visual de l'aplicació.</li>
            <li><strong>Tipus de lletra:</strong> la lletra per a dislèxia facilita distingir lletres similars com b/d.</li>
            <li><strong>Majúscules:</strong> mostra el text dels exercicis tot en majúscules.</li>
            <li><strong>Velocitat de lectura:</strong> temps que tens per llegir cada element en veu alta.</li>
            <li><strong>Reconeixement de veu:</strong> ajusta el percentatge de semblança necessari per validar la resposta.</li>
            <li><strong>Mode dislèxia:</strong> activa espaiament especial per millorar la llegibilitat.</li>
          </ul>
          <p>Tots els canvis es guarden automàticament.</p>
        </div>
      </details>

      {/* Profile */}
      <section className={`card ${styles.section}`}>
        <h2 className={styles.sectionTitle}>Perfil</h2>
        <form className={styles.profileForm} onSubmit={(e) => void handleProfileSave(e)}>
          <div className={styles.profileField}>
            <label className={styles.profileLabel} htmlFor="settings-name">Nom d&apos;usuari</label>
            <input
              id="settings-name"
              className={styles.profileInput}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
              placeholder="El teu nom..."
            />
          </div>
          <div className={styles.profileField}>
            <label className={styles.profileLabel} htmlFor="settings-school">Escola</label>
            <input
              id="settings-school"
              className={styles.profileInput}
              type="text"
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              maxLength={60}
              placeholder="Nom de l'escola (opcional)"
            />
          </div>
          <div className={styles.profileField}>
            <label className={styles.profileLabel} htmlFor="settings-location">Població</label>
            <input
              id="settings-location"
              className={styles.profileInput}
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              maxLength={60}
              placeholder="Població (opcional)"
            />
          </div>
          <button
            type="submit"
            className={`${styles.saveBtn} ${saved ? styles.saveBtnDone : ''}`}
            disabled={saving || !name.trim()}
          >
            {saved ? '✅ Guardat!' : saving ? 'Guardant...' : 'Guardar perfil'}
          </button>
        </form>
      </section>
      <section className={`card ${styles.section}`}>
        <h2 className={styles.sectionTitle}>Mida de la lletra</h2>
        <div className={styles.optionGrid}>
          {FONT_SIZES.map((fs) => (
            <button
              key={fs.id}
              className={`${styles.optBtn} ${settings.fontSize === fs.id ? styles.optSelected : ''}`}
              onClick={() => void update({ fontSize: fs.id })}
            >
              {fs.label}
            </button>
          ))}
        </div>
      </section>

      {/* Color scheme */}
      <section className={`card ${styles.section}`}>
        <h2 className={styles.sectionTitle}>Colors</h2>
        <div className={styles.optionGrid}>
          {COLOR_SCHEMES.map((cs) => (
            <button
              key={cs.id}
              className={`${styles.optBtn} ${settings.colorScheme === cs.id ? styles.optSelected : ''}`}
              onClick={() => void update({ colorScheme: cs.id })}
            >
              {cs.emoji} {cs.label}
            </button>
          ))}
        </div>
      </section>

      <section className={`card ${styles.section}`}>
        <h2 className={styles.sectionTitle}>Skin</h2>
        <div className={styles.optionGrid}>
          {SKINS.map((skin) => (
            <button
              key={skin.id}
              className={`${styles.optBtn} ${settings.skin === skin.id ? styles.optSelected : ''}`}
              onClick={() => void update({ skin: skin.id })}
            >
              <span>{skin.emoji} {skin.label}</span>
              <span className="text-muted" style={{ display: 'block', fontSize: '13px', marginTop: '4px' }}>
                {skin.description}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Font type */}
      <section className={`card ${styles.section}`}>
        <h2 className={styles.sectionTitle}>Tipus de lletra</h2>
        <div className={styles.optionGrid}>
          <button
            className={`${styles.optBtn} ${settings.fontFamily === 'standard' ? styles.optSelected : ''}`}
            onClick={() => void update({ fontFamily: 'standard' })}
          >
            Estàndard
          </button>
          <button
            className={`${styles.optBtn} ${styles.dyslexiaBtn} ${settings.fontFamily === 'dyslexia' ? styles.optSelected : ''}`}
            onClick={() => void update({ fontFamily: 'dyslexia' })}
          >
            Dislèxia
          </button>
        </div>
      </section>

      <section className={`card ${styles.section}`}>
        <div className={styles.toggleRow}>
          <div>
            <h2 className={styles.sectionTitle}>Text en majúscules</h2>
            <p className="text-muted" style={{ fontSize: '14px' }}>
              Mostra el text dels exercicis tot en majúscules
            </p>
          </div>
          <button
            className={`${styles.toggle} ${settings.uppercaseText ? styles.toggleOn : ''}`}
            onClick={() => void update({ uppercaseText: !settings.uppercaseText })}
            aria-label="Text en majúscules"
          >
            <span className={styles.toggleKnob} />
          </button>
        </div>
      </section>

      <section className={`card ${styles.section}`}>
        <div className={styles.toggleRow}>
          <div>
            <h2 className={styles.sectionTitle}>Mostrar resultat immediat</h2>
            <p className="text-muted" style={{ fontSize: '14px' }}>
              Mostra si l&apos;element llegit és correcte o incorrecte
            </p>
          </div>
          <button
            className={`${styles.toggle} ${settings.showReadingFeedback ? styles.toggleOn : ''}`}
            onClick={() => void update({ showReadingFeedback: !settings.showReadingFeedback })}
            aria-label="Mostrar resultat immediat"
          >
            <span className={styles.toggleKnob} />
          </button>
        </div>
      </section>

      <section className={`card ${styles.section}`}>
        <h2 className={styles.sectionTitle}>Reconeixement de veu</h2>
        <p className="text-muted" style={{ fontSize: '14px' }}>
          Baixa aquests percentatges si vols que el reconeixement sigui més permissiu.
        </p>
        {SPEECH_RECOGNITION_TYPES.map((exerciseType) => (
          <div key={exerciseType.id} style={{ marginTop: '14px' }}>
            <p className="text-muted" style={{ fontSize: '14px', marginBottom: '8px' }}>
              {exerciseType.label}
            </p>

            <p className="text-muted" style={{ fontSize: '13px', marginBottom: '8px' }}>
              Correcte
            </p>
            <div className={styles.optionGrid}>
              {CORRECT_THRESHOLD_OPTIONS.map((threshold) => (
                <button
                  key={`${exerciseType.id}-correct-${threshold}`}
                  className={`${styles.optBtn} ${settings.speechRecognitionTuning[exerciseType].correct === threshold ? styles.optSelected : ''}`}
                  onClick={() => void update({
                    speechRecognitionTuning: {
                      ...settings.speechRecognitionTuning,
                      [exerciseType.id]: {
                        ...settings.speechRecognitionTuning[exerciseType.id],
                        correct: threshold,
                      },
                    },
                  })}
                >
                  {Math.round(threshold * 100)}%
                </button>
              ))}
            </div>

            <p className="text-muted" style={{ fontSize: '13px', marginTop: '12px', marginBottom: '8px' }}>
              Gairebé correcte
            </p>
            <div className={styles.optionGrid}>
              {ALMOST_THRESHOLD_OPTIONS.map((threshold) => (
                <button
                  key={`${exerciseType.id}-almost-${threshold}`}
                  className={`${styles.optBtn} ${settings.speechRecognitionTuning[exerciseType].almost === threshold ? styles.optSelected : ''}`}
                  onClick={() => void update({
                    speechRecognitionTuning: {
                      ...settings.speechRecognitionTuning,
                      [exerciseType.id]: {
                        ...settings.speechRecognitionTuning[exerciseType.id],
                        almost: threshold,
                      },
                    },
                  })}
                >
                  {Math.round(threshold * 100)}%
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Reading speed */}
      <section className={`card ${styles.section}`}>
        <h2 className={styles.sectionTitle}>Velocitat de lectura</h2>
        <p className="text-muted" style={{ fontSize: '14px' }}>
          Configura el temps per a cada tipus d&apos;exercici
        </p>
        {EXERCISE_SPEED_TYPES.map((exerciseType) => (
          <div key={exerciseType.id} style={{ marginTop: '14px' }}>
            <p className="text-muted" style={{ fontSize: '14px', marginBottom: '8px' }}>
              {exerciseType.label}
            </p>
            <div className={styles.optionGrid}>
              {READING_SPEEDS.map((speed) => (
                <button
                  key={`${exerciseType.id}-${speed.id}`}
                  className={`${styles.optBtn} ${settings.exerciseSpeeds[exerciseType.id] === speed.id ? styles.optSelected : ''}`}
                  onClick={() => void update({
                    exerciseSpeeds: {
                      ...settings.exerciseSpeeds,
                      [exerciseType.id]: speed.id,
                    },
                  })}
                >
                  {speed.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Dyslexia mode */}
      <section className={`card ${styles.section}`}>
        <div className={styles.toggleRow}>
          <div>
            <h2 className={styles.sectionTitle}>Mode dislèxia</h2>
            <p className="text-muted" style={{ fontSize: '14px' }}>
              Espaiament i tipus de lletra especials
            </p>
          </div>
          <button
            className={`${styles.toggle} ${settings.dyslexiaMode ? styles.toggleOn : ''}`}
            onClick={() => void update({ dyslexiaMode: !settings.dyslexiaMode })}
            aria-label="Mode dislèxia"
          >
            <span className={styles.toggleKnob} />
          </button>
        </div>
      </section>

      {/* Info */}
      <p className="text-muted text-center" style={{ fontSize: '14px' }}>
        Tots els ajustos es guarden automàticament en el dispositiu
      </p>
    </div>
  );
}
