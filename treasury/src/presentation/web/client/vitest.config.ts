import { defineConfig } from "vitest/config";
import path from "node:path";

// Deliberately no React plugin / jsdom here — today's tests only cover pure logic (e.g.
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
    include: ["src/**/*.test.ts"],
  },
});
