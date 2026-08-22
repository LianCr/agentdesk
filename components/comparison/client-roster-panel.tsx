"use client";

import { useState } from "react";
import { GOAL_LABELS } from "./client-summary";
import type { UiClientRosterEntry } from "./types";

// Who this demo can compare products for.
//
// The counterpart to the assistant page's knowledge base panel, and deliberately
// built from the same parts: same collapsed-by-default disclosure, same card
// list, same footnote slot. One panel says what the system is searching, the
// other says who it is searching for.
//
// Two things are absent on purpose. The fixtures' `riskTier` and `expected`
// blocks are frozen ground truth for the evaluations that runtime code never
// reads; putting them on screen would suggest the risk flags and workflow
// decision are looked up rather than computed. What IS shown is the replacement
// context, because that one is derived at runtime from the client's own words.

const CARD_BUTTON =
  "w-full rounded border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-1";

export function ClientRosterPanel({
  clients,
  selectedCaseId,
  onSelect,
}: {
  clients: UiClientRosterEntry[];
  selectedCaseId: string;
  onSelect: (caseId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  if (clients.length === 0) return null;

  return (
    <section
      data-testid="client-roster"
      className="rounded-lg border border-slate-200 bg-white px-4 py-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-700">
          <span className="font-medium text-slate-900">客户背景库 Client background</span>{" "}
          <span className="text-slate-400">·</span>{" "}
          <span data-testid="roster-summary">
            {clients.length} 位演示客户 demo clients
          </span>
        </p>
        <button
          type="button"
          data-testid="roster-toggle"
          aria-expanded={open}
          aria-controls="client-roster-list"
          onClick={() => setOpen((v) => !v)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition-colors hover:border-[var(--brand)] hover:text-[var(--brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2"
        >
          {open ? "收起 Hide" : "查看客户背景 View client background"} {open ? "▴" : "▾"}
        </button>
      </div>

      {open && (
        <div id="client-roster-list" data-testid="roster-list" className="mt-3 flex flex-col gap-3">
          {clients.map((client) => {
            const selected = client.caseId === selectedCaseId;
            return (
              <button
                key={client.caseId}
                type="button"
                data-testid="roster-client"
                data-case-id={client.caseId}
                data-selected={selected ? "true" : "false"}
                aria-pressed={selected}
                onClick={() => onSelect(client.caseId)}
                className={`${CARD_BUTTON} ${
                  selected
                    ? "border-[var(--brand)] bg-slate-50"
                    : "border-slate-200 hover:border-[var(--brand)]"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">{client.displayName}</p>
                    <p className="text-xs text-slate-500">{client.caseId}</p>
                  </div>
                  {selected && (
                    <span
                      data-testid="roster-selected-badge"
                      className="shrink-0 rounded-full border border-[var(--brand)] px-2 py-0.5 text-xs text-[var(--brand)]"
                    >
                      已选中 Selected
                    </span>
                  )}
                </div>

                {client.replacementContext && (
                  // Derived by detectReplacementContext() from the client's own
                  // words — not a tier the fixture declared.
                  <p
                    data-testid="roster-replacement-badge"
                    className="mt-2 w-fit rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs text-amber-900"
                  >
                    ⚠ 涉及替换现有合同 · Involves replacing an existing contract
                  </p>
                )}

                <p className="mt-2 text-xs text-slate-600">
                  目标 Goal: {GOAL_LABELS[client.primaryGoal] ?? client.primaryGoal}
                </p>

                <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
                  {client.stated.map((field) => (
                    <div key={field.key} data-testid="roster-field" data-field={field.key} className="flex flex-col">
                      <dt className="text-xs text-slate-500">
                        {field.labelZh} {field.labelEn}
                      </dt>
                      <dd
                        className="text-sm text-slate-800"
                        {...(field.verbatimEnglish ? { lang: "en" } : {})}
                      >
                        {/* "38 岁" already carries "38" — repeating the English
                            half would only restate the number. */}
                        {field.verbatimEnglish || field.valueZh.includes(field.valueEn)
                          ? field.valueZh
                          : `${field.valueZh} ${field.valueEn}`}
                      </dd>
                    </div>
                  ))}
                  <div className="flex flex-col">
                    <dt className="text-xs text-slate-500">语言 Language</dt>
                    <dd className="text-sm text-slate-800">
                      {client.language === "zh" ? "中文 Chinese" : "英文 English"}
                    </dd>
                  </div>
                </dl>

                {client.clientQuestions.length > 0 && (
                  <div data-testid="roster-questions" className="mt-2">
                    <p className="text-xs text-slate-500">客户原话 In the client&apos;s words</p>
                    <ul className="mt-1 flex flex-col gap-1">
                      {client.clientQuestions.map((question) => (
                        <li
                          key={question}
                          lang={client.language === "zh" ? "zh" : "en"}
                          className="border-l-2 border-slate-300 pl-2 text-sm italic text-slate-700"
                        >
                          {question}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {client.notStated.length > 0 && (
                  // Not a defect in the fixture — the point. These are exactly the
                  // fields that later show up under "information still needed".
                  <p data-testid="roster-not-stated" className="mt-2 text-xs text-slate-500">
                    本案例未提供 Not stated in this case:{" "}
                    {client.notStated.map((gap) => `${gap.labelZh} ${gap.labelEn}`).join(" · ")}
                  </p>
                )}
              </button>
            );
          })}

          <p data-testid="roster-footnote" className="text-xs leading-relaxed text-slate-500">
            这三位是本演示全部的虚构客户，资料仅取自案例文件中明确写下的内容;点一张卡片即可用他的背景生成比较草稿。
            <br />
            These are all of this demo&apos;s fictional clients. Every field comes from what the case file
            actually states. Select a card to build the comparison with that client&apos;s context.
          </p>
        </div>
      )}
    </section>
  );
}
