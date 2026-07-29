export interface SpeechRecognitionAlternativeResult {
  transcript: string;
  confidence: number;
}

export interface SpeechRecognitionResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
  alternatives: SpeechRecognitionAlternativeResult[];
}

export interface SpeechEngineOptions {
  language: string;
  continuous: boolean;
  interimResults: boolean;
  /** Optional list of expected words/syllables used to bias recognition. */
  hints: string[];
}

export interface SpeechEngine {
  isSupported(): boolean;
  start(options?: Partial<SpeechEngineOptions>): void;
  stop(): void;
  onResult: ((result: SpeechRecognitionResult) => void) | null;
  onAudio?: ((audioBlob: Blob) => void) | null;
  onError: ((error: string) => void) | null;
  onEnd: (() => void) | null;
}
