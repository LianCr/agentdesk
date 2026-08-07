import { defineConfig } from "vitest/config";

// Browser UI tests (npm run test:ui): vitest drives the playwright library
// against a locally spawned `next dev` server; the answer API is mocked via
// route interception for deterministic runs.
export default defineConfig({
  test: {
    include: ["tests/ui/**/*.test.ts"],
    environment: "node",
    testTimeout: 120000,
    hookTimeout: 180000,
    fileParallelism: false,
  },
});
