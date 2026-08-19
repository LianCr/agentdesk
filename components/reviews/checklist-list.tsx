"use client";

import { useState } from "react";
import { CitationPopover } from "../comparison/citation-popover";
import { REQUIRED_FOR } from "../comparison/missing-info-list";
import type { UiCitation, UiMissingInfo, UiRow } from "../comparison/types";
import {
  CHECKLIST_PROVENANCE_NOTE,
  FIXTURE_CHECKLIST_DETAIL,
  NO_DETAIL_COPY,
} from "./checklist-detail-copy";
import type { UiChecklistItem } from "./types";

// Decision support, not a form.
//
// Items can now be expanded and ticked, but nothing is recorded: the tick lives
// in React state, never reaches the server, and is gone on reload. M5's original
// objection was to a checkbox that LOOKS like a record without being one, so the
// copy says outright that it is not — and the completion state deliberately does
// not touch the approve/reject controls, which stay owned by the server.
//
// Per-item detail is derived client-side from `key`, because the stored item is
// four frozen fields (ReviewChecklistItemSchema is .strict(), and the DB trigger
// review_items_freeze_artifact() rejects any change to `checklist`).

const SOURCE_NOTE: Record<UiChecklistItem["sourceKind"], { zh: string; en: string }> = {
  fixture_checklist: {
    zh: "本演示替换情形要求",
    en: "Required by this demo's replacement scenario",
  },
  missing_client_info: {
    zh: "客户资料缺失",
    en: "Missing client information",
  },
  review_flag: {
    zh: "审核标记引出",
    en: "Raised by a review flag",
  },
};

function dimensionRow(dimensions: UiRow[], dimensionId: string): UiRow | undefined {
  return dimensions.find((row) => row.dimensionId === dimensionId);
}

/**
 * Citations for one dimension, de-duplicated by citationId.
 *
 * Only `available` cells contribute. A `conflict` cell still carries citations,
 * but M4's fail-closed rule means the table deliberately shows no value for it —
 * re-surfacing that quote in a second place would undo exactly what the rule is
 * there to prevent.
 */
function citationsFor(row: UiRow | undefined): UiCitation[] {
  if (!row) return [];
  const seen = new Set<string>();
  const out: UiCitation[] = [];
  for (const cell of row.cells) {
    if (cell.availability !== "available") continue;
    for (const citation of cell.citations) {
      if (seen.has(citation.citationId)) continue;
      seen.add(citation.citationId);
      out.push(citation);
    }
  }
  return out;
}

