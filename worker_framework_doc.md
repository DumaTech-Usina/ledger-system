# Worker Framework Guide

Single authoritative guide for implementing a new domain in this system.

---

## System Overview

Two independent services collaborate to validate business events and record them permanently.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          validators/  (Go)                                   │
│                                                                               │
│  Source DB (PG)                                                               │
│      │                                                                        │
│  [BatchProducer] ──── AMQP ────► [BatchHandler]                              │
│      │                                │                                       │
│  Fetches entities               Runs rules against ValidationContext          │
│  Publishes batches              Writes canonical verdict to MongoDB           │
│                                 { status: CLEAN | SUSPICIOUS, violations[] } │
└───────────────────────────────────────────────────────────────────────────────┘
                                        │
                               canonical collection
                                (MongoDB, read-only)
                                        │
┌───────────────────────────────────────┼──────────────────────────────────────┐
│                          ledger/  (TypeScript)                                │
│                                       │                                       │
│  ETL Source DB (Mongo)                │                                       │
│       │                               │ (gates posting on CLEAN verdict)      │
│  [*IngestJob]──────────────────────────                                       │
│       │                                                                       │
│   staging_records (MongoDB)                                                   │
│   status: pending                                                             │
│       │                                                                       │
│  [*SubmitJob] ──── AMQP ────► [StagingPostingJob]                            │
│       │                               │                                       │
│   status: queued             validates → CreateLedgerEventUseCase             │
│                                        │                                       │
│                              LedgerEvent (PostgreSQL)   ← accepted            │
│                              RejectedEvent (MongoDB)    ← rejected            │
└───────────────────────────────────────────────────────────────────────────────┘
```

**The cross-service contract:** Ledger reads a validators canonical collection through a narrow
port interface. Only the MongoDB collection name couples the two services — Ledger never imports
Validators types.

---

## § 1 — Taxonomy: Choose Your Archetype

Fill this table before writing any code. The archetype determines which sections of this guide apply.

| Archetype                | Service     | Input              | Output                                           | Use when                                              |
| ------------------------ | ----------- | ------------------ | ------------------------------------------------ | ----------------------------------------------------- |
| **Domain Validator**     | validators/ | batch AMQP message | `aspirant_<domain>_canonical` (CLEAN/SUSPICIOUS) | New entity class needs semantic validation rules      |
| **Cross-Domain Checker** | validators/ | batch AMQP message | extends existing canonical                       | A rule needs state from another domain's canonical    |
| **Enrichment Extender**  | validators/ | existing domain    | no new canonical                                 | Existing domain needs a new data source for new rules |
| **Posting Job**          | ledger/     | external ETL event | StagingRecord → LedgerEvent                      | Cash physically moved and needs ledger recording      |
| **Context Job**          | ledger/     | external ETL event | lineage DTO only (no StagingRecord)              | Causal lineage only, no economic effect               |
| **Resolution Worker**    | ledger/     | edge case event    | StagingRecord                                    | Compensations, corrections, zero-amount cases         |

---

## § 2 — Pre-Code Gates: The Three Cards

**No implementation begins before every applicable card is filled.**
Cards are embedded as header comments in the first implementation file they govern.

### Card A — Operational Event Card

Always filled first, before any code in either service.

```typescript
/**
 * OPERATIONAL EVENT CARD
 * ─────────────────────────────────────────────────────────────
 * Operational event:   <what happened in the real world>
 * Archetype:           <from § 1>
 * Primary entity:      <ENTITY>
 * Natural key:         <field that uniquely identifies each entity>
 * Validation needed:   YES (reads <collection>) | NO
 * ─────────────────────────────────────────────────────────────
 */
