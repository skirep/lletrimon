/**
 * Supabase Edge Function: whisper-transcribe
 *
 * Receives a Base64-encoded audio blob from the client, forwards it to the
 * OpenAI Whisper API, and returns the transcript.
 *
 * Environment variables (set via `supabase secrets set`):
 *   OPENAI_API_KEY – OpenAI API key with access to the Whisper model.
 *
 * Request body (JSON):
 *   audio    {string}  Base64-encoded audio data.
 *   mimeType {string}  MIME type of the audio (e.g. "audio/webm").
 *   language {string}  BCP-47 language code (e.g. "ca" for Catalan).
 *
 * Response body (JSON):
 *   { transcript: string }  on success
 *   { error: string }       on failure
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const WHISPER_URL = "https://api.openai.com/v1/audio/transcriptions";

const MIME_TO_EXT: Record<string, string> = {
  "audio/webm": "webm",
  "audio/webm;codecs=opus": "webm",
  "audio/ogg": "ogg",
  "audio/ogg;codecs=opus": "ogg",
  "audio/mp4": "mp4",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
};

function getExtension(mimeType: string): string {
  const base = mimeType.split(";")[0].trim();
  return MIME_TO_EXT[base] ?? MIME_TO_EXT[mimeType] ?? "webm";
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  try {
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY not configured on the server." }),
        { status: 500, headers: corsHeaders },
      );
    }

    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed." }),
        { status: 405, headers: corsHeaders },
      );
    }

    const body = await req.json() as {
      audio?: string;
      mimeType?: string;
      language?: string;
    };

    if (!body.audio) {
      return new Response(
        JSON.stringify({ error: "Missing 'audio' field in request body." }),
        { status: 400, headers: corsHeaders },
      );
    }

    // Decode Base64 audio
    const binaryStr = atob(body.audio);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const mimeType = body.mimeType ?? "audio/webm";
    const ext = getExtension(mimeType);
    const language = (body.language ?? "ca").slice(0, 2); // Whisper expects ISO-639-1

    // Build multipart/form-data for the Whisper API
    const formData = new FormData();
    formData.append("model", "whisper-1");
    formData.append("language", language);
    formData.append(
      "file",
      new Blob([bytes], { type: mimeType }),
      `audio.${ext}`,
    );

    const whisperResponse = await fetch(WHISPER_URL, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + openaiApiKey,
      },
      body: formData,
    });

    if (!whisperResponse.ok) {
      const errText = await whisperResponse.text().catch(() => whisperResponse.statusText);
      return new Response(
        JSON.stringify({ error: `Whisper API error (${whisperResponse.status}): ${errText}` }),
        { status: 502, headers: corsHeaders },
      );
    }

    const whisperData = await whisperResponse.json() as { text?: string };
    const transcript = (whisperData.text ?? "").trim();

    return new Response(
      JSON.stringify({ transcript }),
      { status: 200, headers: corsHeaders },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: `Internal error: ${msg}` }),
      { status: 500, headers: corsHeaders },
    );
  }
});
