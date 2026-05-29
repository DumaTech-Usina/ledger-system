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

func newAdvanceProducer(
	repo *fixtures.MockAdvanceReportRepository,
	pub *fixtures.MockMessagePublisher,
	batchSize int,
) *jobs.AdvanceBatchProducer {
	return jobs.NewAdvanceBatchProducer(repo, pub, batchSize)
}

func TestAdvanceBatchProducer_Run_EmptyAdvances_NoMessagesPublished(t *testing.T) {
	pub := &fixtures.MockMessagePublisher{}
	producer := newAdvanceProducer(&fixtures.MockAdvanceReportRepository{}, pub, 10)

	total, err := producer.Run(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if total != 0 {
		t.Errorf("expected 0 advances dispatched, got %d", total)
	}
	if len(pub.Published) != 0 {
		t.Errorf("expected no messages published, got %d", len(pub.Published))
	}
}

func TestAdvanceBatchProducer_Run_PublishesOneBatchPerPage(t *testing.T) {
	// 5 advances with batchSize=2 → 3 pages → 3 published messages.
	pub := &fixtures.MockMessagePublisher{}
	producer := newAdvanceProducer(
		&fixtures.MockAdvanceReportRepository{Advances: fixtures.AdvanceReportList(5)},
		pub, 2,
	)

	total, err := producer.Run(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if total != 5 {
		t.Errorf("expected 5 advances dispatched, got %d", total)
	}
	if len(pub.Published) != 3 {
		t.Errorf("expected 3 published messages (3 pages), got %d", len(pub.Published))
	}
	for _, msg := range pub.Published {
		if msg.RoutingKey != "validation.advances.batch" {
			t.Errorf("expected routing key validation.advances.batch, got %q", msg.RoutingKey)
		}
	}
}

func TestAdvanceBatchProducer_Run_BatchIDIsDeterministic(t *testing.T) {
	advances := fixtures.AdvanceReportList(3)

	run := func() messages.AdvanceBatch {
		pub := &fixtures.MockMessagePublisher{}
		jobs.NewAdvanceBatchProducer(
			&fixtures.MockAdvanceReportRepository{Advances: advances},
			pub, 10,
		).Run(context.Background())
		var batch messages.AdvanceBatch
		json.Unmarshal(pub.Published[0].Body, &batch)
		return batch
	}

	first := run()
	second := run()

	if first.BatchID != second.BatchID {
		t.Errorf("batch_id must be deterministic: got %q and %q", first.BatchID, second.BatchID)
	}
}

func TestAdvanceBatchProducer_Run_AllMessagesShareRunID(t *testing.T) {
	pub := &fixtures.MockMessagePublisher{}
	jobs.NewAdvanceBatchProducer(
		&fixtures.MockAdvanceReportRepository{Advances: fixtures.AdvanceReportList(4)},
		pub, 2,
	).Run(context.Background())

	if len(pub.Published) != 2 {
		t.Fatalf("expected 2 messages, got %d", len(pub.Published))
	}

	var msgs []messages.AdvanceBatch
	for _, m := range pub.Published {
		var b messages.AdvanceBatch
		json.Unmarshal(m.Body, &b)
		msgs = append(msgs, b)
	}

	runID := msgs[0].RunID
	if runID == "" {
		t.Fatal("expected non-empty run_id")
	}
	if msgs[1].RunID != runID {
		t.Errorf("all messages must share run_id: got %q and %q", runID, msgs[1].RunID)
	}
}

func TestAdvanceBatchProducer_Run_UniqueRunIDPerRun(t *testing.T) {
	pub := &fixtures.MockMessagePublisher{}
	producer := jobs.NewAdvanceBatchProducer(
		&fixtures.MockAdvanceReportRepository{Advances: fixtures.AdvanceReportList(1)},
		pub, 10,
	)

	producer.Run(context.Background())
	producer.Run(context.Background())

	var b1, b2 messages.AdvanceBatch
	json.Unmarshal(pub.Published[0].Body, &b1)
	json.Unmarshal(pub.Published[1].Body, &b2)

	if b1.RunID == b2.RunID {
		t.Errorf("different runs must produce different run_ids, got same: %q", b1.RunID)
	}
}

func TestAdvanceBatchProducer_Run_PropagatesFetchError(t *testing.T) {
	boom := errors.New("postgres unavailable")
	producer := newAdvanceProducer(
		&fixtures.MockAdvanceReportRepository{Err: boom},
		&fixtures.MockMessagePublisher{}, 10,
	)

	_, err := producer.Run(context.Background())
	if !errors.Is(err, boom) {
		t.Errorf("expected fetch error to propagate, got: %v", err)
	}
}

func TestAdvanceBatchProducer_Run_PropagatesPublishError(t *testing.T) {
	boom := errors.New("broker unavailable")
	producer := newAdvanceProducer(
		&fixtures.MockAdvanceReportRepository{Advances: fixtures.AdvanceReportList(2)},
		&fixtures.MockMessagePublisher{Err: boom}, 10,
	)

	_, err := producer.Run(context.Background())
	if !errors.Is(err, boom) {
		t.Errorf("expected publish error to propagate, got: %v", err)
	}
}

func TestAdvanceBatchProducer_StartPolling_StopsOnContextCancellation(t *testing.T) {
	producer := newAdvanceProducer(&fixtures.MockAdvanceReportRepository{}, &fixtures.MockMessagePublisher{}, 10)

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	err := producer.StartPolling(ctx, 10*time.Millisecond)
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Errorf("expected DeadlineExceeded, got: %v", err)
	}
}
