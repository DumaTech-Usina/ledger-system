package ports

import (
	"context"

	"validators/src/internal/domain"
)

// CanonicalProposalReader reads proposals from the canonical_proposals
// MongoDB collection that have passed all validation rules (status = CLEAN).
type CanonicalProposalReader interface {
	FetchClean(ctx context.Context) ([]domain.CanonicalProposal, error)

	// CountClean returns the total number of CLEAN proposals.
	// Used by batch workers to initialise the progress bar.
	CountClean(ctx context.Context) (int, error)

	// FetchCleanBatch returns at most limit CLEAN proposals whose proposal_id
	// is strictly greater than afterID, sorted by proposal_id ascending.
	// Pass an empty afterID to start from the beginning.
	FetchCleanBatch(ctx context.Context, afterID string, limit int) ([]domain.CanonicalProposal, error)
}
