import { defineConfig } from "vitest/config";

// Live smoke tests (real API calls, env-gated). Excluded from `npm test`.
export default defineConfig({
  test: {
    include: ["tests/**/*.smoke.test.ts"],
    environment: "node",
    testTimeout: 120000,
  },
});
