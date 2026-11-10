# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

Monorepo with two independent services:

- **`ledger/`** — TypeScript/Node.js core ledger (Express + TypeORM + Vitest)
- **`validators/`** — Go audit/validation pipeline (Hexagonal Architecture)

---

## ledger/ — TypeScript service

### Commands

```bash
cd ledger
npm run dev              # Start development server, in memory and empty
npm run dev -- --filled-example   # Same, loaded with the example events
npm run build            # Compile TypeScript
npm test                 # Run all tests once (Vitest)
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report (85% lines/functions, 80% branches thresholds)
npm run db:migration:generate -- src/infra/database/migrations/<Name>
npm run db:migration:run
npm run db:migration:revert
```

Run a single test file:

```bash
npx vitest run src/tests/unit/domain/ledger-event.test.ts
```

### Architecture

Clean Architecture with strict layer boundaries:

```
Presentation  (src/presentation/web/api/)   HTTP routes + serializers
Application   (src/core/application/)        Use cases, services, repository interfaces
Domain        (src/core/domain/)             Pure entities, value objects, policies
Infrastructure (src/infra/)                  TypeORM (PostgreSQL), MongoDB, file audit
```

**Domain highlights:**

- `LedgerEvent` is the central entity — immutable, append-only. Each event carries an `EventHash` (SHA-256 chain), `EconomicEffect` (CASH_IN / CASH_OUT / CASH_INTERNAL / NON_CASH), debit/credit/neutral parties, and typed economic objects.
- `RelatedEventId` links settlement events back to their origin events.
- `EventContract` + `InvariantPolicy` enforce 10+ semantic invariants at creation time. `FormalMatrices` provide multi-dimensional validation (e.g., economic effect × object relation, reason × effect).
- `StagingRecord` holds pre-validated records before promotion to confirmed events. `RejectedEvent` records non-conforming inputs with rejection reasons.

**Persistence split:**

- PostgreSQL (TypeORM) — confirmed `LedgerEvent` records
- MongoDB — `RejectedEvent` and `StagingRecord` collections + audit logs

**Key application services:**

- `CreateLedgerEventUseCase`, `RejectLedgerEventUseCase`
- `PositionProjectionService`, `CashPositionService`, `CashStatementService`
- `StagingRecordValidator`, `DashboardService`, `BookHealthService`

**HTTP endpoints:** `/api/events`, `/api/positions`, `/api/cash-position`, `/api/cash-statement`, `/api/staging`, `/api/dashboard`

### Tests

- **Unit** (`src/tests/unit/`) — domain entities, policies, value objects, use cases
- **Integration** (`src/tests/integration/business-flows/`) — full business flows (loan, advance, commission, penalty, correction, operational) using real in-memory repos; also cash position, statement, position projection, and financial invariant tests
- Fixtures live in `src/tests/fixtures/` with builder helpers and mock repositories

---

## validators/ — Go service

### Commands

```bash
cd validators
docker-compose up -d          # MongoDB (port 27017) + Mongo Express UI
go run ./src/cmd/validator/   # Run the validator

go test ./src/tests/...                      # All tests
go test ./src/tests/unit/rules/...           # Rule unit tests only
go test ./src/tests/contract/...             # Rule contract/invariant tests
go test ./src/tests/integration/...          # Integration tests
```

### Architecture

Hexagonal Architecture — four-stage pipeline wired in `src/cmd/validator/main.go` via manual dependency injection.

**Pipeline stages** (executed sequentially):

1. **IngestionStage** — fetches all proposals from PostgreSQL
2. **EnrichmentStage** — computes similarity clusters (Levenshtein + blocking keys), fetches paid receipts, pre-computes statistics
3. **ValidationStage** — runs all registered rules against `ValidationContext`
4. **AggregationStage** — persists clusters and `RuleRunResult` records to MongoDB

**Validation rules** (pure functions, registered in a `RuleRegistry`):

- **Rule-001** — duplicate proposals via clustering (score ≥ 3 across 5 dimensions)
- **Rule-002** — duplicate payments (same installment paid in multiple proposals)
- **Rule-003** — false delinquents (installments paid out-of-order)
- **Rule-004** — invalid proposal numbers (null, empty, all-zeros)

**Clustering algorithm** (`src/internal/shared/clustering/`):

- Blocking key: `first2digits | last2digits` of proposal number
- Within each block: pairwise scoring on number similarity, value match, same client, same plan, same date
- Similarity: Levenshtein distance ≤ 1 OR substring containment OR length diff ≤ 1

**Key packages:**

- `src/internal/domain/` — `Proposal`, `Receipt`, `Cluster`, `RuleRunResult`
- `src/internal/application/` — `RunValidation` use case + repository port interfaces
- `src/internal/engine/` — `RuleRegistry` + sequential/parallel executor
- `src/internal/pipeline/` — generic pipeline framework (generic on stage data type)
- `src/internal/pipelines/proposals/` — domain-specific pipeline wiring
- `src/internal/rules/proposals/` — rule implementations
- `src/internal/infrastructure/` — PostgreSQL + MongoDB adapters