```

```go
// OPERATIONAL EVENT CARD
// ─────────────────────────────────────────────────────────────
// Operational event:   <what happened in the real world>
// Archetype:           <from § 1>
// Primary entity:      <ENTITY>
// Natural key:         <field>
// Source DB:           PostgreSQL | MongoDB | External
// Cardinality:         ~N records per batch
// Update frequency:    realtime | hourly | daily | on-demand
// Validation needed:   YES → fill Card B first | NO → fill Card C directly
// Produces canonical:  YES → <domain>_canonical | NO
// Cross-service link:  Ledger reads <collection> via <PortInterface> | none
// ─────────────────────────────────────────────────────────────
```

### Card B — Rule Spec Card (Validators only)

One card per rule. Gate: no code until every rule for the domain has a completed Card B.

```go
// RULE SPEC CARD
// ─────────────────────────────────────────────────────────────
// Rule ID:        RULE-<DOMAIN>-<NNN>
// Entity:         <ENTITY>
// Condition:      <single boolean sentence — no AND chaining across dimensions>
// Data required:  <exhaustive list of fields from ValidationContext>
// Cross-domain:   YES (source: <collection>, port: <InterfaceName>) | NO
// Output:         "<human-readable reason string>"
// Edge cases:     (1) empty batch  (2) ghost IDs  (3) <domain-specific>
// Complexity:     O(n) with index | O(n²) — explain if acceptable
// ─────────────────────────────────────────────────────────────
```

### Card C — Translation Job Card (Ledger only)

Gate: all five matrix checks must pass before any implementation begins.

```typescript
/**
 * TRANSLATION JOB CARD
 * ─────────────────────────────────────────────────────────────
 * Archetype:               Posting Job | Context Job | Resolution Worker
 * Economic effect:         CASH_IN | CASH_OUT | CASH_INTERNAL | NON_CASH
 * EventType:               <from EventContract.ts>
 * ObjectType:              <positional | contextual>
 * Relation:                ORIGINATES | ADJUSTS | SETTLES | REVERSES | REFERENCES
 * ReasonType:              <from enums/ReasonType.ts>
 *
 * Five-matrix gate (all must pass before coding):
 *   [ ] Effect × Relation    ECONOMIC_EFFECT_RELATION_MATRIX  — Relation valid for effect?
 *   [ ] Object × Nature      OBJECT_NATURE_MATRIX             — positional or contextual?
 *   [ ] Object × Relation    OBJECT_RELATION_MATRIX           — Relation valid for ObjectType?
 *   [ ] Reason × Effect      REASON_EFFECT_MATRIX             — Effect valid for ReasonType?
 *   [ ] Reason × Relation    REASON_RELATION_MATRIX           — Relation valid for ReasonType?
 *
 * Party directions:         IN: <party>  OUT: <party>  NEUTRAL: <party>
 * sourceReference pattern:  <domain>:<id>:<role>
 * Reads canonical from:     <collection> via <PortInterface> | none
 * ─────────────────────────────────────────────────────────────
 */
```

**Five-matrix reference:**

| Matrix            | File                | Question                                          |
| ----------------- | ------------------- | ------------------------------------------------- |
| Effect × Relation | `FormalMatrices.ts` | Is this Relation valid for this EconomicEffect?   |
| Object × Nature   | `FormalMatrices.ts` | Is this object positional or contextual?          |
| Object × Relation | `FormalMatrices.ts` | Is this Relation valid for this ObjectType?       |
| Reason × Effect   | `FormalMatrices.ts` | Is this EconomicEffect valid for this ReasonType? |
| Reason × Relation | `FormalMatrices.ts` | Is this Relation valid for this ReasonType?       |

**Positional vs contextual objects:**

- **Positional** (ADVANCE, LOAN, COMMISSION_RECEIVABLE, …): carry economic state → use ORIGINATES / ADJUSTS / SETTLES / REVERSES.
- **Contextual** (PROPOSAL, INSTALLMENT, CONTRACT, …): annotate lineage only → must always use REFERENCES. Any other relation throws on invariant 11.

---

## § 3 — Validators: Implementing a Domain Validator

### Directory structure

```
validators/src/
  internal/
    domain/
      <domain>.go                          ← entity types + canonical type + status enum
    application/
      ports/
        <domain>_repository.go             ← entity fetch interface
        aspirant_<domain>_canonical_repository.go
        <domain>_status_checker.go         ← only if cross-domain lookup needed
      jobs/
        <domain>_batch_producer.go
        <domain>_batch_handler.go
    rules/
      <domain>/
        rule_<domain>_001.go               ← one file per rule
        rule_<domain>_002.go
        helpers.go                         ← only if ≥ 2 rules share logic
    infrastructure/
      postgres/
        <domain>_repository.go
      mongodb/
        aspirant_<domain>_canonical_repository.go
    messaging/messages/
      types.go                             ← extend, never replace
  cmd/workers/
    <domain>-batch-producer/main.go
    <domain>-batch-consumer/main.go
  tests/
    unit/
      rules/<domain>_rule_<nnn>_test.go    ← one file per rule
      jobs/<domain>_batch_producer_test.go
      jobs/<domain>_batch_handler_test.go
    contract/rules/contract_test.go        ← add one line per rule
    integration/<domain>_pipeline_test.go
    fixtures/
      mocks.go                             ← extend
      factories.go                         ← extend
      builders.go                          ← extend
```

### Phase order and gates

| Phase                     | What                                                       | Gate                                                                                         |
| ------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **1 — Foundation**        | Domain types, ValidationContext extension, port interfaces | `go build ./...` passes; new context fields have zero values that don't panic existing rules |
| **2 — Rules**             | Rule files + helpers                                       | Each rule compiles in isolation; no cross-rule imports                                       |
| **3 — Messaging + Jobs**  | Message type, producer job, handler job                    | `go build ./...` passes without infrastructure                                               |
| **4 — Infrastructure**    | PG adapter, MongoDB adapter, indexes                       | `go build ./...` passes                                                                      |
| **5 — Composition Roots** | Producer `main.go`, consumer `main.go`                     | Both binaries compile cleanly                                                                |
| **6 — Tests**             | Mocks, factories, builders, unit, contract, integration    | `go test ./src/tests/...` — zero failures                                                    |

Phases 1 → 2 → 3 are strictly sequential. Within Phase 2, individual rule files are parallelizable. PG and MongoDB adapters in Phase 4 are parallelizable.

### Domain entity file (`internal/domain/<domain>.go`)

Embed Card A. Plain structs only — no methods, no business logic.

```go
package domain

