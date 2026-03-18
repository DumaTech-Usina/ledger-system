package engine

import (
	"context"
	"sync"

	"validators/src/internal/rules"
)

// ExecutionMode controls whether rules run sequentially or in parallel.
type ExecutionMode int

const (
	Sequential ExecutionMode = iota
	Parallel
)

// ValidationEngine executes all registered rules against a ValidationContext
// and collects their results.
type ValidationEngine struct {
	registry *Registry
	mode     ExecutionMode
}

func NewValidationEngine(registry *Registry, mode ExecutionMode) *ValidationEngine {
	return &ValidationEngine{registry: registry, mode: mode}
}

// Run executes every registered rule and returns the full result set.
func (e *ValidationEngine) Run(_ context.Context, vctx *rules.ValidationContext) []rules.RuleResult {
	ruleList := e.registry.Rules()
	if e.mode == Parallel {
		return e.runParallel(vctx, ruleList)
	}
	return e.runSequential(vctx, ruleList)
}

func (e *ValidationEngine) runSequential(vctx *rules.ValidationContext, ruleList []rules.Rule) []rules.RuleResult {
	results := make([]rules.RuleResult, 0, len(ruleList))
	for _, rule := range ruleList {
		results = append(results, rule.Execute(vctx))
	}
	return results
}

func (e *ValidationEngine) runParallel(vctx *rules.ValidationContext, ruleList []rules.Rule) []rules.RuleResult {
	results := make([]rules.RuleResult, len(ruleList))
	var wg sync.WaitGroup
	for i, rule := range ruleList {
		wg.Add(1)
		go func(idx int, r rules.Rule) {
			defer wg.Done()
			results[idx] = r.Execute(vctx)
		}(i, rule)
	}
	wg.Wait()
	return results
}
