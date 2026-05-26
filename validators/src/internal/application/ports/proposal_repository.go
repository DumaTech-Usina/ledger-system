package ports

import (
	"context"

	"validators/src/internal/domain"
)

type ProposalRepository interface {
	FetchAll(ctx context.Context) ([]domain.Proposal, error)
	CountTotal(ctx context.Context) (int, error)
	CountInvalidNumbers(ctx context.Context) (int, error)
	// FetchInvalidNumberProposalIDs returns IDs of proposals whose number is
	// null, blank, or composed entirely of zeros.
	FetchInvalidNumberProposalIDs(ctx context.Context) ([]string, error)

	// FetchDistinctBlockingKeys returns every distinct blocking key present in
	// the proposals table. The blocking key is first2|last2 digits of the
	// normalized proposal number — the same algorithm used by the clustering package.
	// Used by ProposalBatchProducer to enumerate batches without loading full rows.
	FetchDistinctBlockingKeys(ctx context.Context) ([]string, error)

	// FetchByBlockingKey returns all proposals whose normalized proposal number
	// maps to the given blocking key. Safe to call concurrently for different keys.
	FetchByBlockingKey(ctx context.Context, key string) ([]domain.Proposal, error)
}
