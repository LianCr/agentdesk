import { defineConfig } from "vitest/config";

// Live retrieval tests (real Supabase + embedding + rewrite API calls).
// Requires .env; excluded from the default offline `npm test`.
export default defineConfig({
  test: {
    include: ["tests/**/*.live.test.ts"],
    environment: "node",
    testTimeout: 120000,
    fileParallelism: false,
  },
});
