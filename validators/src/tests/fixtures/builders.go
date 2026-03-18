package fixtures

import (
	"validators/src/internal/domain"
	"validators/src/internal/rules"
)

// ValidationContextBuilder provides a fluent API for constructing test
// ValidationContexts without repetitive initialisation boilerplate.
type ValidationContextBuilder struct {
	ctx *rules.ValidationContext
}

func NewValidationContextBuilder() *ValidationContextBuilder {
	return &ValidationContextBuilder{ctx: rules.NewValidationContext()}
}

func (b *ValidationContextBuilder) WithProposals(proposals ...domain.Proposal) *ValidationContextBuilder {
	b.ctx.Proposals = proposals
	return b
}

func (b *ValidationContextBuilder) WithClusters(clusters ...domain.Cluster) *ValidationContextBuilder {
	b.ctx.Clusters = clusters
	return b
}

// WithReceipts associates a slice of receipts with a specific cluster ID.
func (b *ValidationContextBuilder) WithReceipts(clusterID string, receipts ...domain.Receipt) *ValidationContextBuilder {
	b.ctx.Receipts[clusterID] = receipts
	return b
}

func (b *ValidationContextBuilder) WithStats(stats rules.ProposalStats) *ValidationContextBuilder {
	b.ctx.ProposalStats = stats
	return b
}

func (b *ValidationContextBuilder) WithMetadata(key string, value any) *ValidationContextBuilder {
	b.ctx.Metadata[key] = value
	return b
}

func (b *ValidationContextBuilder) Build() *rules.ValidationContext {
	return b.ctx
}
