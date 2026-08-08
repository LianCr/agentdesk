import "server-only";
import { NextResponse } from "next/server";
import { transcribeAudio } from "../../../lib/ai/transcription";

// Voice input for the question box.
//
// Audio is held only long enough to forward it. Nothing is written to disk or
// to the database, and the transcript goes straight back to the browser to be
// edited by the person who spoke it -- there is no transcript history.

export const runtime = "nodejs";
export const maxDuration = 60;

// Generous for a spoken question (a minute of Opus is well under a megabyte)
// and small enough that this is clearly not a meeting-transcription endpoint.
const MAX_BYTES = 8 * 1024 * 1024;

const ALLOWED_TYPES = [
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/mpga",
  "audio/wav",
  "audio/x-wav",
  "audio/x-m4a",
  "audio/m4a",
];

const EXTENSION: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "mp4",
  "audio/mpeg": "mp3",
  "audio/mpga": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/x-m4a": "m4a",
  "audio/m4a": "m4a",
};

const MESSAGES: Record<string, string> = {
  NO_AUDIO: "没有收到音频。No audio was received.",
  UNSUPPORTED_TYPE: "不支持的音频格式。Unsupported audio format.",
  TOO_LARGE: "录音过长,请录制简短的问题。The recording is too long; please ask a short question.",
  NO_SPEECH: "没有听清内容,请再试一次。Nothing was picked up. Please try again.",
  NOT_CONFIGURED: "语音输入未配置。Voice input is not configured.",
  TIMEOUT: "语音转写超时,请重试。Transcription timed out. Please try again.",
  PROVIDER_ERROR: "语音转写失败,请重试。Couldn't transcribe audio. Please try again.",
};

function fail(code: string, status: number): NextResponse {
  return NextResponse.json({ error: code, message: MESSAGES[code] ?? MESSAGES.PROVIDER_ERROR }, { status });
}

export async function POST(request: Request): Promise<NextResponse> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("NO_AUDIO", 400);
  }

  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) return fail("NO_AUDIO", 400);
  if (audio.size > MAX_BYTES) return fail("TOO_LARGE", 413);

  // MediaRecorder reports e.g. "audio/webm;codecs=opus".
  const contentType = (audio.type || "").split(";")[0]!.trim().toLowerCase();
  if (!ALLOWED_TYPES.includes(contentType)) return fail("UNSUPPORTED_TYPE", 415);

  try {
    const result = await transcribeAudio(audio, `question.${EXTENSION[contentType] ?? "webm"}`);
    if (!result.ok) {
      console.error(JSON.stringify({ event: "transcribe_error", code: result.code })); // code only
      return fail(result.code, result.code === "NO_SPEECH" ? 422 : 502);
    }
    return NextResponse.json({ text: result.text });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    const code = message.match(/^([A-Z][A-Z0-9_]+):/)?.[1] ?? "PROVIDER_ERROR";
    console.error(JSON.stringify({ event: "transcribe_error", code })); // sanitized: code only
    return fail("PROVIDER_ERROR", 500);
  }
}
