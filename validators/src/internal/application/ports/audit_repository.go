package ports

import (
	"context"

	"validators/src/internal/domain"
)

type AuditRepository interface {
	SaveClusters(ctx context.Context, clusters []domain.Cluster) error
	SaveRuleRun(ctx context.Context, result domain.RuleRunResult) error
	// SaveCanonicalProposals upserts the per-proposal verdict for a run.
	// This is the collection downstream systems (e.g. Ledger) consume.
	SaveCanonicalProposals(ctx context.Context, proposals []domain.CanonicalProposal) error
}
