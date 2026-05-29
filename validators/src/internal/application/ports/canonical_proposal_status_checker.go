package ports

import "context"

// CanonicalProposalStatusChecker queries the canonical_proposals collection for
// proposal-level validation status. Used by the advance enrichment stage to
// identify proposals flagged as SUSPICIOUS before running RULE-ADV-002.
type CanonicalProposalStatusChecker interface {
	// FetchSuspiciousByProposalIDs returns the subset of proposalIDs that are
	// marked SUSPICIOUS in canonical_proposals. Returns an empty slice (not nil)
	// when none are found.
	FetchSuspiciousByProposalIDs(ctx context.Context, proposalIDs []string) ([]string, error)
}
