import { defineConfig } from "vitest/config";
import path from "node:path";

// Deliberately no React plugin / global jsdom: a component test opts in with
// `// @vitest-environment jsdom`. Most tests cover pure logic (e.g.
// conversationEngine.ts), which needs no DOM. Add a jsdom environment + Testing Library when the
// first component test shows up.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
