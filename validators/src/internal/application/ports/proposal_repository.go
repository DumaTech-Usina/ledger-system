package ports

import (
	"context"

	"validators/src/internal/domain"
)

type ProposalRepository interface {
	FetchAll(ctx context.Context) ([]domain.Proposal, error)
	CountTotal(ctx context.Context) (int, error)
	CountInvalidNumbers(ctx context.Context) (int, error)
}
