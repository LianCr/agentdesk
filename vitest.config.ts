import { defineConfig } from "vitest/config";

export default defineConfig({
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
