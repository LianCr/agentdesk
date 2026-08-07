// Deterministic query language detection — no library, no model.
//   zh:    at least two Han characters, no Latin content words
//   mixed: Han characters plus Latin terms ("IUL 的 cap 是多少？") — these
//          take the dual-route path exactly like zh
//   en:    mostly ASCII letters
//   other: everything else (retrieved via the original query only)

export type DetectedLanguage = "zh" | "en" | "mixed" | "other";

export function detectLanguage(query: string): DetectedLanguage {
  const han = query.match(/\p{Script=Han}/gu)?.length ?? 0;
  const latinWords = query.match(/[a-zA-Z]{2,}/g)?.length ?? 0;
  if (han >= 2 && latinWords >= 1) return "mixed";
  if (han >= 2) return "zh";
  const letters = query.match(/[a-zA-Z]/g)?.length ?? 0;
  const meaningful = query.replace(/[\s\d\p{P}]/gu, "").length;
  if (meaningful > 0 && letters / meaningful >= 0.5) return "en";
  return "other";
}

// Languages that use the dual-route (original + English) retrieval path.
export function usesDualRoute(language: DetectedLanguage): boolean {
  return language === "zh" || language === "mixed";
}
