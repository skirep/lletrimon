/**
 * WhisperEngine – records audio via MediaRecorder and transcribes it with
 * OpenAI Whisper through the `whisper-transcribe` Supabase Edge Function.
 *
 * This engine is better than the Web Speech API for very short tokens
 * (syllables, isolated sounds) because Whisper is not biased towards
 * complete words or phrases.
 *
 * Lifecycle:
 *  start() → opens mic, begins recording
 *  stop()  → stops recording, sends audio to the edge function, fires onResult
 *
 * The engine automatically aborts if stop() is not called within the
 * `maxDurationMs` window (default 8 s) to avoid orphaned recordings.
 */

import type { SpeechEngine, SpeechEngineOptions, SpeechRecognitionResult } from './SpeechEngine';

const EDGE_FUNCTION_PATH = '/functions/v1/whisper-transcribe';
const DEFAULT_MAX_DURATION_MS = 8_000;

export class WhisperEngine implements SpeechEngine {
  onResult: ((result: SpeechRecognitionResult) => void) | null = null;
  onError: ((error: string) => void) | null = null;
  onEnd: (() => void) | null = null;

  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private abortTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  /** Base URL of the Supabase project (e.g. https://xxxx.supabase.co). */
  private readonly supabaseUrl: string;
  /** Supabase anon key sent as Authorization header. */
  private readonly anonKey: string;

  constructor(
    supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '',
    anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '',
  ) {
    this.supabaseUrl = supabaseUrl;
    this.anonKey = anonKey;
  }

  isSupported(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== 'undefined'
    );
  }

  start(options: Partial<SpeechEngineOptions> = {}): void {
    if (!this.isSupported()) {
      this.onError?.('El navegador no suporta l\'enregistrament d\'àudio.');
      return;
    }
    if (!window.isSecureContext) {
      this.onError?.('El reconeixement de veu necessita una connexió segura (HTTPS o localhost).');
      return;
    }
    if (!this.supabaseUrl || !this.anonKey) {
      this.onError?.('Configuració de Supabase no disponible per a Whisper.');
      return;
    }

    this.stopped = false;
    this.chunks = [];

    const language = options.language ?? 'ca';

    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      if (this.stopped) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      this.stream = stream;
      this.mediaRecorder = new MediaRecorder(stream);

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.chunks.push(e.data);
      };

      this.mediaRecorder.onstop = () => {
        this._finalise(language);
      };

      this.mediaRecorder.start();

      // Safety cap: auto-stop after maxDurationMs to avoid orphaned recordings.
      const maxMs = DEFAULT_MAX_DURATION_MS;
      this.abortTimeoutId = setTimeout(() => {
        if (this.mediaRecorder?.state === 'recording') {
          this.stop();
        }
      }, maxMs);
    }).catch((err: unknown) => {
      const name = err instanceof DOMException ? err.name : '';
      const message = name === 'NotAllowedError' || name === 'PermissionDeniedError'
        ? 'Permís de micròfon denegat. Activa el micròfon als permisos de l’aplicació i torna-ho a provar.'
        : name === 'NotFoundError'
          ? 'No s’ha detectat cap micròfon disponible.'
          : `No s'ha pogut accedir al micròfon: ${err instanceof Error ? err.message : String(err)}`;
      this.onError?.(message);
    });
  }

  stop(): void {
    this.stopped = true;
    if (this.abortTimeoutId !== null) {
      clearTimeout(this.abortTimeoutId);
      this.abortTimeoutId = null;
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    } else {
      // Nothing was recording; fire onEnd immediately.
      this.onEnd?.();
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }

  private async _finalise(language: string): Promise<void> {
    try {
      if (this.chunks.length === 0) {
        this.onError?.('No s\'ha detectat àudio.');
        this.onEnd?.();
        return;
      }

      const mimeType = this.mediaRecorder?.mimeType ?? 'audio/webm';
      const blob = new Blob(this.chunks, { type: mimeType });
      this.chunks = [];

      const arrayBuffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      const url = `${this.supabaseUrl}${EDGE_FUNCTION_PATH}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + this.anonKey,
        },
        body: JSON.stringify({ audio: base64, mimeType, language }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => response.statusText);
        this.onError?.(`Error de transcripció (${response.status}): ${text}`);
        this.onEnd?.();
        return;
      }

      const data = await response.json() as { transcript?: string; error?: string };

      if (data.error) {
        this.onError?.(data.error);
        this.onEnd?.();
        return;
      }

      const transcript = (data.transcript ?? '').trim().toLowerCase();

      const result: SpeechRecognitionResult = {
        transcript,
        confidence: 0.9,
        isFinal: true,
        alternatives: transcript ? [{ transcript, confidence: 0.9 }] : [],
      };
      this.onResult?.(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const message = err instanceof TypeError
        ? 'No s’ha pogut connectar al servei de transcripció. Comprova la connexió a Internet.'
        : `Error en el reconeixement: ${msg}`;
      this.onError?.(message);
    } finally {
      this.onEnd?.();
    }
  }
}
