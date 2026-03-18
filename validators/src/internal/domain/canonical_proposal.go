package domain

import "time"

// ProposalStatus is the verdict assigned to a proposal after all rules run.
type ProposalStatus string

const (
	// ProposalStatusClean means no rule flagged this proposal individually.
	// It is safe to be consumed by downstream systems such as the Ledger.
	ProposalStatusClean ProposalStatus = "CLEAN"

	// ProposalStatusSuspicious means at least one rule flagged this proposal.
	// It must be reviewed before being consumed by downstream systems.
	ProposalStatusSuspicious ProposalStatus = "SUSPICIOUS"
)

// Violation records a single rule's finding against a specific proposal.
type Violation struct {
	Rule   string // e.g. "RULE-001"
	Reason string // human-readable explanation
}

// CanonicalProposal is the authoritative read-model for a proposal's
// validation status. It is written to the `canonical_proposals` MongoDB
// collection at the end of every pipeline run, giving downstream systems
// (e.g. the Ledger) a single, queryable source of truth.
type CanonicalProposal struct {
	RunID         string         // links back to the pipeline execution
	ProposalID    string         // original ID from PostgreSQL
	Number        string
	Value         float64
	ClientID      string
	PlanID        string
	EffectiveDate string
	Status        ProposalStatus // CLEAN or SUSPICIOUS
	Violations    []Violation    // one entry per rule that flagged this proposal
	CreatedAt     time.Time
}
