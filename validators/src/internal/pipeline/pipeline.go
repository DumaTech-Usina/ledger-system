package pipeline

import (
	"context"
	"fmt"
)

// Pipeline executes a fixed sequence of stages, passing the PipelineContext
// through each one. Execution stops immediately if any stage returns an error.
type Pipeline struct {
	stages []Stage
}

func New(stages ...Stage) *Pipeline {
	return &Pipeline{stages: stages}
}

func (p *Pipeline) Run(ctx context.Context, pctx *PipelineContext) error {
	for _, stage := range p.stages {
		if err := stage.Process(ctx, pctx); err != nil {
			return fmt.Errorf("stage %q: %w", stage.Name(), err)
		}
	}
	return nil
}
