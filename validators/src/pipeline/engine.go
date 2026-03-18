package pipeline

import (
	"validators/src/domain"
	"validators/src/rules"
)

type Engine struct {
    Rules []rules.Rule
}

func (e *Engine) Run(p domain.Proposal) ([]domain.ValidationResult, float64) {
    ctx := &domain.ValidationContext{}
    results := []domain.ValidationResult{}

    for _, rule := range e.Rules {
        result := rule.Evaluate(p, ctx)
        results = append(results, result)
    }

    finalScore := Aggregate(results)

    return results, finalScore
}