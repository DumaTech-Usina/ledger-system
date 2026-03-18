package engine

import (
	"fmt"
	"sync"

	"validators/src/internal/rules"
)

// Registry stores validation rules in registration order.
// It is safe for concurrent reads after all registrations are complete.
type Registry struct {
	mu    sync.RWMutex
	rules []rules.Rule
	names map[string]struct{}
}

func NewRegistry() *Registry {
	return &Registry{names: make(map[string]struct{})}
}

// Register adds a rule. Returns an error if the name is already taken.
func (r *Registry) Register(rule rules.Rule) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.names[rule.Name()]; exists {
		return fmt.Errorf("rule %q already registered", rule.Name())
	}
	r.rules = append(r.rules, rule)
	r.names[rule.Name()] = struct{}{}
	return nil
}

// MustRegister is like Register but panics on duplicate name.
func (r *Registry) MustRegister(rule rules.Rule) {
	if err := r.Register(rule); err != nil {
		panic(err)
	}
}

// Rules returns a snapshot of registered rules in insertion order.
func (r *Registry) Rules() []rules.Rule {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]rules.Rule, len(r.rules))
	copy(out, r.rules)
	return out
}
