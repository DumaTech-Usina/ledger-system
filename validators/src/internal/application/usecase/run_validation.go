package usecase

import (
	"context"

	"validators/src/internal/pipeline"
)

// RunValidation is the single application use-case: execute the full
// validation pipeline. Callers that need typed results (e.g. rule summaries)
// should hold a reference to the concrete Runner implementation.
type RunValidation struct {
	runner pipeline.Runner
}

func NewRunValidation(runner pipeline.Runner) *RunValidation {
	return &RunValidation{runner: runner}
}

func (uc *RunValidation) Execute(ctx context.Context) error {
	return uc.runner.Run(ctx)
}
