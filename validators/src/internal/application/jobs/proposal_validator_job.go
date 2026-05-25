package jobs

import (
	"context"
	"log"
	"time"

	"validators/src/internal/rules"
)

// PipelineRunner abstracts any runnable pipeline that produces rule results.
// Both proposals.Runner and receipts.Runner satisfy this interface.
type PipelineRunner interface {
	Run(ctx context.Context) error
	Results() []rules.RuleResult
}

// ProposalValidatorJob wraps a PipelineRunner with polling support.
// The runner itself owns the stage wiring; the job owns the run lifecycle.
type ProposalValidatorJob struct {
	runner PipelineRunner
}

func NewProposalValidatorJob(runner PipelineRunner) *ProposalValidatorJob {
	return &ProposalValidatorJob{runner: runner}
}

// Run executes the pipeline once and returns its rule results.
func (j *ProposalValidatorJob) Run(ctx context.Context) ([]rules.RuleResult, error) {
	if err := j.runner.Run(ctx); err != nil {
		return nil, err
	}
	return j.runner.Results(), nil
}

// StartPolling runs the pipeline repeatedly at the given interval until ctx is cancelled.
// Individual run errors are logged but do not stop the loop.
func (j *ProposalValidatorJob) StartPolling(ctx context.Context, interval time.Duration) error {
	for {
		if _, err := j.Run(ctx); err != nil {
			log.Printf("[ProposalValidatorJob] run error: %v", err)
		}
		select {
		case <-time.After(interval):
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}
