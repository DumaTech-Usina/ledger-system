package jobs_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"validators/src/internal/application/jobs"
	"validators/src/internal/domain"
	"validators/src/internal/engine"
	receiptRules "validators/src/internal/rules/receipts"
	"validators/src/tests/fixtures"
)

func buildReceiptEngine() *engine.ValidationEngine {
	reg := engine.NewRegistry()
	reg.MustRegister(receiptRules.NewRule001())
	return engine.NewValidationEngine(reg, engine.Parallel)
}

func newReceiptJob(
	reader *fixtures.MockCanonicalProposalReader,
	rRepo *fixtures.MockReceiptRepository,
	cRepo *fixtures.MockAspiantReceiptCanonicalRepository,
	batchSize int,
) *jobs.ReceiptCanonicalJob {
	return jobs.NewReceiptCanonicalJob(reader, rRepo, cRepo, buildReceiptEngine(), batchSize)
}

func TestReceiptCanonicalJob_Run_EmptyProposals(t *testing.T) {
	cRepo := &fixtures.MockAspiantReceiptCanonicalRepository{}
	job := newReceiptJob(
		&fixtures.MockCanonicalProposalReader{},
		&fixtures.MockReceiptRepository{},
		cRepo, 10,
	)

	processed, err := job.Run(context.Background(), "", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if processed != 0 {
		t.Errorf("expected 0 processed, got %d", processed)
	}
	if len(cRepo.Saved) != 0 {
		t.Errorf("expected no saved canonicals, got %d", len(cRepo.Saved))
	}
}

func TestReceiptCanonicalJob_Run_SingleBatch(t *testing.T) {
	cRepo := &fixtures.MockAspiantReceiptCanonicalRepository{}
	job := newReceiptJob(
		&fixtures.MockCanonicalProposalReader{Proposals: fixtures.CanonicalProposalList(3)},
		&fixtures.MockReceiptRepository{Receipts: fixtures.ReceiptList(3)},
		cRepo, 10,
	)

	processed, err := job.Run(context.Background(), "", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if processed != 3 {
		t.Errorf("expected 3 proposals processed, got %d", processed)
	}
	if len(cRepo.Saved) != 3 {
		t.Errorf("expected 3 saved canonicals, got %d", len(cRepo.Saved))
	}
}

func TestReceiptCanonicalJob_Run_PropagatesReceiptCreatedAt(t *testing.T) {
	// The receipt's CreatedAt (true ABERTA-start) must flow into the canonical record
	// so the ledger can date the commission accrual by it.
	createdAt := time.Date(2026, 1, 5, 12, 0, 0, 0, time.UTC)
	cRepo := &fixtures.MockAspiantReceiptCanonicalRepository{}
	job := newReceiptJob(
		&fixtures.MockCanonicalProposalReader{Proposals: fixtures.CanonicalProposalList(1)},
		&fixtures.MockReceiptRepository{
			Receipts: []domain.Receipt{
				fixtures.NewReceipt(fixtures.WithReceiptCreatedAt(createdAt)),
			},
		},
		cRepo, 10,
	)

	if _, err := job.Run(context.Background(), "", nil); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(cRepo.Saved) != 1 {
		t.Fatalf("expected 1 saved canonical, got %d", len(cRepo.Saved))
	}
	if !cRepo.Saved[0].CreatedAt.Equal(createdAt) {
		t.Errorf("expected canonical CreatedAt %v, got %v", createdAt, cRepo.Saved[0].CreatedAt)
	}
}

func TestReceiptCanonicalJob_Run_MultipleBatches_ProcessesAll(t *testing.T) {
	// 5 proposals with batchSize=2 → 3 batches (2, 2, 1).
	// Mock receipt repo returns 2 receipts per call regardless of IDs.
	cRepo := &fixtures.MockAspiantReceiptCanonicalRepository{}
	job := newReceiptJob(
		&fixtures.MockCanonicalProposalReader{Proposals: fixtures.CanonicalProposalList(5)},
		&fixtures.MockReceiptRepository{Receipts: fixtures.ReceiptList(2)},
		cRepo, 2,
	)

	processed, err := job.Run(context.Background(), "", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if processed != 5 {
		t.Errorf("expected 5 proposals processed, got %d", processed)
	}
	// 3 batches × 2 receipts from mock = 6 saved canonical records
	if len(cRepo.Saved) != 6 {
		t.Errorf("expected 6 saved canonicals (3 batches × 2 receipts), got %d", len(cRepo.Saved))
	}
}

func TestReceiptCanonicalJob_Run_CallsOnBatchPerConfirmedWrite(t *testing.T) {
	// 4 proposals with batchSize=2 → exactly 2 batches.
	var batches []jobs.BatchResult
	onBatch := func(r jobs.BatchResult) { batches = append(batches, r) }

	job := newReceiptJob(
		&fixtures.MockCanonicalProposalReader{Proposals: fixtures.CanonicalProposalList(4)},
		&fixtures.MockReceiptRepository{Receipts: fixtures.ReceiptList(1)},
		&fixtures.MockAspiantReceiptCanonicalRepository{},
		2,
	)

	if _, err := job.Run(context.Background(), "", onBatch); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(batches) != 2 {
		t.Fatalf("expected 2 batch callbacks, got %d", len(batches))
	}
	if batches[0].Count != 2 || batches[1].Count != 2 {
		t.Errorf("unexpected batch counts: %v, %v", batches[0].Count, batches[1].Count)
	}
	if batches[0].Anchor != "proposal-2" {
		t.Errorf("expected anchor proposal-2, got %q", batches[0].Anchor)
	}
	if batches[1].Anchor != "proposal-4" {
		t.Errorf("expected anchor proposal-4, got %q", batches[1].Anchor)
	}
}

func TestReceiptCanonicalJob_Run_OnBatchNotCalledOnSaveError(t *testing.T) {
	// Verify the checkpoint guarantee: if SaveAll fails, onBatch must not fire.
	boom := errors.New("mongo write timeout")
	var batchCallCount int
	onBatch := func(_ jobs.BatchResult) { batchCallCount++ }

	job := newReceiptJob(
		&fixtures.MockCanonicalProposalReader{Proposals: fixtures.CanonicalProposalList(3)},
		&fixtures.MockReceiptRepository{Receipts: fixtures.ReceiptList(1)},
		&fixtures.MockAspiantReceiptCanonicalRepository{Err: boom},
		10,
	)

	_, err := job.Run(context.Background(), "", onBatch)
	if !errors.Is(err, boom) {
		t.Errorf("expected save error to propagate, got: %v", err)
	}
	if batchCallCount != 0 {
		t.Errorf("onBatch must not be called when SaveAll fails, called %d time(s)", batchCallCount)
	}
}

func TestReceiptCanonicalJob_Run_FetchBatchError(t *testing.T) {
	boom := errors.New("mongo timeout")
	job := newReceiptJob(
		&fixtures.MockCanonicalProposalReader{Err: boom},
		&fixtures.MockReceiptRepository{},
		&fixtures.MockAspiantReceiptCanonicalRepository{},
		10,
	)

	_, err := job.Run(context.Background(), "", nil)
	if !errors.Is(err, boom) {
		t.Errorf("expected proposal fetch error to propagate, got: %v", err)
	}
}

func TestReceiptCanonicalJob_Run_FetchReceiptsError(t *testing.T) {
	boom := errors.New("postgres timeout")
	job := newReceiptJob(
		&fixtures.MockCanonicalProposalReader{Proposals: fixtures.CanonicalProposalList(3)},
		&fixtures.MockReceiptRepository{Err: boom},
		&fixtures.MockAspiantReceiptCanonicalRepository{},
		10,
	)

	_, err := job.Run(context.Background(), "", nil)
	if !errors.Is(err, boom) {
		t.Errorf("expected receipt fetch error to propagate, got: %v", err)
	}
}

func TestReceiptCanonicalJob_Run_SaveAllError(t *testing.T) {
	boom := errors.New("mongo write timeout")
	job := newReceiptJob(
		&fixtures.MockCanonicalProposalReader{Proposals: fixtures.CanonicalProposalList(3)},
		&fixtures.MockReceiptRepository{Receipts: fixtures.ReceiptList(1)},
		&fixtures.MockAspiantReceiptCanonicalRepository{Err: boom},
		10,
	)

	_, err := job.Run(context.Background(), "", nil)
	if !errors.Is(err, boom) {
		t.Errorf("expected save error to propagate, got: %v", err)
	}
}

func TestReceiptCanonicalJob_StartPolling_StopsOnContextCancellation(t *testing.T) {
	job := newReceiptJob(
		&fixtures.MockCanonicalProposalReader{},
		&fixtures.MockReceiptRepository{},
		&fixtures.MockAspiantReceiptCanonicalRepository{},
		10,
	)

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	err := job.StartPolling(ctx, 10*time.Millisecond, nil)
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Errorf("expected DeadlineExceeded, got: %v", err)
	}
}
