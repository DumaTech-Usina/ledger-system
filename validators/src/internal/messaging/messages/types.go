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
