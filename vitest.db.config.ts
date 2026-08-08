import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Database integration tests (npm run test:db). Requires SUPABASE_URL and
// the secret key in .env; excluded from the default offline `npm test` run.
export default defineConfig({
  // See tests/server-only-stub.ts: the real package is still enforced by the
  // Next build, this only lets vitest import server modules.
  resolve: {
    alias: {
      "server-only": fileURLToPath(new URL("./tests/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    include: ["tests/database/**/*.test.ts"],
    environment: "node",
    testTimeout: 60000,
    // Schema tests share test_ document ids; run serially.
    fileParallelism: false,
  },
});
