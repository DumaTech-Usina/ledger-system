package jobs_test

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"validators/src/internal/application/jobs"
	"validators/src/internal/messaging/messages"
	"validators/src/tests/fixtures"
)

func TestProposalRunProducer_Trigger_PublishesToCorrectRoutingKey(t *testing.T) {
	pub := &fixtures.MockMessagePublisher{}
	producer := jobs.NewProposalRunProducer(pub)

	if err := producer.Trigger(context.Background()); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(pub.Published) != 1 {
		t.Fatalf("expected 1 published message, got %d", len(pub.Published))
	}
	if pub.Published[0].RoutingKey != "validation.proposals" {
		t.Errorf("expected routing key validation.proposals, got %q", pub.Published[0].RoutingKey)
	}
}

func TestProposalRunProducer_Trigger_IncludesNonEmptyRunID(t *testing.T) {
	pub := &fixtures.MockMessagePublisher{}
	producer := jobs.NewProposalRunProducer(pub)

	if err := producer.Trigger(context.Background()); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	var trigger messages.ProposalRunTrigger
	if err := json.Unmarshal(pub.Published[0].Body, &trigger); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}
	if trigger.RunID == "" {
		t.Error("expected non-empty run_id")
	}
	if trigger.TriggeredAt.IsZero() {
		t.Error("expected non-zero triggered_at")
	}
}

func TestProposalRunProducer_Trigger_GeneratesUniqueRunIDs(t *testing.T) {
	pub := &fixtures.MockMessagePublisher{}
	producer := jobs.NewProposalRunProducer(pub)

	_ = producer.Trigger(context.Background())
	_ = producer.Trigger(context.Background())

	if len(pub.Published) != 2 {
		t.Fatalf("expected 2 messages, got %d", len(pub.Published))
	}
	var t1, t2 messages.ProposalRunTrigger
	json.Unmarshal(pub.Published[0].Body, &t1)
	json.Unmarshal(pub.Published[1].Body, &t2)
	if t1.RunID == t2.RunID {
		t.Errorf("expected unique run IDs, got same: %q", t1.RunID)
	}
}

func TestProposalRunProducer_Trigger_PropagatesPublishError(t *testing.T) {
	boom := errors.New("broker unavailable")
	pub := &fixtures.MockMessagePublisher{Err: boom}
	producer := jobs.NewProposalRunProducer(pub)

	err := producer.Trigger(context.Background())
	if !errors.Is(err, boom) {
		t.Errorf("expected broker error to propagate, got: %v", err)
	}
}

func TestProposalRunProducer_StartPolling_StopsOnContextCancellation(t *testing.T) {
	pub := &fixtures.MockMessagePublisher{}
	producer := jobs.NewProposalRunProducer(pub)

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	err := producer.StartPolling(ctx, 10*time.Millisecond)
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Errorf("expected DeadlineExceeded, got: %v", err)
	}
	if len(pub.Published) == 0 {
		t.Error("expected at least one trigger published before cancellation")
	}
}

func TestProposalRunProducer_StartPolling_ContinuesDespitePublishErrors(t *testing.T) {
	pub := &fixtures.MockMessagePublisher{Err: errors.New("transient")}
	producer := jobs.NewProposalRunProducer(pub)

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Millisecond)
	defer cancel()

	_ = producer.StartPolling(ctx, 10*time.Millisecond)
	// even with errors, polling must have attempted more than one trigger
	if len(pub.Published) != 0 {
		t.Errorf("expected no successful publishes with persistent error, got %d", len(pub.Published))
	}
}