import "time"

type <ENTITY> struct {
    ID       string
    TenantID int64
    // business fields — only what rules will inspect
}

type <ENTITY>Status string

const (
    <ENTITY>StatusClean      <ENTITY>Status = "CLEAN"
    <ENTITY>StatusSuspicious <ENTITY>Status = "SUSPICIOUS"
)

type <ENTITY>Violation struct {
    Rule   string
    Reason string
}

type Canonical<ENTITY> struct {
    <ENTITY>ID string
    TenantID   int64
    Status     <ENTITY>Status
    Violations []<ENTITY>Violation
    RunID      string
    UpdatedAt  time.Time
}
```

### ValidationContext extension (`internal/rules/validation_context.go`)

Add at the bottom of the struct. Zero values must not panic existing rules.

```go
// <DOMAIN> fields
<ENTITY>s             []domain.<ENTITY>
<ENTITY>Links         []domain.<ENTITY>Link        // only if junction data needed
<ENTITY>ExternalState map[string]bool              // only if cross-domain lookup needed
```

Add map initializations to `NewValidationContext()` for any non-nil maps.

### Rule implementation (`internal/rules/<domain>/rule_<domain>_<nnn>.go`)

Embed Card B. One file per rule. Never exceed 40 lines in Execute.

```go
package <domain>

import "validators/src/internal/rules"

const rule<Domain><Nnn>Name = "RULE-<DOMAIN>-<NNN>"

type Rule<Domain><Nnn> struct{}

func NewRule<Domain><Nnn>() *Rule<Domain><Nnn> { return &Rule<Domain><Nnn>{} }

func (r *Rule<Domain><Nnn>) Name() string        { return rule<Domain><Nnn>Name }
func (r *Rule<Domain><Nnn>) Description() string { return "<what anomaly this rule detects>" }

func (r *Rule<Domain><Nnn>) Execute(ctx *rules.ValidationContext) rules.RuleResult {
    result := rules.RuleResult{
        RuleName:         rule<Domain><Nnn>Name,
        RecordsScanned:   len(ctx.<ENTITY>s),
        FlaggedProposals: make(map[string]string), // always initialize — never nil
    }

    // If comparing entities to auxiliary data, build an index first — O(n), not O(n²):
    // indexByID := make(map[string][]string, len(ctx.<ENTITY>Links))
    // for _, link := range ctx.<ENTITY>Links {
    //     indexByID[link.<ENTITY>ID] = append(indexByID[link.<ENTITY>ID], link.RelatedID)
    // }

    for _, e := range ctx.<ENTITY>s {
        if /* condition */ {
            result.IssuesFound++
            result.FlaggedProposals[e.ID] = "<reason: specific, includes entity ID>"
        }
    }

    result.Triggered = result.IssuesFound > 0
    return result
}
```

**Rule constraints:**

- Never call repositories inside Execute.
- Never call other rules inside Execute.
- Never mutate the ValidationContext.
- Every index built inside Execute is local to that call — never shared between rules.
- Shared logic across ≥ 2 rules → extract to `internal/rules/<domain>/helpers.go`.

### Contract test entry (`src/tests/contract/rules/contract_test.go`)

Add one line per new rule. Not optional.

```go
func TestRule<Domain><Nnn>_Contract(t *testing.T) {
    verifyRuleContract(t, <domain>Rules.NewRule<Domain><Nnn>())
}
```

The harness automatically verifies: non-empty name, non-empty description, no panic on empty context, RuleName matches Name(), idempotency, no context mutation.

### AMQP topology

Naming convention (fill in `<domain>` with the domain name):

| Resource             | Value                            |
| -------------------- | -------------------------------- |
| Routing key          | `validation.<domain>.batch`      |
| Main queue           | `validators.<domain>.batch`      |
| Dead-letter queue    | `validators.<domain>.batch.dead` |
| Canonical collection | `aspirant_<domain>_canonical`    |

### Producer composition root (`cmd/workers/<domain>-batch-producer/main.go`)

Wires dependencies and starts the polling loop. No business logic.

```go
package main

import (
	"context"
	"errors"
	"log"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"validators/src/internal/application/jobs"
	infraConfig "validators/src/internal/infrastructure/config"
	infraPostgres "validators/src/internal/infrastructure/postgres"
	"validators/src/internal/messaging/rabbitmq"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	batchSize, _ := strconv.Atoi(envOr("BATCH_SIZE", "100"))
	pollInterval, _ := time.ParseDuration(envOr("POLL_INTERVAL", "30s"))

	conns, err := infraConfig.Connect(mustEnv("POSTGRES_URL"), mustEnv("MONGO_URL"), mustEnv("MONGO_DB"))
	if err != nil {
		log.Fatalf("connect: %v", err)
	}

	publisher := rabbitmq.NewPublisher(mustEnv("AMQP_URL"))
	if err := publisher.Connect(); err != nil {
		log.Fatalf("publisher: %v", err)
	}
	defer publisher.Close()

	producer := jobs.New<ENTITY>BatchProducer(
		infraPostgres.New<ENTITY>Repository(conns.Postgres),
		publisher,
		batchSize,
	)

	if err := producer.StartPolling(ctx, pollInterval); err != nil && !errors.Is(err, context.Canceled) {
		log.Fatal(err)
	}
}

func mustEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		log.Fatalf("missing required env: %s", key)
	}
	return v
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
```

### Consumer composition root (`cmd/workers/<domain>-batch-consumer/main.go`)

Wires dependencies, ensures MongoDB indexes, registers rules, and starts the AMQP worker. No business logic.

```go
package main

import (
	"context"
	"errors"
	"log"
	"os"
	"os/signal"
	"syscall"

	"validators/src/internal/application/jobs"
	"validators/src/internal/engine"
	infraConfig "validators/src/internal/infrastructure/config"
	infraMongo "validators/src/internal/infrastructure/mongodb"
	infraPostgres "validators/src/internal/infrastructure/postgres"
	"validators/src/internal/messaging/rabbitmq"
	<domain>Rules "validators/src/internal/rules/<domain>"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	conns, err := infraConfig.Connect(mustEnv("POSTGRES_URL"), mustEnv("MONGO_URL"), mustEnv("MONGO_DB"))
	if err != nil {
		log.Fatalf("connect: %v", err)
	}
	if err := infraMongo.EnsureIndexes(ctx, conns.MongoDB); err != nil {
		log.Fatalf("indexes: %v", err)
	}

	// Wire rules — maintain alphabetical registration order.
	reg := engine.NewRegistry()
	reg.MustRegister(<domain>Rules.NewRule<Domain>001())
	// reg.MustRegister(<domain>Rules.NewRule<Domain>002())
	eng := engine.NewValidationEngine(reg, engine.Sequential)

	handler := jobs.New<ENTITY>BatchHandler(
		infraPostgres.New<ENTITY>Repository(conns.Postgres),
		infraMongo.NewAspirant<ENTITY>CanonicalRepository(conns.MongoDB),
		nil, // replace with cross-domain checker if needed: infraMongo.NewCanonical<Other>Reader(conns.MongoDB)
		infraMongo.NewAuditRepository(conns.MongoDB),
		eng,
	)

	worker := rabbitmq.NewWorker(mustEnv("AMQP_URL"), rabbitmq.WorkerConfig{
		Queue:      "validators.<domain>.batch",
		RoutingKey: "validation.<domain>.batch",
		DLQueue:    "validators.<domain>.batch.dead",
	}, handler)

	if err := worker.Start(ctx); err != nil && !errors.Is(err, context.Canceled) {
		log.Fatal(err)
	}
}

func mustEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		log.Fatalf("missing required env: %s", key)
	}
	return v
}
```

**Makefile entry** — add to `validators/Makefile` so both binaries are buildable:

```makefile
build-<domain>-producer:
	go build -o bin/<domain>-batch-producer ./src/cmd/workers/<domain>-batch-producer

build-<domain>-consumer:
	go build -o bin/<domain>-batch-consumer ./src/cmd/workers/<domain>-batch-consumer
```

---

## § 4 — Ledger: Implementing a Posting Domain

### The three-tier pipeline

Every ledger domain follows exactly three tiers. Understanding these tiers is the prerequisite for all naming decisions.

```
TIER 1 — INGEST
  Source: external ETL DB (MongoDB or PostgreSQL)
  Job class:  <Domain>IngestJob   ← orchestrates the polling loop
  Job class:  <Domain>StagingJob  ← transforms one input into a StagingRecord
  Worker file: workers/producers/ingest-<domain>.ts
  npm script:  ingest:<domain>
  Status written: pending

         ↓ staging_records (MongoDB)

TIER 2 — SUBMIT
  Source: staging_records (pending)
  Job class:  StagingSubmitJob    ← generic, shared by all domains
  Worker file: workers/producers/submit-<domain>.ts
  npm script:  submit:<domain>
  Status transition: pending → queued → published to AMQP

         ↓ RabbitMQ exchange: 'ledger', routing key: 'staging.<domain>'

TIER 3 — POST
  Source: AMQP queue 'ledger.staging' (bound to all 'staging.*' routing keys)
  Job class:  StagingPostingJob   ← generic, shared by all domains
  Worker file: workers/consumers/post-staging.ts
  npm script:  post:staging
  Status transition: queued → accepted (LedgerEvent) | rejected (RejectedEvent)
```

**Key constraint:** Tier 3 is shared across all domains. `StagingPostingJob` and its worker `post-staging.ts` are never modified per domain. The only domain-specific code lives in Tiers 1 and 2.

### Directory structure

```
ledger/src/infra/
  jobs/
    <Domain>IngestJob.ts       ← Tier 1: polling loop + stream orchestration
    <Domain>StagingJob.ts      ← Tier 1: per-record transformer → StagingRecord
    StagingSubmitJob.ts        ← Tier 2: generic outbox drainer (shared)
    StagingPostingJob.ts       ← Tier 3: generic AMQP consumer (shared)
  workers/
    producers/
      ingest-<domain>.ts       ← composition root for Tier 1
      submit-<domain>.ts       ← composition root for Tier 2
    consumers/
      post-staging.ts          ← composition root for Tier 3 (shared, never modified)
  etl/
    Mongo<Domain>ETLReader.ts  ← ETL source adapter
  messaging/rabbitmq/
    StagingWorker.ts           ← AMQP consumer (shared, never modified per domain)
