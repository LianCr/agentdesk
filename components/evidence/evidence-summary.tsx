import type { GroundedAnswer } from "../chat/types";
import { EvidenceBadge } from "./evidence-badge";
import { RailCell, StatusRail } from "../shell/status-rail";

// The answer's status rail. Four facts the code computed, in terminal
// language; no model-reported confidence, no percentages dressed as scores.

export function EvidenceSummary({ result }: { result: GroundedAnswer }) {
  const uniqueDocuments = new Set(result.citations.map((c) => c.documentId)).size;
  const factualClaims = result.claims.filter((c) => c.factual);
  const citedFactualClaims = factualClaims.filter((c) => c.citationIds.length > 0);
  const coverage = `${Math.round(result.meta.citationCoverage * 100)}%`;

  return (
    <StatusRail data-testid="evidence-summary" aria-label="核对情况 Verification summary">
      <RailCell caption="证据 Evidence" testId="evidence-cell">
        <EvidenceBadge status={result.evidenceStatus} />
      </RailCell>
      <RailCell caption="引用来源 Sources" testId="metric-sources">
        <span className="font-mono tabular-nums">{uniqueDocuments}</span>
      </RailCell>
      <RailCell caption="已核对事实 Facts cited" testId="metric-claims">
        <span className="font-mono tabular-nums">
          {citedFactualClaims.length} / {factualClaims.length}
        </span>
      </RailCell>
      <RailCell caption="有出处比例 Coverage" testId="metric-coverage">
        <span className="font-mono tabular-nums">{coverage}</span>
      </RailCell>
      <RailCell
        caption="人工审核 Review"
        testId="metric-review"
        tone={result.reviewRequired ? "attention" : "neutral"}
      >
        {result.reviewRequired ? "需要 Yes" : "无需 No"}
      </RailCell>
    </StatusRail>
  );
}
