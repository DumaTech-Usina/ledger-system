/**
 * What the CFO read on an institution's statement (§8.8, REQ-675): a balance at the end of a day.
 *
 * A Treasury control, never a fact of the Ledger (REJ-675). It is kept so the book can be compared with
 * the bank on that day, with who informed it and when; a newer one does not erase an older one.
 */
export interface BankStatement {
  id: string;
  /** The institution's key (REQ-676). */
  institution: string;
  /** The day the statement ended with this balance, `YYYY-MM-DD`. */
  day: string;
  /** Signed, in the Ledger's form: "-1200.00" for an overdrawn account. */
  amount: string;
  informedBy: string;
  informedAt: string;
}

export interface BankStatementStore {
  add(statement: BankStatement): Promise<void>;
  /** The latest statement of each institution: the latest day, and the last informed for that day. */
  latest(): Promise<BankStatement[]>;
  /** One institution's statements, the latest first. */
  of(institution: string, limit: number): Promise<BankStatement[]>;
}

const newer = (a: BankStatement, b: BankStatement) => b.day.localeCompare(a.day) || b.informedAt.localeCompare(a.informedAt);

export class InMemoryBankStatementStore implements BankStatementStore {
  private readonly rows: BankStatement[] = [];

  async add(statement: BankStatement): Promise<void> {
    this.rows.push({ ...statement });
  }

  async latest(): Promise<BankStatement[]> {
    const best = new Map<string, BankStatement>();
    for (const row of [...this.rows].sort(newer)) if (!best.has(row.institution)) best.set(row.institution, row);
    return [...best.values()].map((r) => ({ ...r }));
  }

  async of(institution: string, limit: number): Promise<BankStatement[]> {
    return this.rows.filter((r) => r.institution === institution).sort(newer).slice(0, limit).map((r) => ({ ...r }));
  }
}
