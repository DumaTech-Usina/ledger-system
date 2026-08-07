import { readFileSync } from "fs";
import { join } from "path";
import {
  LedgerAlgebra,
  type LedgerAlgebraSnapshot,
} from "../../core/application/services/LedgerAlgebra";

/**
 * The REAL algebra the Ledger exports, shared by every test that needs one.
 *
 * A hand-written fixture would let the suite agree with a world that no longer exists — the exact
 * failure the export was built to end. The Ledger's own suite keeps this file fresh.
 */
let cached: LedgerAlgebra | null = null;

export function algebra(): LedgerAlgebra {
  if (!cached) {
    const raw = readFileSync(join(__dirname, "../../../../ledger/algebra.json"), "utf8");
    cached = new LedgerAlgebra(JSON.parse(raw) as LedgerAlgebraSnapshot);
  }
  return cached;
}
