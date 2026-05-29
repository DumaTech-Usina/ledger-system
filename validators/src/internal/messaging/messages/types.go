package messages

import "time"

// ProposalRunTrigger is published by the proposal producer and consumed by the
// proposal validation worker. The RunID is the idempotency key: re-delivering
// the same trigger produces the same canonical_proposals upserts, no duplicates.
type ProposalRunTrigger struct {
	RunID       string    `json:"run_id"`
	TriggeredAt time.Time `json:"triggered_at"`
}

// ReceiptCanonicalBatch is published by the receipt producer and consumed by the
// receipt canonical worker. BatchID is a SHA-256 of the sorted proposal IDs —
// deterministic, so the same batch delivered twice is safe to process twice
// because all writes are upserts keyed on receipt_id.
type ReceiptCanonicalBatch struct {
	BatchID     string   `json:"batch_id"`
	Anchor      string   `json:"anchor"`
	ProposalIDs []string `json:"proposal_ids"`
}

// ProposalBlockBatch is published by the proposal-batch-producer and consumed by the
// proposal-batch-consumer. One message is published per distinct blocking key so
// consumers load only the proposals for that block, avoiding a full table scan.
//
// RunID is shared across all batches in a single scan cycle so all canonical records
// written from the same run can be queried together.
// BatchID is SHA-256(blocking_key) — deterministic, safe to replay.
type ProposalBlockBatch struct {
	RunID       string `json:"run_id"`
	BatchID     string `json:"batch_id"`
	BlockingKey string `json:"blocking_key"`
}

// AdvanceBatch is published by the advance-batch-producer and consumed by the
// advance-batch-consumer. One message is published per page of advance report IDs
// fetched via cursor pagination (tenant_id = 1 in lab mode).
//
// RunID is shared across all batches in a single scan cycle so rule-run audit
// records from the same run can be correlated.
// BatchID is SHA-256(sorted advance_report_ids) — deterministic, safe to replay
// because all writes to aspirant_advance_canonical are upserts keyed on advance_report_id.
type AdvanceBatch struct {
	RunID            string   `json:"run_id"`
	BatchID          string   `json:"batch_id"`
	Anchor           string   `json:"anchor"`
	AdvanceReportIDs []string `json:"advance_report_ids"`
}
