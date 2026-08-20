"use client";

import { VoiceInput } from "./voice-input";

interface QuestionInputProps {
  query: string;
  disabled: boolean;
  onQueryChange: (value: string) => void;
  onSubmit: () => void;
}

export function QuestionInput({
  query,
  disabled,
  onQueryChange,
  onSubmit,
}: QuestionInputProps) {
  const canSubmit = !disabled && query.trim().length > 0;

  return (
    <form
      data-testid="question-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) {
          onSubmit();
        }
      }}
      className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <label htmlFor="question-input" className="sr-only">
        输入问题 Ask a question
      </label>
      <textarea
        id="question-input"
        data-testid="question-input"
        value={query}
        disabled={disabled}
        rows={3}
        placeholder="用中文或英文提问，例如：定期寿险有现金价值吗？"
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            if (canSubmit) {
              onSubmit();
            }
          }
        }}
        className="min-w-0 resize-y rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
      />
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-3">
        {/* Voice fills this box; it never presses Ask. The user reads what was
            heard before anything is asked on their behalf. */}
        <VoiceInput
          disabled={disabled}
          onTranscript={(text) =>
            // Appended, not replaced: typed text is the user's, and losing it
            // to a misfired microphone would be the worst kind of surprise.
            onQueryChange(query.trim().length > 0 ? `${query.trim()} ${text}` : text)
          }
        />
        <button
          type="submit"
          data-testid="ask-button"
          disabled={!canSubmit}
          className="min-h-11 w-full rounded-md bg-[var(--brand)] px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#16304f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-h-0"
        >
          提问 Ask
        </button>
      </div>
    </form>
  );
}