**Test helpers** (`src/tests/fixtures/`):

- `factories.go` — `NewProposal`, `NewReceipt`, `NewCluster` constructors
- `builders.go` — `ValidationContextBuilder` (fluent API)
- `mocks.go` — in-memory mock repositories

Rules must satisfy contract invariants (non-nil name/description, idempotence, context immutability) verified in `src/tests/contract/`.

Detailed architecture documentation is in `validators/README.md`; extension guide for adding new rules or pipeline domains is in `validators/framework_doc.md`.

---

## Workers — Engineering Protocol

**Before creating any worker in either service, start at `WORKER_PROTOCOL.md`.**

### Worker taxonomy

| Archetype                | Service     | Canonical output                                 |
| ------------------------ | ----------- | ------------------------------------------------ |
| **Domain Validator**     | validators/ | `aspirant_<domain>_canonical` (CLEAN/SUSPICIOUS) |
| **Cross-Domain Checker** | validators/ | extends existing canonical                       |
| **Enrichment Extender**  | validators/ | no new canonical                                 |
| **Posting Job**          | ledger/     | StagingRecord → LedgerEvent                      |
| **Context Job**          | ledger/     | lineage DTO only                                 |
| **Resolution Worker**    | ledger/     | StagingRecord for edge cases                     |

### Protocol gates (mandatory, in order)

1. Fill **Card A** (Operational Event Card) — determines archetype and service routing.
2. Fill **Card B** × N rules (Validators only) — one spec per rule, before any code.
3. Fill **Card C** (Ledger only) — five-matrix gate must pass before any code.
4. Cards are embedded as header comments in the implementation files they govern.

### Regression contract

Every new Validators rule requires: **unit test file + one contract test entry + integration test coverage.**
Every new Ledger job requires: **unit test file + at least one business-flow integration test.**

```bash
# Run before every commit that touches rules, jobs, or infrastructure:
cd validators && go test ./src/tests/...   # must be zero failures
cd ledger     && npm test                  # must meet coverage thresholds
```

Coverage thresholds are enforced and cannot be bypassed:

- ledger: 85% lines/functions, 80% branches
- validators: every rule must have a unit test file and a contract test entry

---

## Development Workflow & Project Continuity

How any agent works on Treasury (`treasury/`). Goal: keep development continuous across agents —
no rework, no inconsistent decisions, no implementation disconnected from the documentation, no
regressions.

**Treasury documentation:**

- `treasury/docs/requisitos_refinados.md` — the refined business requirements, built round by round
  with the product owner (IDs `REQ-`/`CA-`/`REJ-`/`DEC-`/`Q-`). Its §15 lists pending decisions
  (`DEC-`); its §16 states what is done and the next step. Business rules not in it are confirmed
  with the product owner, never inferred. **To resume the work, start at its §16.1**, which holds
  where we stopped, what must be decided next, and the working method.
- `treasury/README.md` and the other files in `treasury/docs/` — earlier records; read them, but
  where they diverge from `requisitos_refinados.md`, the latter prevails.

### Core principles

1. **Documentation is the primary reference, and it evolves.**
   - Always read the existing documentation before any work.
   - It represents the project's current knowledge and state, but it is not a complete or
     immutable source of truth — the system is still under development.
   - Investigate any divergence between documentation and implementation before deciding anything.
   - New requirements or architectural decisions may require the documentation to evolve.

2. **Continuity of development.**
   - Before starting, understand the current state of the project: what is implemented, what is
     documented, what is pending, and where development stopped.
   - Do not assume documented functionality is implemented.
   - Do not restart work already done or duplicate implementations.
   - Whenever possible, continue from the last known state, preserving existing decisions and
     patterns.

3. **Handling new requirements.**
   - Before implementing, assess the impact on architecture, existing functionality and
     documentation.
   - Identify conflicts with earlier decisions.
   - When needed, propose documentation adjustments before implementing.
   - Do not introduce unnecessary architectural changes or abstractions.

4. **Implementation and automated tests.**
   - Every new implementation or behavior change comes with adequate automated tests.
   - Tests validate the expected behavior and protect existing functionality against regressions.
   - Run the relevant tests and check their results before finishing (`cd treasury && npm test`).
   - Work is not done while required tests are missing or failing.
   - Never modify or delete tests just to make the suite pass without investigating the failure.

5. **Documentation maintenance.**
   - Documentation evolves with the system.
   - When an implementation changes documented behavior, contracts, business rules or
     architectural decisions, update the corresponding documents.
   - Do not update documents needlessly or duplicate information across files.

### Expected workflow

1. **Contextualize** — read this `CLAUDE.md`, find the relevant documentation, understand the
   current state of the project.
2. **Investigate** — compare documentation and implementation; identify pending items,
   constraints and inconsistencies.
