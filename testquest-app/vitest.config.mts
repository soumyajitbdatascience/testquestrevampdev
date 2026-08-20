import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Unit-test config for the admin module.
 *
 * These tests never touch a database. Prisma is deep-mocked in
 * `src/test/prisma-mock.ts`, so the suite is deterministic and runs offline —
 * the shared Hostinger instance is never a dependency of `npm run test`.
 *
 * `.mts` rather than `.ts`: the project is CommonJS, and Vitest 4's config
 * entry is ESM-only, so a plain `.ts` config fails to load with ERR_REQUIRE_ESM.
 */
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/__tests__/**/*.test.ts"],
    setupFiles: ["src/test/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts", "src/app/api/admin/**/*.ts"],
      exclude: ["src/test/**", "src/generated/**"],
    },
  },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
});
