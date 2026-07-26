import type { SpeechEngine, SpeechEngineOptions, SpeechRecognitionResult } from './SpeechEngine';

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
    SpeechGrammarList?: new () => SpeechGrammarList;
    webkitSpeechGrammarList?: new () => SpeechGrammarList;
  }
}

interface SpeechGrammarList {
  length: number;
  addFromString(grammar: string, weight?: number): void;
  item(index: number): SpeechGrammar;
  [index: number]: SpeechGrammar;
}

interface SpeechGrammar {
  src: string;
  weight: number;
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  grammars: SpeechGrammarList | null;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult2;
  [index: number]: SpeechRecognitionResult2;
}

interface SpeechRecognitionResult2 {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

export class WebSpeechEngine implements SpeechEngine {
  onResult: ((result: SpeechRecognitionResult) => void) | null = null;
  onError: ((error: string) => void) | null = null;
  onEnd: (() => void) | null = null;

  private recognition: SpeechRecognition | null = null;

  private mapError(error: string): string {
    switch (error.toLowerCase()) {
      case 'not-allowed':
      case 'service-not-allowed':
        return 'Permís de micròfon denegat. Activa el micròfon al navegador i torna-ho a provar.';
      case 'audio-capture':
        return 'No s\'ha detectat cap micròfon disponible.';
      case 'no-speech':
        return 'No s\'ha detectat veu. Torna-ho a provar.';
      default:
        return error;
    }
  }

  isSupported(): boolean {
    return !!(window.SpeechRecognition ?? window.webkitSpeechRecognition);
  }

  start(options: Partial<SpeechEngineOptions> = {}): void {
    if (!this.isSupported()) {
      this.onError?.('Web Speech API no disponible en aquest navegador');
      return;
    }
    if (!window.isSecureContext) {
      this.onError?.('El reconeixement de veu necessita una connexió segura (HTTPS o localhost).');
      return;
    }

    const SpeechRecognitionCtor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    // Nullify handlers on any previous recognition to prevent stale callbacks
    // from the old session firing through the engine's current onResult callback.
    if (this.recognition) {
      this.recognition.onresult = null;
      this.recognition.onerror = null;
      this.recognition.onend = null;
    }

    this.recognition = new SpeechRecognitionCtor();
    this.recognition.lang = options.language ?? 'ca-ES';
    this.recognition.continuous = options.continuous ?? false;
    this.recognition.interimResults = options.interimResults ?? true;
    this.recognition.maxAlternatives = 5;

    // When caller provides expected words/syllables, build a JSGF grammar and
    // feed it to the recogniser so it biases towards those tokens.
    // Chrome supports webkitSpeechGrammarList; other browsers ignore it safely.
    const hints = options.hints ?? [];
    if (hints.length > 0) {
      const GrammarListCtor = window.SpeechGrammarList ?? window.webkitSpeechGrammarList;
      if (GrammarListCtor) {
        const grammarList = new GrammarListCtor();
        const alternatives = hints.join(' | ');
        grammarList.addFromString(
          `#JSGF V1.0; grammar hints; public <hint> = ${alternatives};`,
          1,
        );
        this.recognition.grammars = grammarList;
      }
    }

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      const result = event.results[event.results.length - 1];
      const alternatives = [];
      for (let i = 0; i < result.length; i++) {
        alternatives.push({
          transcript: result[i].transcript.trim().toLowerCase(),
          confidence: result[i].confidence,
        });
      }

      // Build a full transcript from all chunks for the current utterance.
      // Web Speech may split one spoken sentence into multiple results.
      const fullTranscript = Array.from({ length: event.results.length }, (_, i) => event.results[i][0]?.transcript ?? '')
        .join(' ')
        .trim()
        .toLowerCase();

      const dedupedAlternatives = [
        { transcript: fullTranscript, confidence: alternatives[0]?.confidence ?? 0 },
        ...alternatives,
      ].filter((alt, idx, list) => alt.transcript && list.findIndex((candidate) => candidate.transcript === alt.transcript) === idx);

      this.onResult?.({
        transcript: fullTranscript || alternatives[0]?.transcript || '',
        confidence: dedupedAlternatives[0]?.confidence ?? 0,
        isFinal: result.isFinal,
        alternatives: dedupedAlternatives,
      });
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      this.onError?.(this.mapError(event.error));
    };

    this.recognition.onend = () => {
      this.onEnd?.();
    };

    try {
      this.recognition.start();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.onError?.(`No s'ha pogut iniciar el reconeixement: ${message}`);
      this.recognition = null;
    }
  }

  stop(): void {
    if (this.recognition) {
      // Nullify handlers before aborting so no late callbacks fire
      this.recognition.onresult = null;
      this.recognition.onerror = null;
      this.recognition.onend = null;
      this.recognition.abort();
      this.recognition = null;
    }
  }
}
