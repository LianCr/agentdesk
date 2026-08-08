import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  // See tests/server-only-stub.ts: the real package is still enforced by the
  // Next build, this only lets vitest import server modules.
  resolve: {
    alias: {
      "server-only": fileURLToPath(new URL("./tests/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    // Database tests are opt-in via `npm run test:db`; the default run stays
    // fully offline.
    exclude: [
      "tests/database/**",
      "tests/ui/**", // needs a dev server + browser; run via npm run test:ui
      "**/node_modules/**",
      "**/*.smoke.test.ts",
      "**/*.live.test.ts",
    ],
    environment: "node",
    testTimeout: 30000,
  },
});
