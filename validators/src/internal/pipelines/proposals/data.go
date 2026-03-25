package proposals

import "validators/src/internal/rules"

// Data is the shared state that flows through every stage of the proposal pipeline.
type Data struct {
	ValidationCtx *rules.ValidationContext
	Results       []rules.RuleResult
}
