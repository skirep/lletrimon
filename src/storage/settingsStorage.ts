import { db } from './database';
import type { AppSettings } from '../models';
import { DEFAULT_SETTINGS } from '../models';
import { supabase } from '../lib/supabase';

const ALLOWED_SPEEDS = [1, 2, 4, 6, 10, 12];
const ALLOWED_SKINS = ['original', 'pokemon', 'pikachu-ash', 'team-rocket'] as const;
const CURRENT_SETTINGS_VERSION = 2;
const MIN_CORRECT_THRESHOLD = 0.5;
const MAX_CORRECT_THRESHOLD = 0.95;
const MIN_ALMOST_THRESHOLD = 0.3;
const MIN_THRESHOLD_GAP = 0.05;

function normalizeSpeed(speed: number): number {
  if (ALLOWED_SPEEDS.includes(speed)) return speed;
  if (speed >= 12) return 12;
  if (speed >= 10) return 10;
  if (speed >= 6) return 6;
  if (speed >= 4) return 4;
  if (speed >= 2) return 2;
  return 1;
}

function normalizeExerciseSpeeds(
  speeds: Partial<AppSettings['exerciseSpeeds']> | undefined,
  fallbackSpeed: number,
): AppSettings['exerciseSpeeds'] {
  const fallback = normalizeSpeed(fallbackSpeed);
  return {
    sounds: normalizeSpeed(speeds?.sounds ?? fallback),
    syllables: normalizeSpeed(speeds?.syllables ?? fallback),
    words: normalizeSpeed(speeds?.words ?? fallback),
    pseudowords: normalizeSpeed(speeds?.pseudowords ?? fallback),
    sentences: normalizeSpeed(speeds?.sentences ?? fallback),
  };
}

function normalizeThreshold(value: number, min: number, max: number): number {
  return Math.round(Math.min(max, Math.max(min, value)) * 100) / 100;
}

function normalizeSpeechRecognitionThresholds(
  thresholds: Partial<AppSettings['speechRecognitionTuning']['words']> | undefined,
  fallback: AppSettings['speechRecognitionTuning']['words'],
): AppSettings['speechRecognitionTuning']['words'] {
  const rawAlmost = normalizeThreshold(
    thresholds?.almost ?? fallback.almost,
    MIN_ALMOST_THRESHOLD,
    MAX_CORRECT_THRESHOLD - MIN_THRESHOLD_GAP,
  );
  const correctMin = Math.max(MIN_CORRECT_THRESHOLD, rawAlmost + MIN_THRESHOLD_GAP);
  const correct = normalizeThreshold(
    thresholds?.correct ?? fallback.correct,
    correctMin,
    MAX_CORRECT_THRESHOLD,
  );
  const almost = normalizeThreshold(
    thresholds?.almost ?? fallback.almost,
    MIN_ALMOST_THRESHOLD,
    correct - MIN_THRESHOLD_GAP,
  );
  return { correct, almost };
}

function normalizeSpeechRecognitionTuning(
  tuning: Partial<AppSettings['speechRecognitionTuning']> | undefined,
): AppSettings['speechRecognitionTuning'] {
  return {
    syllables: normalizeSpeechRecognitionThresholds(
      tuning?.syllables,
      DEFAULT_SETTINGS.speechRecognitionTuning.syllables,
    ),
    words: normalizeSpeechRecognitionThresholds(
      tuning?.words,
      DEFAULT_SETTINGS.speechRecognitionTuning.words,
    ),
    pseudowords: normalizeSpeechRecognitionThresholds(
      tuning?.pseudowords,
      DEFAULT_SETTINGS.speechRecognitionTuning.pseudowords,
    ),
    sentences: normalizeSpeechRecognitionThresholds(
      tuning?.sentences,
      DEFAULT_SETTINGS.speechRecognitionTuning.sentences,
    ),
  };
}

function normalizeSkin(skin: AppSettings['skin'] | undefined): AppSettings['skin'] {
  return ALLOWED_SKINS.includes(skin ?? 'original') ? (skin ?? 'original') : 'original';
}

