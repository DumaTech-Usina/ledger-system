import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { describe, it, expect } from "vitest";

/**
 * The import barrier — the one guarantee that a cache cannot quietly become a second source of
 * truth.
 *
 * The brand on `SnapshotPosition` already stops the two types being confused. This stops something
 * subtler: a well-meant change that reads a remembered figure inside a path that DECIDES. A snapshot
 * may make navigation faster; it may never take part in building a candidate, previewing one, or
 * submitting one, because those are where treasury asserts a fact to the Ledger.
 *
 * Executable rather than documented, because a rule kept by discipline is one that will be broken
 * exactly once and never noticed.
 */

const SRC = join(__dirname, "../../..");

/** The write path: everything between "what did the user mean" and "tell the Ledger". */
const FORBIDDEN = [
  "core/application/services/CandidateMapper.ts",
  "core/application/use-cases/SubmitIntent.ts",
  "core/application/use-cases/PreviewIntent.ts",
  "core/application/use-cases/SubmitRectification.ts",
  "core/application/use-cases/StartPositionAction.ts",
  "core/application/use-cases/ApplyAnswers.ts",
  "core/application/use-cases/AdvanceDialog.ts",
];

const SNAPSHOT_MODULES = ["PositionSnapshot", "SnapshotRefresher"];

const mentionsSnapshot = (source: string): string | null => {
  for (const module of SNAPSHOT_MODULES) {
    // Only an import counts. The word may legitimately appear in prose explaining why it is absent.
    const importing = new RegExp(`^\\s*import[^;]*${module}[^;]*;`, "m");
    if (importing.test(source)) return module;
  }
  return null;
};

describe("snapshot isolation", () => {
  it.each(FORBIDDEN)("%s does not import the snapshot", (relativePath) => {
    const source = readFileSync(join(SRC, relativePath), "utf8");
    expect(mentionsSnapshot(source)).toBeNull();
  });

  it("no file under core/domain imports it either — the domain has no cache", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (entry.endsWith(".ts") && mentionsSnapshot(readFileSync(full, "utf8"))) {
          offenders.push(full.replace(SRC, ""));
        }
      }
    };
    walk(join(SRC, "core/domain"));
    expect(offenders).toEqual([]);
  });

  it("the forbidden list still names files that exist", () => {
    // A path that stopped existing would make this suite pass by testing nothing.
    for (const relativePath of FORBIDDEN) {
      expect(() => statSync(join(SRC, relativePath))).not.toThrow();
    }
  });
});
