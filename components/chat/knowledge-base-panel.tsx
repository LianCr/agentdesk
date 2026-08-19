"use client";

import { useState } from "react";

// What the assistant is actually searching.
//
// Someone opening this page sees a text box, and has no reason to believe it is
// not a generic chatbot with a system prompt. The three PDFs behind it are the
// entire basis of every cited answer, so they should be one click away — and
// the PDF opens from the same static path the citation cards use, which is the
// point: the knowledge base and the citations are the same documents.
//
// Read-only by construction: there is no upload, no edit, no chunk text and no
// vector anywhere in this component.

export interface KnowledgeDocumentView {
  documentId: string;
  productName: string;
  documentName: string;
  productCategory: string;
  carrier: string;
  jurisdiction: string;
  effectiveDate: string;
  pages: number;
  chunks: number;
  sections: string[];
  pdfUrl: string;
}

export interface KnowledgeSummaryView {
  documents: KnowledgeDocumentView[];
  totals: { documents: number; pages: number; chunks: number };
}

const CATEGORY_LABELS: Record<string, string> = {
  term_life: "定期寿险 Term life",
  indexed_universal_life: "指数型万能寿险 Indexed universal life",
  fixed_annuity: "固定年金 Fixed annuity",
};

export function KnowledgeBasePanel({ summary }: { summary: KnowledgeSummaryView }) {
  const [open, setOpen] = useState(false);
  const { documents, totals } = summary;

  return (
    <section
      data-testid="knowledge-base"
      className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-700">
          <span className="font-medium text-slate-900">知识库 Knowledge base</span>{" "}
          <span className="text-slate-400">·</span>{" "}
          <span data-testid="kb-totals">
            <span className="whitespace-nowrap">{totals.documents} 份文档 documents</span> ·{" "}
            <span className="whitespace-nowrap">{totals.pages} 页 pages</span> ·{" "}
            <span className="whitespace-nowrap">{totals.chunks} 个片段 chunks</span>
          </span>
        </p>
        <button
          type="button"
          data-testid="kb-toggle"
          aria-expanded={open}
          aria-controls="knowledge-base-list"
          onClick={() => setOpen((v) => !v)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition-colors hover:border-[var(--brand)] hover:text-[var(--brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2"
        >
          {open ? "收起 Hide" : "查看知识库 View knowledge base"} {open ? "▴" : "▾"}
        </button>
      </div>

      {open && (
        <div id="knowledge-base-list" data-testid="kb-list" className="mt-3 flex flex-col gap-3">
          {documents.map((doc) => (
            <article
              key={doc.documentId}
              data-testid="kb-document"
              data-document-id={doc.documentId}
              className="rounded border border-slate-200 p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{doc.productName}</p>
                  <p className="text-xs text-slate-500">{doc.documentName}</p>
                </div>
                <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-900">
                  已入库 Indexed
                </span>
              </div>

              <p className="mt-2 text-xs text-slate-600">
                <span className="whitespace-nowrap">{CATEGORY_LABELS[doc.productCategory] ?? doc.productCategory}</span>{" · "}
                <span className="whitespace-nowrap">{doc.carrier}</span>{" · "}
                <span className="whitespace-nowrap">{doc.jurisdiction}</span>{" · "}
                <span className="whitespace-nowrap tabular-nums">{doc.effectiveDate}</span>
              </p>

              <p data-testid="kb-counts" className="mt-1 text-sm text-slate-800">
                <span className="whitespace-nowrap">{doc.pages} 页 pages</span> ·{" "}
                <span className="whitespace-nowrap">{doc.chunks} 个片段 chunks</span>
              </p>

              {doc.sections.length > 0 && (
                <p className="mt-1 text-xs text-slate-500">
                  章节 Sections: {doc.sections.join(" · ")}…
                </p>
              )}

              <a
                data-testid="kb-open-pdf"
                href={doc.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex w-fit items-center rounded border border-slate-300 px-3 py-1.5 text-sm font-medium text-[var(--brand)] transition-colors hover:border-[var(--brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2"
              >
                打开 PDF Open PDF ↗
              </a>
            </article>
          ))}

          <p data-testid="kb-footnote" className="text-xs leading-relaxed text-slate-500">
            这三份文档就是本演示回答问题时检索的全部资料;回答里的每条引用都指向其中一页。
            <br />
            These three documents are everything this demo searches. Every citation in an answer
            points to a page inside them.
          </p>
        </div>
      )}
    </section>
  );
}
