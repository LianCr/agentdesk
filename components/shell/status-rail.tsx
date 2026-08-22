import type { ReactNode } from "react";

// The status rail: the one element every result surface shares.
//
// A dark strip of mono, upper-case cells -- the language of a terminal
// header -- that states the verified condition of what is below it. It holds
// facts the code computed (evidence, sources, routing, progress) and never an
// action: the single action lives in the amber card beneath, so the rail is
// read and the card is acted on.

export type RailTone = "neutral" | "ok" | "attention" | "stop";

const VALUE_TONE: Record<RailTone, string> = {
  neutral: "text-white",
  ok: "text-[#7bd65a]",
  attention: "text-[#ffc857]",
  stop: "text-[#ff7b6b]",
};

export function RailCell({
  testId,
  caption,
  tone = "neutral",
  children,
  className = "",
  ...rest
}: {
  testId?: string;
  caption: string;
  tone?: RailTone;
  children: ReactNode;
  className?: string;
} & Record<`data-${string}`, string | undefined>) {
  return (
    <div
      data-testid={testId}
      {...rest}
      className={`flex min-w-0 flex-col gap-1 border-l border-[var(--brand-2)] px-4 py-2.5 first:border-l-0 first:pl-0 ${className}`}
    >
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">{caption}</span>
      <span className={`text-sm font-medium leading-tight ${VALUE_TONE[tone]}`}>{children}</span>
    </div>
  );
}

export function StatusRail({
  children,
  className = "",
  ...rest
}: {
  children: ReactNode;
  className?: string;
  role?: string;
  "aria-label"?: string;
} & Record<`data-${string}`, string | undefined>) {
  return (
    <section
      {...rest}
      className={`flex flex-wrap items-stretch gap-y-1 rounded-sm bg-[var(--brand)] px-4 py-1 text-white ${className}`}
    >
      {children}
    </section>
  );
}
