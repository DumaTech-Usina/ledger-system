package pipeline

import (
	"context"
	"fmt"
	"sync"
)

// Registry holds named Runners. It mirrors the engine.Registry API so
// the two registries feel consistent across the codebase.
type Registry struct {
	mu      sync.RWMutex
	runners map[string]Runner
}

// NewRegistry creates an empty Registry.
func NewRegistry() *Registry {
	return &Registry{runners: make(map[string]Runner)}
}

// Register adds a runner under the given name.
// Returns an error if the name is already taken.
func (r *Registry) Register(name string, runner Runner) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, exists := r.runners[name]; exists {
		return fmt.Errorf("pipeline %q already registered", name)
	}
	r.runners[name] = runner
	return nil
}

// MustRegister is like Register but panics on duplicate names.
func (r *Registry) MustRegister(name string, runner Runner) {
	if err := r.Register(name, runner); err != nil {
		panic(err)
	}
}

// Run executes the named pipeline.
func (r *Registry) Run(ctx context.Context, name string) error {
	r.mu.RLock()
	runner, ok := r.runners[name]
	r.mu.RUnlock()
	if !ok {
		return fmt.Errorf("pipeline %q not found", name)
	}
	return runner.Run(ctx)
}

// Names returns all registered pipeline names.
func (r *Registry) Names() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	names := make([]string, 0, len(r.runners))
	for name := range r.runners {
		names = append(names, name)
	}
	return names
}
