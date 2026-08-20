"use client";

import { useState } from "react";
import { CitationPopover } from "./citation-popover";
import type { Availability, ComparisonDraftView, UiCell } from "./types";

// The table is the product. Both columns get identical width, identical
// typography and identical affordances: there is no preferred side, no winner
// badge, no rating, no colour that means "better". The only colour carries an
// availability state, and every state also carries text.

const AVAILABILITY: Record<Availability, { labelZh: string; labelEn: string; className: string }> = {
  available: { labelZh: "有据", labelEn: "Documented", className: "" },
  not_applicable: {
    labelZh: "不适用",
    labelEn: "Not applicable",
    className: "text-slate-500",
  },
  not_provided: {
    labelZh: "演示资料未提供",
    labelEn: "Not provided in demo materials",
    className: "text-slate-500",
  },
  conflict: {
    labelZh: "无法核验",
    labelEn: "Could not verify",
    className: "text-slate-600",
  },
};

function CellBody({ cell, urls }: { cell: UiCell; urls: Record<string, string> }) {
  const state = AVAILABILITY[cell.availability];

  if (cell.availability === "conflict") {
    // A conflicted value is never rendered as a product fact.
    return (
      <div data-testid="cell-conflict" className="text-sm text-slate-600">
        <span className="inline-block whitespace-nowrap rounded bg-slate-100 px-1.5 py-0.5 text-xs">
          {state.labelZh} · {state.labelEn}
        </span>
        <p className="mt-1.5 text-xs text-slate-500">
          该事实无法与原文核对，因此不作为产品事实显示。
          <br />
          This fact could not be reconciled with its source, so it is not shown as a product fact.
        </p>
      </div>
    );
  }

  if (cell.availability !== "available") {
    return (
      <p data-testid={`cell-${cell.availability}`} className={`text-sm ${state.className}`}>
        {state.labelZh} · {state.labelEn}
      </p>
    );
  }

  return (
    <div data-testid="cell-available">
      <p className="text-sm leading-relaxed text-slate-800">{cell.displayValue}</p>
      {cell.sourceKind === "derived" && (
        <p data-testid="derived-label" className="mt-1 text-xs text-slate-500">
          由表格推导 · Derived from the documented table
        </p>
      )}
      <CitationPopover citations={cell.citations} urls={urls} />
    </div>
  );
}

export function ComparisonTable({
  draft,
  defaultExpanded = false,
}: {
  draft: ComparisonDraftView;
  /** The review page passes true: a reviewer signs off on the full snapshot
   *  and gets no collapsed default. */
  defaultExpanded?: boolean;
}) {
  // Core-first by default. Which rows are "core" is not decided here and not
  // decided by a model: it is the M4-A fact registry's own flag, where a core
  // conflict blocks the whole draft. This component only reads it.
  const [expanded, setExpanded] = useState(defaultExpanded);
  const rows = expanded ? draft.dimensions : draft.dimensions.filter((row) => row.core);
  const hidden = draft.dimensions.length - rows.length;
  const hiddenLabels = draft.dimensions
    .filter((row) => !row.core)
    .map((row) => row.labelZh)
    .slice(0, 3)
    .join("、");
  return (
    <section id="facts" className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-slate-800">
        产品事实对比 <span className="font-normal text-slate-500">· Product facts</span>
      </h2>
      {/* min-w-0: this sits inside a flex column, where the default
          min-width:auto stops it shrinking below the table's intrinsic width.
          Without it the page widens instead of the table scrolling. */}
      <div className="min-w-0 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table data-testid="comparison-table" className="w-full min-w-[46rem] border-collapse text-left">
          <caption className="sr-only">
            产品事实对比表，每个事实附带原文出处 Product fact comparison with source citations
          </caption>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {/* Sticky: on a phone this table scrolls sideways by design -- two
                  products read left-to-right -- but scrolling the dimension out
                  of view leaves the numbers unlabelled. */}
              <th
                scope="col"
                className="sticky left-0 z-10 w-[11rem] bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600 sm:w-[16rem]"
              >
                <span data-register="zh" className="block whitespace-nowrap">
                  比较维度
                </span>
                <span data-register="en" className="mt-0.5 block text-[11px] font-normal text-slate-500">
                  Dimension
                </span>
              </th>
              <th
                scope="col"
                data-testid="column-a"
                className="w-1/2 whitespace-nowrap px-4 py-3 text-sm font-semibold text-[var(--brand)]"
              >
                {draft.productA.productName}
              </th>
              <th
                scope="col"
                data-testid="column-b"
                className="w-1/2 whitespace-nowrap px-4 py-3 text-sm font-semibold text-[var(--brand)]"
              >
                {draft.productB.productName}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.dimensionId}
                data-testid="comparison-row"
                data-dimension={row.dimensionId}
                className="border-b border-slate-100 align-top last:border-0"
              >
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-white px-4 py-4 text-sm font-medium text-slate-700"
                >
                  <span data-register="zh" className="block whitespace-nowrap">
                    {row.labelZh}
                  </span>
                  <span data-register="en" className="block text-xs font-normal text-slate-500">
                    {row.labelEn}
                  </span>
                </th>
                {row.cells.map((cell, index) => (
                  <td
                    key={`${row.dimensionId}-${cell.productId}-${index}`}
                    data-testid="comparison-cell"
                    data-product={cell.productId}
                    data-availability={cell.availability}
                    className="px-4 py-4"
                  >
                    <CellBody cell={cell} urls={draft.citationUrls} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!defaultExpanded && hidden > 0 && !expanded && (
          <button
            type="button"
            data-testid="table-expand"
            aria-expanded={false}
            onClick={() => setExpanded(true)}
            className="block w-full border-t border-slate-200 bg-slate-50/60 px-4 py-3 text-center text-sm text-slate-600 transition-colors hover:text-[var(--brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
          >
            查看其余 {hidden} 项（{hiddenLabels}等）· Show {hidden} more dimensions ▾
          </button>
        )}
        {!defaultExpanded && expanded && (
          <button
            type="button"
            data-testid="table-collapse"
            aria-expanded={true}
            onClick={() => setExpanded(false)}
            className="block w-full border-t border-slate-200 bg-slate-50/60 px-4 py-3 text-center text-sm text-slate-600 transition-colors hover:text-[var(--brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
          >
            收起非核心维度 · Show core dimensions only ▴
          </button>
        )}
      </div>
      {!expanded && (
        <p className="text-xs text-slate-500">
          默认显示 {rows.length} 项核心维度;全部 {draft.dimensions.length} 项事实与引用一键可查,一项不少。
          Showing {rows.length} core dimensions; all {draft.dimensions.length} documented facts are one
          click away.
        </p>
      )}
    </section>
  );
}
