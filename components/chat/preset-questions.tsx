"use client";

const PRESET_QUESTIONS = [
  "定期寿险有现金价值吗？",
  "IUL 的 current cap 和 guaranteed minimum cap 是多少？",
  "SecureRate 有 optional rider 吗？",
  "TermPlus level period 结束以后 premium 怎么变化？",
  "TermPlus 61 岁续保费是多少？",
] as const;

interface PresetQuestionsProps {
  disabled: boolean;
  onSelect: (question: string) => void;
}

export function PresetQuestions({ disabled, onSelect }: PresetQuestionsProps) {
  return (
    <div
      data-testid="preset-questions"
      className="flex flex-wrap gap-2"
      aria-label="示例问题 Sample questions"
    >
      {PRESET_QUESTIONS.map((question) => (
        <button
          key={question}
          type="button"
          data-testid="preset-question"
          disabled={disabled}
          onClick={() => onSelect(question)}
          className="rounded-full border border-slate-300 bg-white px-4 py-1.5 text-sm text-slate-700 shadow-sm transition-colors hover:border-[var(--brand)] hover:text-[var(--brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {question}
        </button>
      ))}
    </div>
  );
}
