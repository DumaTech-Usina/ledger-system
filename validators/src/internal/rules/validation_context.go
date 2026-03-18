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

// ProposalStats holds pre-computed aggregate statistics used by rules
// that only need counts rather than per-row data.
type ProposalStats struct {
	TotalProposals       int
	InvalidNumberCount   int
	TotalPaidProposals   int
	FalseDelinquentCount int
}

// NewValidationContext returns an initialised ValidationContext.
func NewValidationContext() *ValidationContext {
	return &ValidationContext{
		Receipts: make(map[string][]domain.Receipt),
		Metadata: make(map[string]any),
	}
}
