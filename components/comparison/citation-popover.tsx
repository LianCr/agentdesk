"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { UiCitation } from "./types";

// Per-cell source affordance. Chunk ids, similarity scores and source-map
// diagnostics are never exposed — a reader gets product, page, section, the
// exact English quote, and a link into the PDF at that page.
//
// The trigger is deliberately quiet: a comparison table renders one of these
// under nearly every cell (22+ per draft), and the earlier bordered-button
// version carried as much visual weight as the facts it cited. The panel is a
// real popover now, position:fixed rather than an inline disclosure — the table
// scrolls inside overflow-x-auto, which clips absolutely-positioned
// descendants, while a fixed panel escapes the clip and never widens the page.

const PANEL_MAX_WIDTH = 384; // 24rem, clamped to the viewport below

export function CitationPopover({
  citations,
  urls,
}: {
  citations: UiCitation[];
  urls: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLUListElement | null>(null);
  const panelId = useId();

  const close = useCallback(() => setOpen(false), []);

  const computePosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const width = Math.min(PANEL_MAX_WIDTH, window.innerWidth - 16);
    return {
      top: rect.bottom + 6,
      // Clamp into the viewport so the panel never pushes the page sideways.
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
    };
  }, []);

  const toggle = useCallback(() => {
    if (open) {
      close();
      return;
    }
    const next = computePosition();
    if (!next) return;
    setPosition(next);
    setOpen(true);
  }, [close, computePosition, open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    // Reposition on scroll rather than closing: the panel stays glued to its
    // trigger. Closing was also a trap — a click that scrolls the trigger into
    // view delivers its scroll EVENT on the next frame, after the panel opens,
    // and a close-on-scroll listener eats the panel it just opened.
    let frame = 0;
    const onMove = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = computePosition();
        if (next) setPosition(next);
      });
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onMove, { capture: true, passive: true });
    window.addEventListener("resize", onMove);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onMove, { capture: true });
      window.removeEventListener("resize", onMove);
    };
  }, [close, computePosition, open]);

  if (citations.length === 0) return null;

  const pages = [...new Set(citations.map((c) => c.pageStart))].sort((a, b) => a - b);
  const summary = `出处 · p. ${pages.join(", ")}`;

  return (
    <div className="mt-1.5">
      <button
        type="button"
        ref={triggerRef}
        data-testid="citation-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="查看出处 · View sources"
        onClick={toggle}
        className="inline-block whitespace-nowrap py-0.5 text-[11px] text-slate-500 underline decoration-dotted decoration-slate-300 underline-offset-2 hover:text-[var(--brand)] hover:decoration-[var(--brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-1"
      >
        {summary}
      </button>
      {open && position && (
        <ul
          id={panelId}
          ref={panelRef}
          data-testid="citation-details"
          role="dialog"
          aria-label="出处 · Sources"
          style={{
            position: "fixed",
            top: position.top,
            left: position.left,
            width: `min(${PANEL_MAX_WIDTH}px, calc(100vw - 1rem))`,
          }}
          className="z-30 flex max-h-[60vh] flex-col gap-2 overflow-y-auto rounded-lg border border-slate-300 bg-white p-2.5 shadow-lg"
        >
          {citations.map((citation) => (
            <li
              key={citation.citationId}
              data-testid="citation-detail"
              className="rounded border border-slate-200 bg-slate-50 p-2.5 text-xs"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <span className="font-medium text-slate-700">{citation.documentName}</span>
                <span data-testid="citation-page" className="text-slate-500">
                  <span className="whitespace-nowrap">第 {citation.pageStart} 页 · Page {citation.pageStart}</span>
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
                  className="mt-1.5 inline-flex w-fit items-center py-1 font-medium text-[var(--brand)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-1"
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
