import "server-only";
import { existsSync } from "node:fs";

// Speech-to-text for the question box. Not TTS: nothing here produces audio.
//
// Called through the REST endpoint with the built-in fetch rather than an SDK.
// The AI SDK dependency already here is a chat-model factory; adding a package
// to make one multipart POST would be more moving parts than the feature has.
//
// The key stays on the server. A browser that could hold it could spend the
// account, so the audio makes a round trip instead.

export const TRANSCRIBE_MODEL = "gpt-4o-mini-transcribe";

/**
 * Vocabulary hint. This demo has exactly three fictional products and a small
 * fixed set of insurance terms, and without the hint the model reliably heard
 * "secure rate ... serena" for "SecureRate ... surrender charges" and
 * "有限金价值" for "有现金价值". It biases spelling only -- it cannot add a
 * product, change a number, or answer anything.
 */
const VOCABULARY_HINT =
  "Insurance questions about Demo TermPlus 20, Demo IndexFlex UL, Demo SecureRate 5. " +
  "Terms: cash value, surrender charge, market value adjustment, cap, participation rate, " +
  "rider, illustration, guaranteed minimum, level period, no-lapse guarantee.";
const ENDPOINT = "https://api.openai.com/v1/audio/transcriptions";
const TIMEOUT_MS = 30_000;

let envLoaded = false;
function loadEnv(): void {
  if (envLoaded) return;
  if (existsSync(".env")) process.loadEnvFile(".env");
  envLoaded = true;
}

export type TranscriptionResult =
  | { ok: true; text: string }
  | { ok: false; code: "NO_SPEECH" | "PROVIDER_ERROR" | "TIMEOUT" | "NOT_CONFIGURED" };

/**
 * Transcribes short spoken questions. No language parameter is sent: the model
 * handles Chinese and English on its own, and a dropdown would ask the user to
 * declare something they are about to demonstrate anyway.
 */
export async function transcribeAudio(audio: Blob, filename: string): Promise<TranscriptionResult> {
  loadEnv();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, code: "NOT_CONFIGURED" };

  const form = new FormData();
  form.append("file", audio, filename);
  form.append("model", TRANSCRIBE_MODEL);
  form.append("prompt", VOCABULARY_HINT);

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    return { ok: false, code: timedOut ? "TIMEOUT" : "PROVIDER_ERROR" };
  }

  if (!response.ok) return { ok: false, code: "PROVIDER_ERROR" };

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, code: "PROVIDER_ERROR" };
  }

  const text = (body as { text?: unknown }).text;
  if (typeof text !== "string" || text.trim().length === 0) {
    // Silence, or a recording too short to contain anything.
    return { ok: false, code: "NO_SPEECH" };
  }
  return { ok: true, text: text.trim() };
}
