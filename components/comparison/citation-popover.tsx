"use client";

import { useState } from "react";
import type { UiCitation } from "./types";

// Compact per-cell source affordance. Chunk ids, similarity scores and
// source-map diagnostics are never exposed — a reader gets product, page,
// section, the exact English quote, and a link into the PDF at that page.

export function CitationPopover({
  citations,
  urls,
}: {
  citations: UiCitation[];
  urls: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  if (citations.length === 0) return null;

  const pages = [...new Set(citations.map((c) => c.pageStart))].sort((a, b) => a - b);
  const summary =
    pages.length === 1
      ? `出处 Source · p. ${pages[0]}`
      : `出处 Sources · p. ${pages.join(", ")}`;

  return (
    <div className="mt-2">
      <button
        type="button"
        data-testid="citation-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 hover:border-[var(--brand)] hover:text-[var(--brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-1"
      >
        {summary} {open ? "▲" : "▼"}
      </button>
      {open && (
        <ul data-testid="citation-details" className="mt-2 flex flex-col gap-2">
          {citations.map((citation) => (
            <li
              key={citation.citationId}
              data-testid="citation-detail"
              className="rounded border border-slate-200 bg-slate-50 p-2.5 text-xs"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <span className="font-medium text-slate-700">{citation.documentName}</span>
                <span data-testid="citation-page" className="text-slate-500">
                  第 {citation.pageStart} 页 · Page {citation.pageStart}
                </span>
              </div>
              <p className="text-slate-500">{citation.section}</p>
              <blockquote
                data-testid="citation-quote"
                lang="en"
                className="mt-1.5 break-words border-l-2 border-slate-300 pl-2 italic text-slate-700"
              >
                {citation.quote}
              </blockquote>
              {urls[citation.citationId] && (
                <a
                  data-testid="citation-link"
                  href={urls[citation.citationId]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1.5 inline-flex w-fit items-center font-medium text-[var(--brand)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-1"
                >
                  打开原文第 {citation.pageStart} 页 Open source page ↗
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