function normalizeSettingsPayload(profileId: string, source: Partial<AppSettings>): AppSettings {
  const baseSpeed = normalizeSpeed(source.speed ?? DEFAULT_SETTINGS.speed);
  return {
    ...DEFAULT_SETTINGS,
    ...source,
    profileId,
    speed: baseSpeed,
    exerciseSpeeds: normalizeExerciseSpeeds(source.exerciseSpeeds, baseSpeed),
    speechRecognitionTuning: normalizeSpeechRecognitionTuning(source.speechRecognitionTuning),
    uppercaseText: source.uppercaseText ?? DEFAULT_SETTINGS.uppercaseText,
    showReadingFeedback: source.showReadingFeedback ?? DEFAULT_SETTINGS.showReadingFeedback,
    skin: normalizeSkin(source.skin),
  };
}

function readLegacyCloudSettings(profileId: string, data: Record<string, unknown>): AppSettings {
  const speed = normalizeSpeed((data.speed as number | undefined) ?? DEFAULT_SETTINGS.speed);
  return normalizeSettingsPayload(profileId, {
    speed,
    exerciseSpeeds: normalizeExerciseSpeeds(
      (data.exercise_speeds as Partial<AppSettings['exerciseSpeeds']> | undefined) ?? undefined,
      speed,
    ),
    speechRecognitionTuning: normalizeSpeechRecognitionTuning(
      (data.speech_recognition_tuning as Partial<AppSettings['speechRecognitionTuning']> | undefined) ?? undefined,
    ),
    uppercaseText: (data.uppercase_text as boolean | null) ?? DEFAULT_SETTINGS.uppercaseText,
    showReadingFeedback: (data.show_reading_feedback as boolean | null) ?? DEFAULT_SETTINGS.showReadingFeedback,
    fontSize: (data.font_size as AppSettings['fontSize'] | undefined) ?? DEFAULT_SETTINGS.fontSize,
    fontFamily: (data.font_family as AppSettings['fontFamily'] | undefined) ?? DEFAULT_SETTINGS.fontFamily,
    colorScheme: (data.color_scheme as AppSettings['colorScheme'] | undefined) ?? DEFAULT_SETTINGS.colorScheme,
    skin: (data.skin as AppSettings['skin'] | undefined) ?? DEFAULT_SETTINGS.skin,
    dyslexiaMode: (data.dyslexia_mode as boolean | undefined) ?? DEFAULT_SETTINGS.dyslexiaMode,
    timeBetweenWords: (data.time_between_words as number | undefined) ?? DEFAULT_SETTINGS.timeBetweenWords,
    fullscreen: (data.fullscreen as boolean | undefined) ?? DEFAULT_SETTINGS.fullscreen,
  });
}

function upgradeCloudSettings(
  profileId: string,
  payload: Partial<AppSettings>,
  version: number,
): AppSettings {
  // Reserved for future migrations of settings_data.
  // Version 1 is already compatible with current defaults.
  if (version <= 1) {
    return normalizeSettingsPayload(profileId, payload);
  }

  return normalizeSettingsPayload(profileId, payload);
}

async function upsertSettingsToSupabase(settings: AppSettings): Promise<void> {
  const payload = {
    profile_id: settings.profileId,
    settings_version: CURRENT_SETTINGS_VERSION,
    settings_data: settings,
    // Legacy mirrored columns (backward compatibility)
    speed: settings.speed,
    exercise_speeds: settings.exerciseSpeeds,
    uppercase_text: settings.uppercaseText,
    font_size: settings.fontSize,
    font_family: settings.fontFamily,
    color_scheme: settings.colorScheme,
    skin: settings.skin,
    dyslexia_mode: settings.dyslexiaMode,
    time_between_words: settings.timeBetweenWords,
    fullscreen: settings.fullscreen,
  };

  const { error } = await supabase.from('profile_settings').upsert(payload, { onConflict: 'profile_id' });
  if (!error) return;

  // Fallback for older DB schemas without settings_version/settings_data columns.
  const legacyPayload = {
    profile_id: settings.profileId,
    speed: settings.speed,
    exercise_speeds: settings.exerciseSpeeds,
    uppercase_text: settings.uppercaseText,
    font_size: settings.fontSize,
    font_family: settings.fontFamily,
    color_scheme: settings.colorScheme,
    skin: settings.skin,
    dyslexia_mode: settings.dyslexiaMode,
    time_between_words: settings.timeBetweenWords,
    fullscreen: settings.fullscreen,
  };
  const { error: legacyError } = await supabase.from('profile_settings').upsert(legacyPayload, { onConflict: 'profile_id' });
  if (legacyError) {
    console.error('Failed to sync settings to Supabase:', legacyError.message);
  }
}

