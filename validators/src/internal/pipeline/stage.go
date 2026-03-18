package pipeline

import "context"

// Stage is a single step in the validation pipeline.
// Stages are composed sequentially; each receives the shared PipelineContext
// and either enriches it or produces output.
type Stage interface {
	Name() string
	Process(ctx context.Context, pctx *PipelineContext) error
}
