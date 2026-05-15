package receipts

import (
	"context"

	"validators/src/internal/application/ports"
	"validators/src/internal/engine"
	"validators/src/internal/pipeline"
	"validators/src/internal/rules"
)

// Deps holds all external dependencies for the receipts pipeline.
type Deps struct {
	ProposalReader ports.CanonicalProposalReader
	ReceiptRepo    ports.ReceiptRepository
	CanonicalRepo  ports.AspiantReceiptCanonicalRepository
	Engine         *engine.ValidationEngine
}

// Runner is a fully configured receipts pipeline.
type Runner struct {
	p    *pipeline.Pipeline[*Data]
	pctx *pipeline.Context[*Data]
}

func (r *Runner) Run(ctx context.Context) error {
	r.pctx = pipeline.NewContext(&Data{
		ValidationCtx: rules.NewValidationContext(),
	})
	return r.p.Run(ctx, r.pctx)
}

func (r *Runner) Results() []rules.RuleResult {
	if r.pctx == nil {
		return nil
	}
	return r.pctx.Data.Results
}

// Build constructs a receipts Runner wired with the provided dependencies.
func Build(deps Deps) *Runner {
	p := pipeline.New[*Data](
		NewIngestionStage(deps.ProposalReader),
		NewEnrichmentStage(deps.ReceiptRepo),
		NewValidationStage(deps.Engine),
		NewAggregationStage(deps.CanonicalRepo),
	)
	return &Runner{p: p}
}
