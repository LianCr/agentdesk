import { describe, expect, it } from "vitest";
import { createFakeProvider, FAKE_PROVIDER_NAME } from "../../lib/embeddings/fake";
import { createOpenAiProvider } from "../../lib/embeddings/openai";
import { validateEmbeddings, type EmbeddingProvider } from "../../lib/embeddings/provider";

describe("fake provider", () => {
  const fake = createFakeProvider();

  it("is deterministic for identical input", async () => {
    const [a] = await fake.embedMany(["surrender charge schedule"]);
    const [b] = await fake.embedMany(["surrender charge schedule"]);
    expect(a).toEqual(b);
  });

  it("returns 1536 finite values", async () => {
    const [v] = await fake.embedMany(["cash value"]);
    expect(v).toHaveLength(1536);
    for (const x of v!) expect(Number.isFinite(x)).toBe(true);
  });

  it("normally differs for different input", async () => {
    const [a, b] = await fake.embedMany(["term life", "fixed annuity"]);
    expect(a).not.toEqual(b);
  });

  it("preserves input order positionally", async () => {
    const inputs = ["alpha", "beta", "gamma", "alpha"];
    const vectors = await fake.embedMany(inputs);
    expect(vectors).toHaveLength(4);
    expect(vectors[0]).toEqual(vectors[3]); // same content, same position-independent value
    expect(vectors[0]).not.toEqual(vectors[1]);
    const again = await fake.embedMany(["beta"]);
    expect(again[0]).toEqual(vectors[1]); // order mapping is positional, not lookup-based
  });

  it("declares fake provider/model metadata", () => {
    expect(fake.providerName).toBe(FAKE_PROVIDER_NAME);
    expect(fake.modelName).toBe("fake");
    expect(fake.dimensions).toBe(1536);
  });
});

describe("openai provider construction", () => {
  it("fails fast without an API key and never calls the network", () => {
    expect(() => createOpenAiProvider(undefined)).toThrow(/OPENAI_API_KEY is not set/);
    expect(() => createOpenAiProvider("")).toThrow(/OPENAI_API_KEY is not set/);
  });

  it("declares provider/model/dimensions metadata", () => {
    const p = createOpenAiProvider("sk-test-not-a-real-key");
    expect(p.providerName).toBe("openai");
    expect(p.modelName).toBe("text-embedding-3-large");
    expect(p.dimensions).toBe(1536);
  });
});

describe("validateEmbeddings", () => {
  const provider: Pick<EmbeddingProvider, "providerName" | "modelName" | "dimensions"> = {
    providerName: "test",
    modelName: "test",
    dimensions: 1536,
  };
  const good = Array.from({ length: 1536 }, () => 0.1);

  it("accepts a valid batch", () => {
    expect(() => validateEmbeddings(provider as EmbeddingProvider, 2, [good, good])).not.toThrow();
  });

  it("rejects count mismatch", () => {
    expect(() => validateEmbeddings(provider as EmbeddingProvider, 3, [good, good])).toThrow(
      /EMBEDDING_COUNT_MISMATCH/,
    );
  });

  it("rejects wrong dimensions and empty vectors", () => {
    expect(() => validateEmbeddings(provider as EmbeddingProvider, 1, [good.slice(0, 8)])).toThrow(
      /EMBEDDING_DIMENSION_MISMATCH/,
    );
    expect(() => validateEmbeddings(provider as EmbeddingProvider, 1, [[]])).toThrow(
      /EMBEDDING_DIMENSION_MISMATCH/,
    );
  });

  it("rejects NaN and Infinity", () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const v = [...good];
      v[7] = bad;
      expect(() => validateEmbeddings(provider as EmbeddingProvider, 1, [v])).toThrow(
        /EMBEDDING_INVALID_VALUE/,
      );
    }
  });
});