function scrollToDimension(dimensionId: string) {
  const target = document.querySelector(`[data-dimension="${dimensionId}"]`);
  target?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function DetailLines({ zh, en }: { zh: string; en: string }) {
  return (
    <>
      <p className="text-xs leading-relaxed text-slate-700">{zh}</p>
      <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{en}</p>
    </>
  );
}

function ItemDetail({
  item,
  missingInformation,
  dimensions,
  citationUrls,
}: {
  item: UiChecklistItem;
  missingInformation: UiMissingInfo[];
  dimensions: UiRow[];
  citationUrls: Record<string, string>;
}) {
  const fixture = FIXTURE_CHECKLIST_DETAIL[item.key];
  const missing = missingInformation.find((entry) => entry.field === item.key);

  if (fixture) {
    const row = fixture.relatedDimensionId ? dimensionRow(dimensions, fixture.relatedDimensionId) : undefined;
    // Compute the citations before deciding to render the heading: CitationPopover
    // renders nothing when the list is empty, which would leave a heading over a void.
    const citations = citationsFor(row);
    return (
      <div className="mt-2 flex flex-col gap-3 border-t border-slate-200 pt-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            为什么出现 · Why this item is here
          </p>
          <DetailLines zh={fixture.whyZh} en={fixture.whyEn} />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            需要核实 · What to verify
          </p>
          <DetailLines zh={fixture.verifyZh} en={fixture.verifyEn} />
        </div>
        {row && citations.length > 0 ? (
          <div data-testid="checklist-evidence">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              相关比较维度与出处 · Related comparison row and its sources
            </p>
            <button
              type="button"
              data-testid="checklist-jump"
              data-dimension-target={row.dimensionId}
              onClick={() => scrollToDimension(row.dimensionId)}
              className="mt-1 inline-flex items-center rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 hover:border-[var(--brand)] hover:text-[var(--brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-1"
            >
              <span data-register="zh" className="whitespace-nowrap">
                跳到「{row.labelZh}」↑
              </span>
            </button>
            <CitationPopover citations={citations} urls={citationUrls} />
          </div>
        ) : (
          <p data-testid="checklist-no-evidence" className="text-xs text-slate-500">
            本条需向现有承保方或客户取得，比较表不覆盖。
            <br />
            This item must be obtained from the existing carrier or the client; the comparison table does not cover it.
          </p>
        )}
      </div>
    );
  }

  if (missing) {
    // The gap's own reason, computed server-side and stored in the snapshot —
    // reused rather than rewritten, so the same gap reads the same way here and
    // in「仍需确认的信息」above.
    const affected = (missing.relevantTo ?? [])
      .map((dimensionId) => dimensionRow(dimensions, dimensionId))
      .filter((row): row is UiRow => row !== undefined);
    return (
      <div className="mt-2 flex flex-col gap-3 border-t border-slate-200 pt-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            为什么出现 · Why this item is here
          </p>
          <DetailLines zh={missing.reasonZh} en={missing.reasonEn} />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            需要核实 · What to verify
          </p>
          <DetailLines
            zh="向客户取得该项信息后，重新生成比较草稿。"
            en="Obtain this information from the client, then regenerate the comparison draft."
          />
          <p className="mt-1 text-xs text-slate-500">
            影响 Affects: {REQUIRED_FOR[missing.requiredFor] ?? missing.requiredFor}
          </p>
        </div>
        {affected.length > 0 && (
          // Deliberately no citations here: this information is MISSING. Rendering
          // sources next to it would read as though it were evidenced.
          <div data-testid="checklist-affected">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              缺失会影响的维度 · Dimensions affected by this gap
            </p>
            <div className="mt-1 flex flex-wrap gap-2">
              {affected.map((row) => (
                <button
                  key={row.dimensionId}
                  type="button"
                  data-testid="checklist-jump"
                  data-dimension-target={row.dimensionId}
                  onClick={() => scrollToDimension(row.dimensionId)}
                  className="inline-flex items-center rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 hover:border-[var(--brand)] hover:text-[var(--brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-1"
                >
                  <span data-register="zh" className="whitespace-nowrap">
                    {row.labelZh} ↑
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2 border-t border-slate-200 pt-2">
      <DetailLines zh={NO_DETAIL_COPY.zh} en={NO_DETAIL_COPY.en} />
    </div>
  );
}

export function ChecklistList({
  items,
  missingInformation,
  dimensions,
  citationUrls,
}: {
  items: UiChecklistItem[];
  missingInformation: UiMissingInfo[];
  dimensions: UiRow[];
  citationUrls: Record<string, string>;
}) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [verified, setVerified] = useState<ReadonlySet<string>>(new Set());

  const toggle = (set: ReadonlySet<string>, key: string): ReadonlySet<string> => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  };

  if (items.length === 0) {
    return (
      <section data-testid="review-checklist" className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-800">核对清单 · Review checklist</h2>
        {/* Not "no client is attached": a review WITH a client whose information is
            complete also produces an empty list, and the old wording said something
            untrue about it. */}
        <p data-testid="checklist-empty" className="mt-2 text-sm text-slate-600">
          本审核项没有需要逐条核对的内容。
          <br />
          No checklist items apply to this review.
        </p>
      </section>
    );
  }

  const done = items.filter((item) => verified.has(item.key)).length;
  const allDone = done === items.length;

  return (
    <section data-testid="review-checklist" className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-sm font-semibold text-slate-800">
          核对清单 · Review checklist <span className="font-normal text-slate-500">({items.length})</span>
        </h2>
        <p data-testid="checklist-progress" data-done={done} data-total={items.length} className="text-xs text-slate-600">
          <span className="whitespace-nowrap tabular-nums">已确认 {done}/{items.length}</span> ·{" "}
          <span className="whitespace-nowrap tabular-nums">{done} of {items.length} confirmed</span>
        </p>
      </div>
      <div
        role="progressbar"
        aria-label="核对进度 · Checklist progress"
        aria-valuemin={0}
        aria-valuemax={items.length}
        aria-valuenow={done}
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-200 ${allDone ? "bg-emerald-500" : "bg-[var(--brand)]"}`}
          style={{ width: `${(done / items.length) * 100}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        勾选仅用于本次查看，刷新后清空，不构成审核记录。
        Ticks are for this viewing session only; they are cleared on reload and are not a record.
      </p>

      {allDone && (
        <p
          data-testid="checklist-complete"
          role="status"
          className="mt-3 rounded border border-emerald-300 bg-emerald-50 p-3 text-xs leading-relaxed text-emerald-900"
        >
          ✅ 全部 {items.length} 项已确认 · All {items.length} items confirmed
          <br />
          仅表示本次查看已逐条过目，不表示适合性、承保方核准或合规批准。
          <br />
          Confirms only that each item was looked at in this viewing session. It is not a suitability,
          underwriting or compliance approval.
        </p>
      )}

      <ul className="mt-3 flex flex-col gap-2">
        {items.map((item, index) => {
          const isOpen = expanded.has(item.key);
          const isVerified = verified.has(item.key);
          const detailId = `checklist-detail-${index}`;
          return (
            <li
              key={item.key}
              data-testid="checklist-item"
              data-source-kind={item.sourceKind}
              data-item-key={item.key}
              data-verified={isVerified ? "true" : "false"}
              className={`rounded border px-3 py-2 ${
                isVerified ? "border-emerald-300 bg-emerald-50/50" : "border-slate-200"
              }`}
            >
              {/* The tick and the expand toggle are siblings, never nested: nested
                  interactive controls are inaccessible, and burying the tick inside
                  the panel would force an expand for every single item. */}
              <div className="flex items-start gap-2.5">
                {/* The box stays 20px so it does not dwarf the label, but the
                    padded <label> around it carries the tap target out to 32px.
                    A 20px box alone is under the 24px floor on a phone. */}
                <label className="-m-1.5 shrink-0 cursor-pointer p-1.5">
                  <input
                    type="checkbox"
                    data-testid="checklist-verify"
                    checked={isVerified}
                    onChange={() => setVerified((current) => toggle(current, item.key))}
                    aria-label={`标记为已核实 · Mark as verified: ${item.labelZh} ${item.labelEn}`}
                    className="block h-5 w-5 accent-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-1"
                  />
                </label>
                <button
                  type="button"
                  data-testid="checklist-toggle"
                  aria-expanded={isOpen}
                  aria-controls={detailId}
                  onClick={() => setExpanded((current) => toggle(current, item.key))}
                  className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-1"
                >
                  <p className={`text-sm ${isVerified ? "text-slate-500" : "text-slate-800"}`}>
                    <span aria-hidden="true" className="mr-1 inline-block text-slate-400">
                      {isOpen ? "▾" : "▸"}
                    </span>
                    {item.labelZh} · {item.labelEn}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {SOURCE_NOTE[item.sourceKind].zh} · {SOURCE_NOTE[item.sourceKind].en}
                  </p>
                </button>
              </div>
              {isOpen && (
                <div id={detailId} data-testid="checklist-detail">
                  <ItemDetail
                    item={item}
                    missingInformation={missingInformation}
                    dimensions={dimensions}
                    citationUrls={citationUrls}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        {CHECKLIST_PROVENANCE_NOTE.zh}
        <br />
        {CHECKLIST_PROVENANCE_NOTE.en}
      </p>
    </section>
  );
}
