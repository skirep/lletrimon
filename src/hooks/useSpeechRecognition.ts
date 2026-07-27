import { useState, useCallback, useRef } from 'react';
import { WebSpeechEngine } from '../speech';
import type { SpeechEngine, SpeechRecognitionAlternativeResult } from '../speech';

export function useSpeechRecognition(engine?: SpeechEngine, hints?: string[]) {
  const engineRef = useRef<SpeechEngine>(engine ?? new WebSpeechEngine());
  const [transcript, setTranscript] = useState('');
  const [alternatives, setAlternatives] = useState<SpeechRecognitionAlternativeResult[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSupported] = useState(() => engineRef.current.isSupported());

  const start = useCallback(() => {
    setTranscript('');
    setAlternatives([]);
    setError(null);
    setIsListening(true);
    const e = engineRef.current;
    e.onResult = (result) => {
      setTranscript(result.transcript);
      setAlternatives(result.alternatives);
      if (result.isFinal) {
        setIsListening(false);
      }
    };
    e.onError = (err) => {
      setError(err);
      setIsListening(false);
    };
    e.onEnd = () => {
      setIsListening(false);
    };
    e.start({ language: 'ca-ES', continuous: false, interimResults: true, hints: hints ?? [] });
  }, [hints]);

  const stop = useCallback(() => {
    engineRef.current.stop();
    setIsListening(false);
  }, []);

  return { transcript, alternatives, isListening, error, isSupported, start, stop, setTranscript };
}