3. **Plan** — define the smallest set of changes that meets the goal.
4. **Implement** — make the changes, preserving the existing architecture and patterns.
5. **Validate** — create or update automated tests and run the relevant ones.
6. **Document** — update the affected documentation.
7. **Conclude** — report what was done, the tests run, any limitations, and what remains pending.

---

## Ledger Philosophy & Non-Negotiable Principles

This section defines the architectural principles of the Ledger. These principles have
precedence over implementation convenience and should guide every design decision.

### The Ledger models the financial layer, not business reality

The Ledger exists to record financial facts and their immediate financial consequences.

It intentionally does **not** attempt to model the entire business process or operational
workflow. The Ledger stops at the first layer of financially relevant consequences.

Examples that **belong**:

- A payment received.
- A payment made.
- A tax obligation created by an external event.
- A commission expected because an external fact established that obligation.

Examples that do **not** belong:

- Operational delays.
- Internal negotiations.
- Human behavior.
- Business intentions.
- Indirect consequences that do not immediately affect financial positions.

This section is about **scope** (which layer of facts). It is distinct from the epistemic
stance below (we record *knowledge* of those facts, not ground truth).

---

### Facts over predictions

The Ledger never predicts future events. Every recorded event must be supported by an
external fact. An expectation is valid only when it is itself created by a factual external
event — these are financial *consequences of facts*, not predictions:

- Receiving a payment may create a commission expectation.
- Issuing an invoice may create a tax obligation.

**Never fabricate a fact to satisfy a constraint.** The Ledger never invents a fact to make
its own validation pass. If a real fact does not fit a rule, the rule is too strong — not the
fact invalid. We never synthesize a supporting event (e.g. a missing origin) just to make
another event conform.

---

### Knowledge over assumptions

The Ledger represents what is **known**. It never assumes information that has not been
observed. Unknown relationships are legitimate states of the model. **The absence of
information must never be interpreted as the absence of a fact.**

The Ledger is a representation of knowledge at a point in time, not a claim about objective
reality. Its knowledge may be incomplete, but its *record of that knowledge is complete*: at
any point it faithfully shows what was known and what was explicitly unknown.

---

### Derivations must not assume completeness

Positions, projections, reconciliations, and guards are computed from **known facts only**.
Missing information is **unknown** — never zero, default, or "nothing happened."

A receivable with no recorded expected is not a receivable of zero; it is one whose origin is
unknown. An aggregate must never infer a completeness the event stream does not assert.

---

### A fact's validity is independent of its lineage

The right to record an observed fact never depends on its lineage being known. **Never gate
the recording of a fact on the prior existence of a related event.** Lineage is a relationship
*between* facts, recorded when known — not a precondition for either fact to exist.

---

### Facts are immutable

Facts are never rewritten. As new information becomes available, the Ledger **enriches**
existing lineage instead of replacing or modifying historical facts. History must always
reflect what was known at the time each event was recorded.

Evolving state (open/resolved, linked/unlinked) is **derived by querying the immutable chain**
— never stored in a mutable flag that gets flipped.

---

### Lineage is progressive

Relationships may be discovered over time. Events may initially exist without complete
lineage. As new facts arrive, the Ledger links previously isolated events without altering
their historical meaning. Incomplete lineage is expected and should remain visible until
resolved. Treat **known**, **unknown**, and **later-discovered** as distinct states.

---

### Unknown is a valid state

Missing context is not an error. It exposes a gap in knowledge that should remain visible
until another external fact fills it. The Ledger makes those gaps **explicit** instead of
hiding or inferring them.

---

### Preserve information

When multiple interpretations are possible, prefer the one that preserves more factual
information. The Ledger should lose as little knowledge as possible.

---

### Simplicity over convenience

Do not introduce abstractions, constraints, or validations that exist only because the current
implementation is simpler. The domain model defines the implementation — not the other way
around.

---

## Mandatory Design Checklist

Before implementing any Ledger change, verify the following:

- Does this record an observable fact?
- If it represents an expectation, was that expectation created by an external fact?
- Am I recording knowledge or making assumptions?
- Am I fabricating any event solely to satisfy a validation rule?
- Am I gating a fact's recording on a relationship that may not yet be known?
- If I'm computing a position or aggregate, am I treating missing data as **unknown** rather
  than zero/default?
- Am I deriving evolving state from the immutable chain rather than mutating a stored status?
- Does this preserve auditability?
- Does this preserve immutable history?
- Can missing lineage be added later without rewriting history?
- Am I introducing an implementation constraint that does not exist in the business domain?
- Am I modeling beyond the first layer of financially relevant consequences?
- Does this change preserve as much factual information as possible?

If any answer is "No", stop and revisit the design before writing code.

---

## Conflict Resolution

If a future request, implementation idea, or even an instruction from the project owner
conflicts with these principles:

1. Do **not** implement it immediately.
2. Explain which principle would be violated.
3. Propose the smallest conceptual change that preserves the Ledger philosophy.
4. Wait for explicit confirmation before violating any of these principles.

These principles are the Ledger's constitution and should only change through explicit
architectural discussion — not through implementation convenience.