export async function loadSettingsFromSupabase(profileId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data, error } = await supabase
    .from('profile_settings')
    .select('*')
    .eq('profile_id', profileId)
    .maybeSingle();
  if (error) return;

  if (!data) {
    // If cloud settings were wiped but local settings exist, repopulate cloud.
    const localSettings = await db.settings.get(profileId);
    if (localSettings) {
      void upsertSettingsToSupabase(localSettings);
    }
    return;
  }

  const rawSettingsData = data.settings_data as Partial<AppSettings> | null;
  const cloudVersion = (data.settings_version as number | null) ?? 0;
  const cloudSettings = rawSettingsData
    ? upgradeCloudSettings(profileId, rawSettingsData, cloudVersion)
    : readLegacyCloudSettings(profileId, data as Record<string, unknown>);

  const local = await db.settings.get(profileId);
  if (!local || JSON.stringify(cloudSettings) !== JSON.stringify(local)) {
    await db.settings.put(cloudSettings);
  }

  // Backfill versioned payload or upgraded fields in cloud.
  if (!rawSettingsData || cloudVersion < CURRENT_SETTINGS_VERSION) {
    void upsertSettingsToSupabase(cloudSettings);
  }
}

export const settingsStorage = {
  async get(profileId: string): Promise<AppSettings> {
    const settings = await db.settings.get(profileId);
    if (!settings) {
      const defaults: AppSettings = { ...DEFAULT_SETTINGS, profileId };
      await db.settings.add(defaults);
      return defaults;
    }

    const updated: AppSettings = {
      ...DEFAULT_SETTINGS,
      ...settings,
      profileId,
      speed: normalizeSpeed(settings.speed),
      exerciseSpeeds: normalizeExerciseSpeeds(settings.exerciseSpeeds, settings.speed),
      speechRecognitionTuning: normalizeSpeechRecognitionTuning(settings.speechRecognitionTuning),
      skin: normalizeSkin(settings.skin),
    };

    if (JSON.stringify(updated) !== JSON.stringify(settings)) {
      await db.settings.put(updated);
      return updated;
    }

    return updated;
  },

  async save(settings: AppSettings): Promise<void> {
    await db.settings.put(settings);
    void upsertSettingsToSupabase(settings);
  },

  async update(profileId: string, partial: Partial<Omit<AppSettings, 'profileId'>>): Promise<AppSettings> {
    const current = await this.get(profileId);
    const mergedExerciseSpeeds = partial.exerciseSpeeds
      ? { ...current.exerciseSpeeds, ...partial.exerciseSpeeds }
      : current.exerciseSpeeds;
    const mergedSpeechRecognitionTuning = partial.speechRecognitionTuning
      ? { ...current.speechRecognitionTuning, ...partial.speechRecognitionTuning }
      : current.speechRecognitionTuning;

    const partialSpeed = partial.speed !== undefined ? normalizeSpeed(partial.speed) : undefined;
    const baseSpeed = partialSpeed ?? current.speed;
    const normalizedExerciseSpeeds = normalizeExerciseSpeeds(mergedExerciseSpeeds, baseSpeed);
    const normalizedSpeechRecognitionTuning = normalizeSpeechRecognitionTuning(mergedSpeechRecognitionTuning);

    const updated: AppSettings = {
      ...current,
      ...partial,
      speed: partialSpeed ?? normalizedExerciseSpeeds.sounds,
      exerciseSpeeds: normalizedExerciseSpeeds,
      speechRecognitionTuning: normalizedSpeechRecognitionTuning,
      skin: normalizeSkin((partial.skin ?? current.skin) as AppSettings['skin']),
    };

    await db.settings.put(updated);
    void upsertSettingsToSupabase(updated);
    return updated;
  },
};
