import { createHash } from "node:crypto";
import type { EmbeddingProvider } from "./provider.js";

// Deterministic offline embedding provider for tests: same input -> same
// 1536-dimensional finite vector; different inputs differ (seeded from the
// input's sha256). Vectors are NOT semantically meaningful. This provider
// must only ever be selected explicitly and never writes the three real
// demo documents (enforced in the ingestion CLI and test helpers).

export const FAKE_PROVIDER_NAME = "fake-deterministic";
export const FAKE_DIMENSIONS = 1536;

function seededVector(input: string): number[] {
  const seed = createHash("sha256").update(input).digest();
  // xorshift128 seeded from the first 16 hash bytes.
  let x = seed.readUInt32LE(0) || 1;
  let y = seed.readUInt32LE(4) || 2;
  let z = seed.readUInt32LE(8) || 3;
  let w = seed.readUInt32LE(12) || 4;
  const next = (): number => {
    const t = x ^ ((x << 11) >>> 0);
    x = y; y = z; z = w;
    w = (w ^ (w >>> 19) ^ (t ^ (t >>> 8))) >>> 0;
    return w / 0xffffffff;
  };
  const values = Array.from({ length: FAKE_DIMENSIONS }, () => next() * 2 - 1);
  const norm = Math.sqrt(values.reduce((s, v) => s + v * v, 0)) || 1;
  return values.map((v) => v / norm);
}

export function createFakeProvider(): EmbeddingProvider {
  return {
    providerName: FAKE_PROVIDER_NAME,
    modelName: "fake",
    dimensions: FAKE_DIMENSIONS,
    embedMany: async (inputs: string[]) => inputs.map(seededVector),
  };
}
