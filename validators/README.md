# Validators

> The gatekeeper between the external world and the ledger ecosystem.

---

## What is this?

Before any financial event becomes a permanent ledger entry, it must pass through Validators. This service reads raw data from external sources, runs a set of business rules against it, and stamps each entity with a verdict — **CLEAN** or **SUSPICIOUS** — stored in MongoDB.

The ledger then reads those verdicts and only promotes CLEAN records into confirmed accounting entries. Suspicious records are held back for review.

```
External World                 Validators                    Ledger
──────────────     ──────────────────────────────────     ──────────────
PostgreSQL     →   validate → CLEAN / SUSPICIOUS      →   LedgerEvent
```

**Today** the only data source is PostgreSQL. **Tomorrow** it could be anything: a REST API, a message queue, a WhatsApp integration, a CSV file processor. The architecture is built for that — adding a new data source means writing a new infrastructure adapter, not touching any business logic.

---

## What it validates today

Three domains are currently live, each with its own producer/consumer worker pair:

| Domain        | What it checks                                                  | Canonical collection          |
| ------------- | --------------------------------------------------------------- | ----------------------------- |
| **Proposals** | Duplicates, double payments, false delinquents, invalid numbers | `aspirant_proposal_canonical` |
| **Receipts**  | Commission receipt integrity                                    | `aspirant_receipt_canonical`  |
| **Advances**  | 10 advance report rules (ADV-001 → ADV-010)                     | `aspirant_advance_canonical`  |

---

## How it works — the 4-stage pipeline

Every domain follows the same flow, no exceptions:

```
[1] INGEST     Read entities from the source (PostgreSQL today).
               No computation. Just loading.

[2] ENRICH     Fetch all auxiliary data the rules will need.
               Pre-compute expensive aggregates.
               This is the ONLY stage that talks to databases.

[3] VALIDATE   Pass the fully-loaded context to the rule engine.
               Rules execute. No I/O. No shared state. Pure functions.

[4] AGGREGATE  Write canonical verdicts to MongoDB.
               One document per entity: { status, violations[], updated_at }
```

The key insight: **rules never touch a database**. All data they need is loaded in stage 2 and handed to them in a read-only `ValidationContext`. This makes rules fast, deterministic, and trivial to test.

---

## Architecture

```
cmd/workers/
  <domain>-batch-producer/   ← reads from source, publishes entity IDs to AMQP
  <domain>-batch-consumer/   ← receives batches, runs pipeline, writes canonical

internal/
  domain/                    ← plain Go structs, no logic
  application/
    ports/                   ← interfaces (the hexagon boundary)
    jobs/                    ← producer and handler orchestration
  rules/
    proposals/               ← RULE-001 through RULE-004
    receipts/                ← RULE-001
    advances/                ← RULE-ADV-001 through RULE-ADV-010
  engine/                    ← RuleRegistry + ValidationEngine
  infrastructure/
    postgres/                ← SQL adapters
    mongodb/                 ← MongoDB adapters
```

**The dependency rule in one sentence:** every package imports toward `domain`. Nothing in `domain/` or `rules/` ever imports from `infrastructure/` or `jobs/`.

---

## How a rule looks

Rules are the simplest thing in the codebase — a struct with a `Name()`, a `Description()`, and an `Execute()` that reads the context and returns a result. Nothing else.

```go
// internal/rules/advances/rule_adv_001.go
type RuleAdv001 struct{}

func (r *RuleAdv001) Name() string        { return "RULE-ADV-001" }
func (r *RuleAdv001) Description() string { return "Advance report has no associated broker" }

func (r *RuleAdv001) Execute(ctx *rules.ValidationContext) rules.RuleResult {
    result := rules.RuleResult{
        RuleName:         "RULE-ADV-001",
        RecordsScanned:   len(ctx.AdvanceReports),
        FlaggedProposals: make(map[string]string),
    }

    for _, adv := range ctx.AdvanceReports {
        if adv.BrokerID == "" {
            result.IssuesFound++
            result.FlaggedProposals[adv.ID] = "advance has no broker assigned"
        }
    }

    result.Triggered = result.IssuesFound > 0
    return result
}
```

Rules are registered at startup in `cmd/workers/<domain>-batch-consumer/main.go` and run automatically by the engine. Adding a rule = creating one file + one `reg.MustRegister(...)` line.

---

## The canonical output

Every entity processed produces exactly one document in its canonical collection:

```json
{
  "advance_report_id": "adv-12345",
  "tenant_id": 1,
  "status": "SUSPICIOUS",
  "violations": [
    { "rule": "RULE-ADV-001", "reason": "advance has no broker assigned" },
    { "rule": "RULE-ADV-006", "reason": "amount exceeds approved credit limit" }
  ],
  "run_id": "3f8a1b...",
  "updated_at": "2026-05-29T14:32:00Z"
}
```

The ledger reads this collection through a narrow port interface — it never imports validators types. The collection name is the only coupling between the two services.

---

## Running locally

```bash
# Start MongoDB + Mongo Express UI (http://localhost:8081)
docker-compose up -d

# Run both workers for a domain (example: advances)
go run ./src/cmd/workers/advance-batch-producer/main.go
go run ./src/cmd/workers/advance-batch-consumer/main.go

# Run all tests
go test ./src/tests/...

# Run only unit tests for rules
go test ./src/tests/unit/rules/...
```

---

## Adding a new rule to an existing domain

1. Create `internal/rules/<domain>/rule_<code>_<nnn>.go` and implement the `Rule` interface.
2. Register it in `cmd/workers/<domain>-batch-consumer/main.go`:
   ```go
   reg.MustRegister(myDomainRules.NewRule<Code><Nnn>())
   ```
3. Add a unit test in `src/tests/unit/rules/` and one line in `src/tests/contract/rules/contract_test.go`.

If your rule needs data not yet in `ValidationContext`, add a method to the relevant port interface, implement it in the infrastructure adapter, and fetch the data in the enrichment stage. The rule itself stays clean.

## Adding a new domain

See `worker_framework_doc.md` at the repo root — § 3 walks through the complete step-by-step with all Go templates included.

---

## What never changes

These primitives are stable. A new domain never modifies them:

- `Rule` interface — `Name()`, `Description()`, `Execute(*ValidationContext) RuleResult`
- `RuleRegistry` + `ValidationEngine`
- The four-stage pipeline (`ingest → enrich → validate → aggregate`)
- The AMQP worker reconnect loop
- The upsert `BulkWrite` pattern in MongoDB adapters
- The cursor pagination pattern in PostgreSQL adapters (`id > $lastID ORDER BY id LIMIT n`)

---

## The one rule that matters most

> **Rules never call databases.** If a rule needs data, that data must be fetched during enrichment and placed in `ValidationContext`. A rule that opens a database connection is a broken rule — it cannot be unit tested, it breaks the pure-function contract, and it couples business logic to infrastructure.
