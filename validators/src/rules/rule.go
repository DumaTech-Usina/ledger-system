package rules

import (
	"context"
	"validators/src/domain"
)

type Rule interface {
	RuleID() string
	RuleVersion() string
	BatchSize() int
	Description() string
	Execute(ctx context.Context, input []domain.Proposal) error
}
