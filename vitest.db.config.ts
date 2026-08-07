import { defineConfig } from "vitest/config";

// Database integration tests (npm run test:db). Requires SUPABASE_URL and
// the secret key in .env; excluded from the default offline `npm test` run.
export default defineConfig({
  test: {
    include: ["tests/database/**/*.test.ts"],
    environment: "node",
    testTimeout: 60000,
    // Schema tests share test_ document ids; run serially.
    fileParallelism: false,
  },
});