```

### Naming conventions

**Job classes:**

| Class                | Responsibility                                                             | Location      |
| -------------------- | -------------------------------------------------------------------------- | ------------- |
| `<Domain>IngestJob`  | Drives the polling loop; calls `<Domain>StagingJob` per record             | `infra/jobs/` |
| `<Domain>StagingJob` | Transforms one ETL input → `StagingRecord`; calls `stagingRepo.save()`     | `infra/jobs/` |
| `StagingSubmitJob`   | Claims `pending` records, publishes to AMQP; shared                        | `infra/jobs/` |
| `StagingPostingJob`  | Validates staging record, creates `LedgerEvent` or `RejectedEvent`; shared | `infra/jobs/` |

**Worker files and npm scripts:**

| File                                   | Script            | Tier                     |
| -------------------------------------- | ----------------- | ------------------------ |
| `workers/producers/ingest-<domain>.ts` | `ingest:<domain>` | 1 — ETL source → staging |
| `workers/producers/submit-<domain>.ts` | `submit:<domain>` | 2 — staging → AMQP       |
| `workers/consumers/post-staging.ts`    | `post:staging`    | 3 — AMQP → LedgerEvent   |

### <Domain>StagingJob (`infra/jobs/<Domain>StagingJob.ts`)

Embed Card A + Card C. This class does one thing: given one validated ETL input, produce one `StagingRecord` and save it.

```typescript
export class <Domain>StagingJob {
  constructor(
    private readonly stagingRepo: StagingRepository,
    private readonly usinaPartyId: string,
    private readonly workerId: string,
    private readonly warn: (message: string) => void = () => {},
  ) {}

  async run(input: <Domain>Input): Promise<void> {
    if (!this.isEligible(input)) return
    await this.stagingRepo.save(this.buildCandidate(input))
  }

  private isEligible(input: <Domain>Input): boolean {
    if (input.amount <= 0) {
      this.warn(`Skipped <domain> ${input.id}: amount=${input.amount} is not positive`)
      return false
    }
    // add additional structural guards — reject before building candidate
    return true
  }

  private buildCandidate(input: <Domain>Input): StagingRecord {
    const amountStr = input.amount.toFixed(2)
    return {
      id: crypto.randomUUID(),
      status: 'pending',                          // always pending — StagingPostingJob owns transitions
      eventType: EventType.<EVENT_TYPE>,
      economicEffect: EconomicEffect.<EFFECT>,
      occurredAt: input.<dateField>.toISOString(), // when the economic fact occurred, not when the job ran
      amount: amountStr,                           // always positive string
      currency: 'BRL',
      sourceSystem: 'integration',
      sourceReference: `<domain>:${input.id}:<role>`, // deterministic, globally unique
      normalizationVersion: '1.0',
      normalizationWorkerId: this.workerId,        // injected via constructor — never hardcoded
      parties: [
        { partyId: this.usinaPartyId, role: PartyRole.<ROLE>, direction: Direction.<DIR>, amount: amountStr },
        { partyId: input.counterpartyId, role: PartyRole.<ROLE>, direction: Direction.NEUTRAL },
      ],
      objects: [
        { objectId: input.id, objectType: ObjectType.<TYPE>, relation: Relation.<RELATION> },
      ],
      reason: {
        type: ReasonType.<REASON>,
        description: '<human-readable description>',
        confidence: ConfidenceLevel.HIGH,
        requiresFollowup: false,
      },
      reporter: {
        reporterType: ReporterType.SYSTEM,
        reporterId: '<domain>-staging-job',
        channel: 'batch-integration',
      },
    }
  }
}
```

**StagingRecord invariants that must hold:**

- `status` is always `'pending'` — `StagingPostingJob` owns all other transitions.
- `amount` is always a positive decimal string — `isEligible()` rejects zero and negative.
- `sourceReference` is deterministic and globally unique — document the pattern in Card C.
- `occurredAt` is when the business fact occurred, not when the job ran.
- `usinaPartyId` and `workerId` are injected via constructor — never hardcoded.
- Contextual objects (`PROPOSAL`, `INSTALLMENT`, `CONTRACT`) use `REFERENCES` relation only.
- Only parties that contribute to `totalIn` or `totalOut` carry an `amount`; omit on `NEUTRAL` parties.
- The job never reads or modifies existing `LedgerEvent` records.

### <Domain>IngestJob (`infra/jobs/<Domain>IngestJob.ts`)

Drives the polling loop. Calls `<Domain>StagingJob` per streamed record.

```typescript
export class <Domain>IngestJob {
  constructor(
    private readonly reader: <Domain>ETLReader,
    private readonly stagingJob: <Domain>StagingJob,
  ) {}

  async run(): Promise<void> {
    let staged = 0
    for await (const input of this.reader.stream<Domain>s()) {
      await this.stagingJob.run(input)
      staged++
    }
    console.log(`[<Domain>IngestJob] done — processed ${staged} record(s) to staging`)
  }

