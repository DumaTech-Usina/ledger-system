package usecase

import (
	"context"

	"validators/src/internal/pipeline"
	"validators/src/internal/rules"
)

// RunValidation is the single application use-case: execute the full
// validation pipeline and return per-rule results.
type RunValidation struct {
	pipeline *pipeline.Pipeline
}

func NewRunValidation(p *pipeline.Pipeline) *RunValidation {
	return &RunValidation{pipeline: p}
}

func (uc *RunValidation) Execute(ctx context.Context) ([]rules.RuleResult, error) {
	pctx := pipeline.NewPipelineContext()
	if err := uc.pipeline.Run(ctx, pctx); err != nil {
		return nil, err
	}
	return pctx.Results, nil
}
