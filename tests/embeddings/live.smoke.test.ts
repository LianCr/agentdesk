import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createOpenAiProvider } from "../../lib/embeddings/openai.js";

// Optional live smoke test: ONE real embedding call. Requires
// OPENAI_API_KEY; skipped otherwise. Run via `npm run test:embeddings:live`.
// Vector values and secrets are never printed.

if (existsSync(".env")) process.loadEnvFile(".env");
const key = process.env.OPENAI_API_KEY;

describe.skipIf(!key)("openai live smoke", () => {
  it("returns exactly 1536 finite values for one input", async () => {
    const provider = createOpenAiProvider(key);
    const vectors = await provider.embedMany(["fixed annuity surrender charge schedule"]);
    expect(vectors).toHaveLength(1);
    expect(vectors[0]).toHaveLength(1536);
    expect(vectors[0]!.every((v) => Number.isFinite(v))).toBe(true);
  });
});
