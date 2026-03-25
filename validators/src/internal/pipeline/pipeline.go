package pipeline

import (
	"context"
	"fmt"
)

// Pipeline executes a fixed sequence of stages over a shared Context.
// Execution stops immediately if any stage returns an error.
type Pipeline[T any] struct {
	stages []Stage[T]
}

// New creates a Pipeline with the given stages.
func New[T any](stages ...Stage[T]) *Pipeline[T] {
	return &Pipeline[T]{stages: stages}
}

// Run executes all stages sequentially, passing pctx through each one.
func (p *Pipeline[T]) Run(ctx context.Context, pctx *Context[T]) error {
	for _, s := range p.stages {
		if err := s.Execute(ctx, pctx); err != nil {
			return fmt.Errorf("stage %q: %w", s.Name(), err)
		}
	}
	return nil
}
