package pipeline

import "context"

// Stage is a single processing step in a pipeline.
// Each stage receives the shared Context, may mutate Data, and either
// succeeds or returns an error that halts execution.
type Stage[T any] interface {
	Name() string
	Execute(ctx context.Context, pctx *Context[T]) error
}
