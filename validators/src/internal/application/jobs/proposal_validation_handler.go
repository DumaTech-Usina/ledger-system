package jobs

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"validators/src/internal/messaging/messages"
)

// ProposalValidationHandler implements ports.MessageHandler for ProposalRunTrigger
// messages. It runs the full proposal validation pipeline — FetchAll, cluster,
// validate, aggregate — which requires the complete proposals dataset so that
// cross-proposal clustering (Rules 001 & 002) misses nothing.
type ProposalValidationHandler struct {
	runner PipelineRunner
}

func NewProposalValidationHandler(runner PipelineRunner) *ProposalValidationHandler {
	return &ProposalValidationHandler{runner: runner}
}

// Handle deserializes the trigger, runs the pipeline, and logs a summary.
// A non-nil error causes the worker to nack the message to the DLQ.
func (h *ProposalValidationHandler) Handle(ctx context.Context, body []byte) error {
	var trigger messages.ProposalRunTrigger
	if err := json.Unmarshal(body, &trigger); err != nil {
		return fmt.Errorf("invalid trigger payload: %w", err)
	}
	results, err := NewProposalValidatorJob(h.runner).Run(ctx)
	if err != nil {
		return fmt.Errorf("run_id=%s pipeline failed: %w", trigger.RunID, err)
	}
	log.Printf("[ProposalValidationHandler] run_id=%s completed: %d rules evaluated", trigger.RunID, len(results))
	return nil
}
