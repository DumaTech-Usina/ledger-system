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

func TestReceiptBatchProducer_Run_EmptyProposals(t *testing.T) {
	pub := &fixtures.MockMessagePublisher{}
	producer := jobs.NewReceiptBatchProducer(
		&fixtures.MockCanonicalProposalReader{},
		pub, 10,
	)

	total, err := producer.Run(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if total != 0 {
		t.Errorf("expected 0 proposals dispatched, got %d", total)
	}
	if len(pub.Published) != 0 {
		t.Errorf("expected no messages published, got %d", len(pub.Published))
	}
}

func TestReceiptBatchProducer_Run_PublishesOneBatchPerPage(t *testing.T) {
	// 5 proposals with batchSize=2 → 3 pages → 3 published messages
	pub := &fixtures.MockMessagePublisher{}
	producer := jobs.NewReceiptBatchProducer(
		&fixtures.MockCanonicalProposalReader{Proposals: fixtures.CanonicalProposalList(5)},
		pub, 2,
	)

	total, err := producer.Run(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if total != 5 {
		t.Errorf("expected 5 proposals dispatched, got %d", total)
	}
	if len(pub.Published) != 3 {
		t.Errorf("expected 3 published messages, got %d", len(pub.Published))
	}
	for _, msg := range pub.Published {
		if msg.RoutingKey != "validation.receipts" {
			t.Errorf("expected routing key validation.receipts, got %q", msg.RoutingKey)
		}
	}
}

func TestReceiptBatchProducer_Run_BatchIDIsDeterministic(t *testing.T) {
	proposals := fixtures.CanonicalProposalList(3)

	run := func() []messages.ReceiptCanonicalBatch {
		pub := &fixtures.MockMessagePublisher{}
		producer := jobs.NewReceiptBatchProducer(
			&fixtures.MockCanonicalProposalReader{Proposals: proposals},
			pub, 10,
		)
		_, _ = producer.Run(context.Background())
		var batches []messages.ReceiptCanonicalBatch
		for _, m := range pub.Published {
			var b messages.ReceiptCanonicalBatch
			json.Unmarshal(m.Body, &b)
			batches = append(batches, b)
		}
		return batches
	}

	first := run()
	second := run()

	if len(first) != 1 || len(second) != 1 {
		t.Fatalf("expected exactly 1 batch each run")
	}
	if first[0].BatchID != second[0].BatchID {
		t.Errorf("batch_id must be deterministic: got %q and %q", first[0].BatchID, second[0].BatchID)
	}
}

func TestReceiptBatchProducer_Run_BatchIDDiffersForDifferentProposals(t *testing.T) {
	pub1 := &fixtures.MockMessagePublisher{}
	pub2 := &fixtures.MockMessagePublisher{}

	jobs.NewReceiptBatchProducer(&fixtures.MockCanonicalProposalReader{Proposals: fixtures.CanonicalProposalList(2)}, pub1, 10).Run(context.Background())
	jobs.NewReceiptBatchProducer(&fixtures.MockCanonicalProposalReader{Proposals: fixtures.CanonicalProposalList(3)}, pub2, 10).Run(context.Background())

	var b1, b2 messages.ReceiptCanonicalBatch
	json.Unmarshal(pub1.Published[0].Body, &b1)
	json.Unmarshal(pub2.Published[0].Body, &b2)

	if b1.BatchID == b2.BatchID {
		t.Errorf("different proposal sets must produce different batch IDs, got same: %q", b1.BatchID)
	}
}

func TestReceiptBatchProducer_Run_PropagatesFetchError(t *testing.T) {
	boom := errors.New("mongodb unavailable")
	producer := jobs.NewReceiptBatchProducer(
		&fixtures.MockCanonicalProposalReader{Err: boom},
		&fixtures.MockMessagePublisher{}, 10,
	)

	_, err := producer.Run(context.Background())
	if !errors.Is(err, boom) {
		t.Errorf("expected fetch error to propagate, got: %v", err)
	}
}

func TestReceiptBatchProducer_Run_PropagatesPublishError(t *testing.T) {
	boom := errors.New("broker unavailable")
	producer := jobs.NewReceiptBatchProducer(
		&fixtures.MockCanonicalProposalReader{Proposals: fixtures.CanonicalProposalList(3)},
		&fixtures.MockMessagePublisher{Err: boom}, 10,
	)

	_, err := producer.Run(context.Background())
	if !errors.Is(err, boom) {
		t.Errorf("expected publish error to propagate, got: %v", err)
	}
}

func TestReceiptBatchProducer_StartPolling_StopsOnContextCancellation(t *testing.T) {
	producer := jobs.NewReceiptBatchProducer(
		&fixtures.MockCanonicalProposalReader{},
		&fixtures.MockMessagePublisher{}, 10,
	)

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	err := producer.StartPolling(ctx, 10*time.Millisecond)
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Errorf("expected DeadlineExceeded, got: %v", err)
	}
}
