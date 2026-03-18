package ports

import (
	"context"

	"validators/src/internal/domain"
)

type ReceiptRepository interface {
	FetchPaidByProposalIDs(ctx context.Context, proposalIDs []string) ([]domain.Receipt, error)
	CountDistinctPaidProposals(ctx context.Context) (int, error)
	CountFalseDelinquents(ctx context.Context) (int, error)
}
