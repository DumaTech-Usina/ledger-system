package stages

import (
	"context"

	"validators/src/internal/engine"
	"validators/src/internal/pipeline"
)

// ValidationStage delegates rule execution to the ValidationEngine and stores
// the results in the PipelineContext. It contains no business logic.
type ValidationStage struct {
	engine *engine.ValidationEngine
}

func NewValidationStage(eng *engine.ValidationEngine) *ValidationStage {
	return &ValidationStage{engine: eng}
}

func (s *ValidationStage) Name() string { return "ValidationStage" }

func (s *ValidationStage) Process(ctx context.Context, pctx *pipeline.PipelineContext) error {
	pctx.Results = s.engine.Run(ctx, pctx.ValidationCtx)
	return nil
}
