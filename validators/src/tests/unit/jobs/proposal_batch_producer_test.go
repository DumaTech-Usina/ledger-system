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

func newBatchProducer(
	pRepo *fixtures.MockProposalRepository,
	pub *fixtures.MockMessagePublisher,
) *jobs.ProposalBatchProducer {
	return jobs.NewProposalBatchProducer(pRepo, pub)
}

func TestProposalBatchProducer_Run_EmptyBlockingKeys_NoMessagesPublished(t *testing.T) {
	pub := &fixtures.MockMessagePublisher{}
	producer := newBatchProducer(&fixtures.MockProposalRepository{}, pub)

	total, err := producer.Run(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if total != 0 {
		t.Errorf("expected 0 keys dispatched, got %d", total)
	}
	if len(pub.Published) != 0 {
		t.Errorf("expected no messages published, got %d", len(pub.Published))
	}
}

func TestProposalBatchProducer_Run_PublishesOneMessagePerBlockingKey(t *testing.T) {
	keys := []string{"12|56", "34|78", "90|12"}
	pub := &fixtures.MockMessagePublisher{}
	producer := newBatchProducer(
		&fixtures.MockProposalRepository{BlockingKeys: keys},
		pub,
	)

	total, err := producer.Run(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if total != len(keys) {
		t.Errorf("expected %d keys dispatched, got %d", len(keys), total)
	}
	if len(pub.Published) != len(keys) {
		t.Fatalf("expected %d published messages, got %d", len(keys), len(pub.Published))
	}
	for _, msg := range pub.Published {
		if msg.RoutingKey != "validation.proposals.batch" {
			t.Errorf("expected routing key validation.proposals.batch, got %q", msg.RoutingKey)
		}
	}
}

func TestProposalBatchProducer_Run_BatchIDIsDeterministic(t *testing.T) {
	keys := []string{"12|56"}

	run := func() messages.ProposalBlockBatch {
		pub := &fixtures.MockMessagePublisher{}
		jobs.NewProposalBatchProducer(
			&fixtures.MockProposalRepository{BlockingKeys: keys},
			pub,
		).Run(context.Background())
		var msg messages.ProposalBlockBatch
		json.Unmarshal(pub.Published[0].Body, &msg)
		return msg
	}

	first := run()
	second := run()

	if first.BatchID != second.BatchID {
		t.Errorf("batch_id must be deterministic: got %q and %q", first.BatchID, second.BatchID)
	}
}

func TestProposalBatchProducer_Run_BatchIDDiffersForDifferentKeys(t *testing.T) {
	pub1, pub2 := &fixtures.MockMessagePublisher{}, &fixtures.MockMessagePublisher{}

	jobs.NewProposalBatchProducer(&fixtures.MockProposalRepository{BlockingKeys: []string{"12|56"}}, pub1).Run(context.Background())
	jobs.NewProposalBatchProducer(&fixtures.MockProposalRepository{BlockingKeys: []string{"34|78"}}, pub2).Run(context.Background())

	var b1, b2 messages.ProposalBlockBatch
	json.Unmarshal(pub1.Published[0].Body, &b1)
	json.Unmarshal(pub2.Published[0].Body, &b2)

	if b1.BatchID == b2.BatchID {
		t.Errorf("different keys must produce different batch_ids, got same: %q", b1.BatchID)
	}
}

func TestProposalBatchProducer_Run_AllMessagesShareRunID(t *testing.T) {
	keys := []string{"12|56", "34|78", "90|12"}
	pub := &fixtures.MockMessagePublisher{}
	jobs.NewProposalBatchProducer(
		&fixtures.MockProposalRepository{BlockingKeys: keys},
		pub,
	).Run(context.Background())

	if len(pub.Published) != 3 {
		t.Fatalf("expected 3 messages, got %d", len(pub.Published))
	}

	var msgs []messages.ProposalBlockBatch
	for _, m := range pub.Published {
		var msg messages.ProposalBlockBatch
		json.Unmarshal(m.Body, &msg)
		msgs = append(msgs, msg)
	}

	runID := msgs[0].RunID
	if runID == "" {
		t.Fatal("expected non-empty run_id")
	}
	for i, msg := range msgs[1:] {
		if msg.RunID != runID {
			t.Errorf("message %d has different run_id: got %q, want %q", i+1, msg.RunID, runID)
		}
	}
}

func TestProposalBatchProducer_Run_UniqueRunIDPerRun(t *testing.T) {
	keys := []string{"12|56"}
	pub := &fixtures.MockMessagePublisher{}
	producer := jobs.NewProposalBatchProducer(
		&fixtures.MockProposalRepository{BlockingKeys: keys},
		pub,
	)

	producer.Run(context.Background())
	producer.Run(context.Background())

	if len(pub.Published) != 2 {
		t.Fatalf("expected 2 messages across 2 runs, got %d", len(pub.Published))
	}
	var m1, m2 messages.ProposalBlockBatch
	json.Unmarshal(pub.Published[0].Body, &m1)
	json.Unmarshal(pub.Published[1].Body, &m2)
	if m1.RunID == m2.RunID {
		t.Errorf("different runs must produce different run_ids, got same: %q", m1.RunID)
	}
}

func TestProposalBatchProducer_Run_PropagatesFetchKeysError(t *testing.T) {
	boom := errors.New("postgres unavailable")
	producer := newBatchProducer(
		&fixtures.MockProposalRepository{Err: boom},
		&fixtures.MockMessagePublisher{},
	)

	_, err := producer.Run(context.Background())
	if !errors.Is(err, boom) {
		t.Errorf("expected fetch error to propagate, got: %v", err)
	}
}

func TestProposalBatchProducer_Run_PropagatesPublishError(t *testing.T) {
	boom := errors.New("broker unavailable")
	producer := newBatchProducer(
		&fixtures.MockProposalRepository{BlockingKeys: []string{"12|56"}},
		&fixtures.MockMessagePublisher{Err: boom},
	)

	_, err := producer.Run(context.Background())
	if !errors.Is(err, boom) {
		t.Errorf("expected publish error to propagate, got: %v", err)
	}
}

func TestProposalBatchProducer_StartPolling_StopsOnContextCancellation(t *testing.T) {
	producer := newBatchProducer(&fixtures.MockProposalRepository{}, &fixtures.MockMessagePublisher{})

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	err := producer.StartPolling(ctx, 10*time.Millisecond)
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Errorf("expected DeadlineExceeded, got: %v", err)
	}
}
