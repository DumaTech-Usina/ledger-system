package ports

import (
	"context"

	"validators/src/internal/domain"
)

type AuditRepository interface {
	SaveClusters(ctx context.Context, clusters []domain.Cluster) error
	SaveRuleRun(ctx context.Context, result domain.RuleRunResult) error
}
