// Embedding provider contract. Providers return one vector per input, in
// exact input order — assignment is positional, never by content matching.
// validateEmbeddings runs before any database write.

export interface EmbeddingProvider {
  providerName: string;
  modelName: string;
  dimensions: number;
  embedMany(inputs: string[]): Promise<number[][]>;
}

export function validateEmbeddings(
  provider: EmbeddingProvider,
  inputCount: number,
  vectors: number[][],
): void {
  if (vectors.length !== inputCount) {
    throw new Error(
      `EMBEDDING_COUNT_MISMATCH: got ${vectors.length} vectors for ${inputCount} inputs ` +
        `(${provider.providerName}/${provider.modelName})`,
    );
  }
  vectors.forEach((vector, i) => {
    if (vector.length !== provider.dimensions) {
      throw new Error(
        `EMBEDDING_DIMENSION_MISMATCH: vector ${i} has ${vector.length} values, ` +
          `expected ${provider.dimensions}`,
      );
    }
    for (const value of vector) {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new Error(`EMBEDDING_INVALID_VALUE: vector ${i} contains a non-finite value`);
      }
    }
  });
}