  async startPolling(intervalMs = 30_000): Promise<void> {
    while (true) {
      try {
        await this.run()
      } catch (err) {
        console.error('[<Domain>IngestJob] error during run:', err)
      }
      await sleep(intervalMs)
    }
  }
}
```

### Tier 1 worker (`workers/producers/ingest-<domain>.ts`)

Composition root — wires dependencies and starts the polling loop. No logic.

```typescript
import 'reflect-metadata';
import 'dotenv/config';
import { env } from '../../../config/env';
import { getMongoDb, getMongoDatabase, closeMongoDb } from '../../database/mongo-client';
import { MongoStagingRepository } from '../../persistence/mongodb/MongoStagingRepository';
import { Mongo<Domain>ETLReader } from '../../etl/Mongo<Domain>ETLReader';
import { <Domain>StagingJob } from '../../jobs/<Domain>StagingJob';
import { <Domain>IngestJob } from '../../jobs/<Domain>IngestJob';

async function main(): Promise<void> {
  const stagingDb = await getMongoDb();
  const etlDb = await getMongoDatabase(env.MONGO_ETL_DB);

  const stagingRepo = new MongoStagingRepository(stagingDb);
  const reader = new Mongo<Domain>ETLReader(etlDb);
  const stagingJob = new <Domain>StagingJob(stagingRepo, env.USINA_PARTY_ID, '<domain>-etl', console.warn.bind(console));
  const etl = new <Domain>IngestJob(reader, stagingJob);

  const shutdown = async (signal: string) => {
    console.log(`[ingest-<domain>] ${signal} — shutting down`);
    await closeMongoDb();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  console.log(`[ingest-<domain>] starting — polling ${env.MONGO_ETL_DB} every 30s`);
  await etl.startPolling(30_000);
}

main().catch((err) => {
  console.error('[ingest-<domain>] fatal:', err);
  process.exit(1);
});
```

### Tier 2 worker (`workers/producers/submit-<domain>.ts`)

Uses the shared `StagingSubmitJob`. Only the routing key and event type filter are domain-specific.

```typescript
import 'dotenv/config';
import { env } from '../../../config/env';
import { getMongoDb } from '../../database/mongo-client';
import { MongoStagingRepository } from '../../persistence/mongodb/MongoStagingRepository';
import { RabbitMQPublisher } from '../../messaging/rabbitmq/RabbitMQPublisher';
import { StagingSubmitJob } from '../../jobs/StagingSubmitJob';
import { EventType } from '../../../core/domain/enums/EventType';

const <DOMAIN>_EVENT_TYPES = [
  EventType.<EVENT_TYPE_1>,
  // EventType.<EVENT_TYPE_2>,  // add if this domain produces multiple event types
];

async function main(): Promise<void> {
  const db = await getMongoDb();
  const stagingRepo = new MongoStagingRepository(db);

  const publisher = new RabbitMQPublisher(env.RABBITMQ_URL);
  await publisher.connect();

  const submit = new StagingSubmitJob(stagingRepo, publisher, 'staging.<domain>', <DOMAIN>_EVENT_TYPES);

  console.log('[submit-<domain>] starting...');
  await submit.startPolling(5000);
}

main().catch((err) => {
  console.error('[submit-<domain>] fatal:', err);
  process.exit(1);
});
```

### Tier 3 worker (`workers/consumers/post-staging.ts`)

**This file is shared and never modified when adding a new domain.**

When you add a new domain's routing key, the only change is in `StagingWorker` constructor call — add the new routing key to the array:

```typescript
// workers/consumers/post-staging.ts
const worker = new StagingWorker(
  env.RABBITMQ_URL,
  job,
  ["staging.receipt", "staging.advance", "staging.<domain>"], // ← add here
);
```

`StagingWorker` binds `ledger.staging` to every routing key in that array. If a key is missing, messages published for that domain are silently dropped by RabbitMQ and records stay `queued` forever.

### AMQP topology for ledger

| Resource             | Pattern                    | Example               |
| -------------------- | -------------------------- | --------------------- |
| Exchange             | `ledger` (direct, durable) | `ledger`              |
| Routing key (submit) | `staging.<domain>`         | `staging.advance`     |
| Main queue           | `ledger.staging` (shared)  | `ledger.staging`      |
| DLX                  | `ledger.dlx`               | `ledger.dlx`          |
| DLQ                  | `ledger.staging.dead`      | `ledger.staging.dead` |

### npm scripts (`package.json`)

```json
"ingest:<domain>": "tsx src/infra/workers/producers/ingest-<domain>.ts",
"submit:<domain>": "tsx src/infra/workers/producers/submit-<domain>.ts",
"post:staging":    "tsx src/infra/workers/consumers/post-staging.ts"
```

Add the new ingest and submit scripts to the `dev:full` concurrently command.

### Ledger job pre-code checklist

```
[ ] Read EventContract.ts — confirm EventType allows your economicEffect
[ ] Run all five FormalMatrices checks for each (effect, object, relation, reason) tuple
[ ] Verify party directions satisfy validateFlow() for the chosen effect:
      CASH_IN:       at least one party IN; PAYER cannot be IN
      CASH_OUT:      at least one party OUT; PAYEE cannot be OUT
      CASH_INTERNAL: totalIn = totalOut = amount
      NON_CASH:      all parties NEUTRAL; totalIn = totalOut = 0
[ ] Contextual objects (PROPOSAL, INSTALLMENT, CONTRACT) use REFERENCES — never ORIGINATES
[ ] Amount is always positive — isEligible() rejects zero and negative before staging
[ ] sourceReference is deterministic — document the pattern in Card C
[ ] status is always 'pending' — StagingPostingJob owns all transitions
[ ] usinaPartyId and workerId injected via constructor — never hardcoded
[ ] Add new routing key to StagingWorker constructor in post-staging.ts
[ ] Add new npm scripts to package.json and dev:full
[ ] Job never reads or modifies existing LedgerEvent records
[ ] Job does not emit payable/settlement candidates belonging to a later lifecycle phase
```

---

## § 5 — Cross-Service Wiring

When a ledger Posting Job must gate on a validators canonical verdict (e.g. only post advances that are `CLEAN`), follow this pattern. Never import validators types into ledger.

**Step 1 — Ledger defines a narrow port:**

```typescript
// ledger/src/core/application/ports/<Domain>CanonicalReader.ts
export interface <Domain>CanonicalReader {
  fetchClean<Domain>s(): AsyncGenerator<<Domain>Report>
}
```

**Step 2 — Ledger infra adapter reads the MongoDB collection by name:**

```typescript
// ledger/src/infra/etl/Mongo<Domain>CanonicalReader.ts
import type { Db } from 'mongodb'
import type { <Domain>CanonicalReader } from '../../core/application/ports/<Domain>CanonicalReader'

export class Mongo<Domain>CanonicalReader implements <Domain>CanonicalReader {
  constructor(private readonly db: Db) {}

  async *fetchClean<Domain>s() {
    const cursor = this.db
      .collection('aspirant_<domain>_canonical')    // ← collection name is the only coupling
      .find({ status: 'CLEAN' })
    for await (const doc of cursor) {
      yield this.toDto(doc)
    }
  }
}
```

**Step 3 — Ingest job uses the port, not the adapter:**

```typescript
export class <Domain>IngestJob {
  constructor(
    private readonly reader: <Domain>CanonicalReader,  // port interface
    private readonly stagingJob: <Domain>StagingJob,
  ) {}
}
```

The collection name `aspirant_<domain>_canonical` is defined as a constant in validators' MongoDB adapter and must never be renamed without a coordinated data migration in both services.

---

## § 6 — Testing Contract

Tests are mandatory before any PR merges.

### Coverage requirements

| Worker type                       | Required                                                                                      |
| --------------------------------- | --------------------------------------------------------------------------------------------- |
| Every validators rule             | unit test file (6 cases minimum) + one contract test entry                                    |
| Every validators domain           | producer unit test + handler unit test + pipeline integration test                            |
| Every ledger `<Domain>StagingJob` | unit test file covering: eligible path, every ineligibility guard, observability (warn calls) |
| Every ledger domain               | at least one business-flow integration test (`<domain>-posting-flow.test.ts`)                 |

### Test file naming

| Subject                | File path                                                                     |
| ---------------------- | ----------------------------------------------------------------------------- |
| `<Domain>StagingJob`   | `tests/unit/infra/<domain>-staging-job.test.ts`                               |
| `<Domain>IngestJob`    | `tests/unit/infra/<domain>-ingest-job.test.ts` (if non-trivial orchestration) |
| Business flow          | `tests/integration/business-flows/<domain>-posting-flow.test.ts`              |
| Validators rule        | `src/tests/unit/rules/<domain>_rule_<nnn>_test.go`                            |
| Validators handler     | `src/tests/unit/jobs/<domain>_batch_handler_test.go`                          |
| Validators producer    | `src/tests/unit/jobs/<domain>_batch_producer_test.go`                         |
| Validators integration | `src/tests/integration/<domain>_pipeline_test.go`                             |

### Test commands

```bash
# Run before every commit that touches rules, jobs, or workers:
cd validators && go test ./src/tests/...   # must be zero failures
cd ledger     && npm test                  # must meet 85% line/function, 80% branch thresholds
```

### What unit tests must cover for `<Domain>StagingJob`

```typescript
describe("<Domain>StagingJob", () => {
  // eligible path
  it("saves a staging record for a valid input");
  it("sets eventType to <EVENT_TYPE>");
  it("sets economicEffect to <EFFECT>");
  it("sets status to pending");
  it("builds a deterministic sourceReference");
  it("serializes amount as a positive string with two decimal places");
  it("timestamps the record to the business fact date, not job run date");
  it("party directions satisfy the flow rule for <EFFECT>");

  // ineligibility guards — one test per guard condition
  it("does not save when amount is zero");
  it("does not save when amount is negative");
  it("does not save when <specific business condition>");

  // observability
  it("warn is called with entity id when skipped");
  it("warn is not called for an eligible input");
});
```

### What business-flow integration tests must cover

```typescript
describe("<Domain> posting flow — <Domain>StagingJob → StagingPostingJob → LedgerEvent", () => {
  it(
    "a valid input produces one LedgerEvent with correct eventType and economicEffect",
  );
  it("does not produce a LedgerEvent when input is ineligible");
  it("rejects a malformed staging record that bypasses isEligible");
  it("duplicate sourceReference — first accepted, second rejected");
});
```

---

## § 7 — Stable Primitives: What Never Changes

If a new domain requires modifying anything in this list, stop — the domain boundary or archetype choice is wrong.

### Validators

| Primitive                                            | Location                                      |
| ---------------------------------------------------- | --------------------------------------------- |
| `Rule` interface                                     | `internal/engine/`                            |
| `RuleResult` struct                                  | `internal/engine/`                            |
| `RuleRegistry` + `ValidationEngine`                  | `internal/engine/`                            |
| `Pipeline[T]`, `Stage[T]`, `Context[T]`              | `internal/pipeline/`                          |
| `Worker` (AMQP reconnect loop)                       | `internal/infrastructure/messaging/rabbitmq/` |
| `MessagePublisher` port                              | `internal/application/ports/`                 |
| `ValidationContextBuilder` base struct               | `tests/fixtures/builders.go`                  |
| SHA-256 batch ID computation                         | `compute<X>BatchID` pattern                   |
| Upsert `BulkWrite` + `SetOrdered(false)`             | all MongoDB canonical adapters                |
| Cursor pagination (`id > $lastID ORDER BY id LIMIT`) | all PostgreSQL adapters                       |
| `verifyRuleContract` harness                         | `tests/contract/rules/`                       |

### Ledger

| Primitive                     | Location                                                 |
| ----------------------------- | -------------------------------------------------------- |
| `StagingPostingJob`           | `infra/jobs/StagingPostingJob.ts`                        |
| `StagingSubmitJob`            | `infra/jobs/StagingSubmitJob.ts`                         |
| `StagingWorker`               | `infra/messaging/rabbitmq/StagingWorker.ts`              |
| `post-staging.ts` worker      | `infra/workers/consumers/post-staging.ts`                |
| `StagingRecordValidator`      | `core/application/services/StagingRecordValidator.ts`    |
| `CreateLedgerEventUseCase`    | `core/application/use-cases/CreateLedgerEventUseCase.ts` |
| `EventContract`               | `core/domain/contracts/EventContract.ts`                 |
| `FormalMatrices`              | `core/domain/policies/FormalMatrices.ts`                 |
| `InvariantPolicy`             | `core/domain/policies/InvariantPolicy.ts`                |
| `StagingRepository` interface | `core/application/repositories/StagingRepository.ts`     |

---

## § 8 — Common Mistakes

### Validators

| Mistake                                 | Consequence                                         | Rule                                           |
| --------------------------------------- | --------------------------------------------------- | ---------------------------------------------- |
| Repository call inside `Execute`        | Rule is no longer pure; untestable without infra    | All data must be in `ValidationContext`        |
| Rule calls another rule                 | Ordering dependency; breaks parallelism             | Engine is the only coordinator                 |
| Computed results in `ValidationContext` | Context becomes a side-effect channel               | Context holds fetched data only; rules compute |
| Stateful rule struct fields             | Different result on second call; idempotency broken | `Execute` must be stateless                    |
| Logic in `main.go`                      | Untested; composition root should only wire         | Any `if` that isn't wiring belongs in a job    |
| Single `Err` field in mocks             | Cannot simulate partial failures                    | One error field per method                     |

### Ledger

| Mistake                                                 | Consequence                                                  | Rule                                                       |
| ------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------- |
| `status` other than `'pending'` written by a job        | `StagingPostingJob` cannot claim the record                  | Jobs write `pending`; `StagingPostingJob` owns transitions |
| Non-deterministic `sourceReference`                     | Duplicate detection breaks; replay creates phantom events    | Pattern: `<domain>:<id>:<role>`                            |
| New routing key without updating `StagingWorker`        | Messages silently dropped; records stuck as `queued` forever | Add key to `routingKeys` array in `post-staging.ts`        |
| Hardcoded `usinaPartyId` or `workerId`                  | Cannot be tested or overridden in different environments     | Inject via constructor                                     |
| Using `COMMISSION_PAYMENT` reason on a `NON_CASH` event | Passes invariant 5 but fails invariant 6                     | Check `REASON_EFFECT_MATRIX`                               |
| Contextual object with `ORIGINATES` relation            | Throws on invariant 11                                       | Contextual objects always use `REFERENCES`                 |
| Reading `LedgerEvent` records inside a posting job      | Tight coupling; correlation belongs to resolution workers    | Jobs write to staging only                                 |
| Emitting settlement candidates from a posting job       | Wrong lifecycle phase                                        | Settlement facts belong to dedicated resolution workers    |

---

_This document reflects the implementation patterns current as of the last worker refactoring.
Update it when a new pattern is introduced or when an existing pattern is superseded._
