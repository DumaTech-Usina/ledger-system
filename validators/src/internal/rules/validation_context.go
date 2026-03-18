package rules

import "validators/src/internal/domain"

// ValidationContext carries all pre-fetched data that rules need.
// It is populated by the pipeline stages before rules execute.
// Rules must treat it as read-only.
type ValidationContext struct {
	// Proposals holds every proposal loaded during ingestion.
	Proposals []domain.Proposal

	// Clusters holds groups of proposals identified as potential duplicates.
	Clusters []domain.Cluster

	// Receipts maps each cluster ID to the paid receipts for its proposals.
	Receipts map[string][]domain.Receipt

	// ProposalStats holds aggregate counts fetched during enrichment.
	ProposalStats ProposalStats

	// Metadata is an open map for extensibility between stages.
	Metadata map[string]any
}

// ProposalStats holds pre-computed data fetched during enrichment.
// Aggregate counts are used for reporting; ID slices let rules flag
// individual proposals so every proposal is assessed by every rule.
type ProposalStats struct {
	TotalProposals       int
	TotalPaidProposals   int

	// Per-proposal IDs for Rule004: proposals with null, empty, or zero-filled numbers.
	InvalidNumberCount   int
	InvalidNumberIDs     []string

	// Per-proposal IDs for Rule003: proposals with open installments whose
	// later installments are already paid (false delinquents).
	FalseDelinquentCount int
	FalseDelinquentIDs   []string
}

// NewValidationContext returns an initialised ValidationContext.
func NewValidationContext() *ValidationContext {
	return &ValidationContext{
		Receipts: make(map[string][]domain.Receipt),
		Metadata: make(map[string]any),
	}
}
