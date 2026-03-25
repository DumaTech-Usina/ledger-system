package proposals

import (
	"context"

	"validators/src/internal/application/ports"
	"validators/src/internal/engine"
	"validators/src/internal/pipeline"
	"validators/src/internal/rules"
)

// Deps holds all external dependencies required by the proposal pipeline.
type Deps struct {
	ProposalRepo ports.ProposalRepository
	ReceiptRepo  ports.ReceiptRepository
	AuditRepo    ports.AuditRepository
	Engine       *engine.ValidationEngine
}

// Runner is a fully configured proposal pipeline.
// It implements pipeline.Runner and also exposes Results() so callers can
// inspect per-rule outcomes after execution.
type Runner struct {
	p    *pipeline.Pipeline[*Data]
	pctx *pipeline.Context[*Data]
}

// Run executes the proposal pipeline end-to-end.
func (r *Runner) Run(ctx context.Context) error {
	r.pctx = pipeline.NewContext(&Data{
		ValidationCtx: rules.NewValidationContext(),
	})
	return r.p.Run(ctx, r.pctx)
}

// Results returns the rule results produced during the last Run.
// Returns nil if Run has not been called yet.
func (r *Runner) Results() []rules.RuleResult {
	if r.pctx == nil {
		return nil
	}
	return r.pctx.Data.Results
}

// Build constructs a proposal Runner wired with the provided dependencies.
func Build(deps Deps) *Runner {
	p := pipeline.New[*Data](
		NewIngestionStage(deps.ProposalRepo),
		NewEnrichmentStage(deps.ProposalRepo, deps.ReceiptRepo),
		NewValidationStage(deps.Engine),
		NewAggregationStage(deps.AuditRepo),
	)
	return &Runner{p: p}
}
