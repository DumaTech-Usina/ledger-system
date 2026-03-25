package pipeline

import "context"

// Runner is a fully configured, self-contained pipeline execution unit.
// It knows its own initial state and can be invoked without any arguments
// beyond a context. This is the type stored in the Registry.
type Runner interface {
	Run(ctx context.Context) error
}
