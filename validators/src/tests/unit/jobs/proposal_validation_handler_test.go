package jobs_test

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"validators/src/internal/application/jobs"
	"validators/src/internal/messaging/messages"
)

func TestProposalValidationHandler_Handle_ValidTrigger_RunsPipeline(t *testing.T) {
	mock := &mockPipelineRunner{}
	handler := jobs.NewProposalValidationHandler(mock)

	trigger := messages.ProposalRunTrigger{RunID: "run-1", TriggeredAt: time.Now()}
	body, _ := json.Marshal(trigger)

	if err := handler.Handle(context.Background(), body); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if mock.runCount != 1 {
		t.Errorf("expected pipeline to run once, ran %d time(s)", mock.runCount)
	}
}

func TestProposalValidationHandler_Handle_InvalidJSON_ReturnsError(t *testing.T) {
	handler := jobs.NewProposalValidationHandler(&mockPipelineRunner{})

	err := handler.Handle(context.Background(), []byte(`not-json`))
	if err == nil {
		t.Fatal("expected error for invalid JSON payload")
	}
}

func TestProposalValidationHandler_Handle_PipelineError_Propagates(t *testing.T) {
	boom := errors.New("pipeline failure")
	mock := &mockPipelineRunner{err: boom}
	handler := jobs.NewProposalValidationHandler(mock)

	trigger := messages.ProposalRunTrigger{RunID: "run-err", TriggeredAt: time.Now()}
	body, _ := json.Marshal(trigger)

	err := handler.Handle(context.Background(), body)
	if !errors.Is(err, boom) {
		t.Errorf("expected pipeline error to propagate, got: %v", err)
	}
}
