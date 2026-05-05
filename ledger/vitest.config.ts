import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/core/**/*.ts", "src/infra/**/*.ts"],
      exclude: ["src/infra/dev/**", "src/presentation/**", "src/tests/**"],
      thresholds: {
        lines: 85,
        branches: 80,
        functions: 85,
      },
      reporter: ["text", "lcov", "html"],
    },
  },
});
