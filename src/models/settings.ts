export type FontFamily = 'standard' | 'dyslexia';
export type FontSize = 'small' | 'medium' | 'large' | 'xlarge';
export type ColorScheme = 'default' | 'high-contrast' | 'warm' | 'cool';
export type SkinId = 'original' | 'pokemon' | 'pikachu-ash' | 'team-rocket';

export interface ExerciseSpeeds {
  sounds: number;
  syllables: number;
  words: number;
  pseudowords: number;
  sentences: number;
}

export interface AppSettings {
  profileId: string;
  speed: number;
  exerciseSpeeds: ExerciseSpeeds;
  uppercaseText: boolean;
  showReadingFeedback: boolean;
  fontSize: FontSize;
  fontFamily: FontFamily;
  colorScheme: ColorScheme;
  skin: SkinId;
  dyslexiaMode: boolean;
  timeBetweenWords: number;
  fullscreen: boolean;
}

export const DEFAULT_SETTINGS: Omit<AppSettings, 'profileId'> = {
  speed: 2,
  exerciseSpeeds: {
    sounds: 2,
    syllables: 2,
    words: 2,
    pseudowords: 2,
    sentences: 2,
  },
  uppercaseText: false,
  showReadingFeedback: false,
  fontSize: 'large',
  fontFamily: 'standard',
  colorScheme: 'default',
  skin: 'original',
  dyslexiaMode: false,
  timeBetweenWords: 0,
  fullscreen: false,
};
