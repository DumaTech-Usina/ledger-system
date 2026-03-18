package pipeline

import (
	"time"

	"github.com/google/uuid"

	"validators/src/internal/rules"
)

// PipelineContext carries shared state through every stage of the pipeline.
type PipelineContext struct {
	RunID         string
	StartedAt     time.Time
	ValidationCtx *rules.ValidationContext
	Results       []rules.RuleResult
}

// NewPipelineContext returns an initialised PipelineContext with a fresh run ID.
func NewPipelineContext() *PipelineContext {
	return &PipelineContext{
		RunID:         uuid.New().String(),
		StartedAt:     time.Now(),
		ValidationCtx: rules.NewValidationContext(),
	}
}
