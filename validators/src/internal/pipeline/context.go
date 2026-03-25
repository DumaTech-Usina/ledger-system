package pipeline

import (
	"time"

	"github.com/google/uuid"
)

// Context carries shared state through every stage of a pipeline.
// T is the domain-specific data type owned by a particular pipeline.
type Context[T any] struct {
	RunID     string
	StartedAt time.Time
	Data      T
	Meta      map[string]any
}

// NewContext returns an initialised Context with a fresh run ID and current time.
func NewContext[T any](data T) *Context[T] {
	return &Context[T]{
		RunID:     uuid.New().String(),
		StartedAt: time.Now(),
		Data:      data,
		Meta:      make(map[string]any),
	}
}
