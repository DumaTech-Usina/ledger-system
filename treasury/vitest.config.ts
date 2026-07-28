import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/tests/**/*.test.ts"],
    // LlmSlotExtractionAdapter/ChatModel don't exist yet — this spec was written ahead of the
    // implementation. Re-enable once that adapter lands (see EXTRACTION_MODE in config/env.ts).
    exclude: ["src/tests/unit/infra/llm-slot-extraction.test.ts"],
  },
});
