"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Voice input for the question box: speak, review, then send yourself.
//
// The transcript is NEVER submitted automatically. Speech recognition
// mishears, and a question about an insurance product that quietly asks
// something other than what was said is worse than no voice input at all. So
// this component's only output is text in the box the user was already going
// to read.
//
// Audio is not stored. It exists as a Blob long enough to be posted, and the
// microphone tracks are stopped as soon as recording ends -- the browser's
// recording indicator going away is the user's confirmation of that.

type VoiceState = "idle" | "recording" | "transcribing";

const ERRORS = {
  PERMISSION: "无法使用麦克风,请在浏览器中允许麦克风权限。Microphone unavailable. Please allow microphone access.",
  UNSUPPORTED: "当前浏览器不支持录音。This browser does not support recording.",
  EMPTY: "没有录到声音,请再试一次。No audio was captured. Please try again.",
  GENERIC: "语音转写失败,请重试。Couldn't transcribe audio. Please try again.",
} as const;

/** The first type this browser will actually record. */
function pickMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const type of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"]) {
    if (MediaRecorder.isTypeSupported?.(type)) return type;
  }
  return "";
}

export function VoiceInput({
  disabled,
  onTranscript,
}: {
  disabled: boolean;
  onTranscript: (text: string) => void;
}) {
  const [state, setState] = useState<VoiceState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const releaseMicrophone = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  // Leaving the page mid-recording must not leave the microphone open.
  useEffect(() => releaseMicrophone, [releaseMicrophone]);

  const transcribe = useCallback(
    async (blob: Blob) => {
      if (blob.size === 0) {
        setErrorMessage(ERRORS.EMPTY);
        setState("idle");
        return;
      }
      setState("transcribing");
      try {
        const form = new FormData();
        form.append("audio", blob, "question.webm");
        const response = await fetch("/api/transcribe", { method: "POST", body: form });
        const data = await response.json();
        if (!response.ok || typeof data?.text !== "string") {
          setErrorMessage(typeof data?.message === "string" ? data.message : ERRORS.GENERIC);
          return;
        }
        // Hands the text to the input. It does not send anything.
        onTranscript(data.text);
      } catch {
        setErrorMessage(ERRORS.GENERIC);
      } finally {
        setState("idle");
      }
    },
    [onTranscript],
  );

  const start = useCallback(async () => {
    setErrorMessage("");
    const mimeType = pickMimeType();
    if (mimeType === null || !navigator.mediaDevices?.getUserMedia) {
      setErrorMessage(ERRORS.UNSUPPORTED);
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      // Denied, dismissed, or no device. All the same to the user: they cannot
      // record, and the page keeps working without it.
      setErrorMessage(ERRORS.PERMISSION);
      return;
    }

    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      releaseMicrophone();
      void transcribe(blob);
    };
    streamRef.current = stream;
    recorderRef.current = recorder;
    recorder.start();
    setState("recording");
  }, [releaseMicrophone, transcribe]);

  const stop = useCallback(() => {
    // onstop does the rest, so the blob is assembled in exactly one place.
    recorderRef.current?.stop();
  }, []);

  const busy = disabled || state === "transcribing";

  return (
    <div data-testid="voice-input" data-state={state} className="flex flex-col items-end gap-1">
      <button
        type="button"
        data-testid="voice-button"
        disabled={busy}
        aria-label={state === "recording" ? "停止录音 Stop recording" : "语音输入 Voice input"}
        aria-pressed={state === "recording"}
        onClick={() => (state === "recording" ? stop() : void start())}
        className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
          state === "recording"
            ? "border-red-300 bg-red-50 text-red-800"
            : "border-slate-300 bg-white text-slate-700 hover:border-[var(--brand)] hover:text-[var(--brand)]"
        }`}
      >
        <span aria-hidden="true">{state === "recording" ? "■" : "🎙"}</span>
        {state === "recording"
          ? "停止 Stop"
          : state === "transcribing"
            ? "正在转写… Transcribing…"
            : "语音输入 Voice input"}
      </button>

      <div data-testid="voice-status" aria-live="polite" className="text-xs">
        {state === "recording" && (
          <span data-testid="voice-recording" className="text-red-700">
            ● 正在录音… Recording…
          </span>
        )}
        {state === "transcribing" && (
          <span data-testid="voice-transcribing" className="text-slate-600">
            正在转写… Transcribing…
          </span>
        )}
      </div>

      {errorMessage && (
        <p data-testid="voice-error" role="alert" className="max-w-sm text-right text-xs text-red-800">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
