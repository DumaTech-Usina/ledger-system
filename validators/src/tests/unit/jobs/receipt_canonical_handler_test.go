package jobs_test

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"validators/src/internal/application/jobs"
	"validators/src/internal/messaging/messages"
	"validators/src/tests/fixtures"
)

func newReceiptHandler(
	rRepo *fixtures.MockReceiptRepository,
	cRepo *fixtures.MockAspiantReceiptCanonicalRepository,
) *jobs.ReceiptCanonicalHandler {
	return jobs.NewReceiptCanonicalHandler(rRepo, cRepo, buildReceiptEngine())
}

func TestReceiptCanonicalHandler_Handle_ValidBatch_FetchesAndSaves(t *testing.T) {
	rRepo := &fixtures.MockReceiptRepository{Receipts: fixtures.ReceiptList(3)}
	cRepo := &fixtures.MockAspiantReceiptCanonicalRepository{}

	batch := messages.ReceiptCanonicalBatch{
		BatchID:     "batch-1",
		Anchor:      "proposal-3",
		ProposalIDs: []string{"proposal-1", "proposal-2", "proposal-3"},
	}
	body, _ := json.Marshal(batch)

	handler := newReceiptHandler(rRepo, cRepo)
	if err := handler.Handle(context.Background(), body); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(cRepo.Saved) != 3 {
		t.Errorf("expected 3 saved canonicals, got %d", len(cRepo.Saved))
	}
}

func TestReceiptCanonicalHandler_Handle_InvalidJSON_ReturnsError(t *testing.T) {
	handler := newReceiptHandler(
		&fixtures.MockReceiptRepository{},
		&fixtures.MockAspiantReceiptCanonicalRepository{},
	)
	err := handler.Handle(context.Background(), []byte(`not-json`))
	if err == nil {
		t.Fatal("expected error for invalid JSON payload")
	}
}

func TestReceiptCanonicalHandler_Handle_FetchReceiptsError_Propagates(t *testing.T) {
	boom := errors.New("postgres timeout")
	rRepo := &fixtures.MockReceiptRepository{Err: boom}

	batch := messages.ReceiptCanonicalBatch{BatchID: "b1", ProposalIDs: []string{"p-1"}}
	body, _ := json.Marshal(batch)

	handler := newReceiptHandler(rRepo, &fixtures.MockAspiantReceiptCanonicalRepository{})
	err := handler.Handle(context.Background(), body)
	if !errors.Is(err, boom) {
		t.Errorf("expected fetch error to propagate, got: %v", err)
	}
}

func TestReceiptCanonicalHandler_Handle_SaveError_Propagates(t *testing.T) {
	boom := errors.New("mongo write timeout")
	cRepo := &fixtures.MockAspiantReceiptCanonicalRepository{Err: boom}

	batch := messages.ReceiptCanonicalBatch{BatchID: "b1", ProposalIDs: []string{"p-1"}}
	body, _ := json.Marshal(batch)

	handler := newReceiptHandler(&fixtures.MockReceiptRepository{Receipts: fixtures.ReceiptList(1)}, cRepo)
	err := handler.Handle(context.Background(), body)
	if !errors.Is(err, boom) {
		t.Errorf("expected save error to propagate, got: %v", err)
	}
}
