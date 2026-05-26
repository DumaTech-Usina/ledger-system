package jobs_test

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"validators/src/internal/application/jobs"
	"validators/src/internal/engine"
	"validators/src/internal/messaging/messages"
	proposalRules "validators/src/internal/rules/proposals"
	"validators/src/tests/fixtures"
)

func buildProposalEngine() *engine.ValidationEngine {
	reg := engine.NewRegistry()
	reg.MustRegister(proposalRules.NewRule001())
	reg.MustRegister(proposalRules.NewRule002())
	reg.MustRegister(proposalRules.NewRule003())
	reg.MustRegister(proposalRules.NewRule004())
	return engine.NewValidationEngine(reg, engine.Sequential)
}

func newBatchHandler(
	pRepo *fixtures.MockProposalRepository,
	rRepo *fixtures.MockReceiptRepository,
	aRepo *fixtures.MockAuditRepository,
) *jobs.ProposalBatchHandler {
	return jobs.NewProposalBatchHandler(pRepo, rRepo, aRepo, buildProposalEngine())
}

func validBatchMessage(key string) []byte {
	msg := messages.ProposalBlockBatch{
		RunID:       "run-test-1",
		BatchID:     "batch-abc",
		BlockingKey: key,
	}
	body, _ := json.Marshal(msg)
	return body
}

// TestProposalBatchHandler_Handle_ValidBatch_SavesOneCanonicalPerProposal verifies
// that every proposal fetched for the blocking key produces a canonical record.
func TestProposalBatchHandler_Handle_ValidBatch_SavesOneCanonicalPerProposal(t *testing.T) {
	pRepo := &fixtures.MockProposalRepository{Proposals: fixtures.ProposalList(3), TotalCount: 3}
	aRepo := &fixtures.MockAuditRepository{}

	handler := newBatchHandler(pRepo, &fixtures.MockReceiptRepository{}, aRepo)
	if err := handler.Handle(context.Background(), validBatchMessage("12|56")); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(aRepo.SavedCanonical) != 3 {
		t.Errorf("expected 3 canonical records, got %d", len(aRepo.SavedCanonical))
	}
}

// TestProposalBatchHandler_Handle_ValidBatch_RunIDPropagatedToCanonicals verifies
// that the run_id from the message is stored on every canonical record.
func TestProposalBatchHandler_Handle_ValidBatch_RunIDPropagatedToCanonicals(t *testing.T) {
	pRepo := &fixtures.MockProposalRepository{Proposals: fixtures.ProposalList(2), TotalCount: 2}
	aRepo := &fixtures.MockAuditRepository{}

	msg := messages.ProposalBlockBatch{RunID: "run-xyz", BatchID: "b1", BlockingKey: "12|56"}
	body, _ := json.Marshal(msg)

	handler := newBatchHandler(pRepo, &fixtures.MockReceiptRepository{}, aRepo)
	if err := handler.Handle(context.Background(), body); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	for _, cp := range aRepo.SavedCanonical {
		if cp.RunID != "run-xyz" {
			t.Errorf("expected run_id=run-xyz on canonical, got %q", cp.RunID)
		}
	}
}

// TestProposalBatchHandler_Handle_InvalidJSON_ReturnsError verifies that a malformed
// payload causes an error (→ worker nacks to DLQ) without panicking.
func TestProposalBatchHandler_Handle_InvalidJSON_ReturnsError(t *testing.T) {
	handler := newBatchHandler(
		&fixtures.MockProposalRepository{},
		&fixtures.MockReceiptRepository{},
		&fixtures.MockAuditRepository{},
	)
	err := handler.Handle(context.Background(), []byte(`not-json`))
	if err == nil {
		t.Fatal("expected error for invalid JSON payload")
	}
}

// TestProposalBatchHandler_Handle_EmptyProposals_DoesNotSave verifies that when the
// blocking key has no proposals in the DB, no save is attempted.
func TestProposalBatchHandler_Handle_EmptyProposals_DoesNotSave(t *testing.T) {
	aRepo := &fixtures.MockAuditRepository{}
	handler := newBatchHandler(
		&fixtures.MockProposalRepository{},
		&fixtures.MockReceiptRepository{},
		aRepo,
	)
	if err := handler.Handle(context.Background(), validBatchMessage("99|99")); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(aRepo.SavedCanonical) != 0 {
		t.Errorf("expected no saves for empty block, got %d", len(aRepo.SavedCanonical))
	}
}

// TestProposalBatchHandler_Handle_FetchProposalsError_Nacks verifies that a failure
// fetching proposals by blocking key propagates as an error, causing a nack.
func TestProposalBatchHandler_Handle_FetchProposalsError_Nacks(t *testing.T) {
	boom := errors.New("postgres timeout")
	pRepo := &fixtures.MockProposalRepository{ErrFetchByKey: boom}

	handler := newBatchHandler(pRepo, &fixtures.MockReceiptRepository{}, &fixtures.MockAuditRepository{})
	err := handler.Handle(context.Background(), validBatchMessage("12|56"))
	if !errors.Is(err, boom) {
		t.Errorf("expected fetch error to propagate, got: %v", err)
	}
}

// TestProposalBatchHandler_Handle_StatsError_Nacks verifies that a failure on
// aggregate stat queries (CountTotal etc.) propagates as an error. ErrFetchByKey
// is left nil so FetchByBlockingKey succeeds first.
func TestProposalBatchHandler_Handle_StatsError_Nacks(t *testing.T) {
	boom := errors.New("db count failed")
	pRepo := &fixtures.MockProposalRepository{
		Proposals:  fixtures.ProposalList(2),
		Err:        boom, // affects CountTotal / CountInvalidNumbers etc.
		TotalCount: 2,
	}

	handler := newBatchHandler(pRepo, &fixtures.MockReceiptRepository{}, &fixtures.MockAuditRepository{})
	err := handler.Handle(context.Background(), validBatchMessage("12|56"))
	if !errors.Is(err, boom) {
		t.Errorf("expected stats error to propagate, got: %v", err)
	}
}

// TestProposalBatchHandler_Handle_SaveError_Nacks verifies that a MongoDB write
// failure propagates as an error so the worker nacks the message.
func TestProposalBatchHandler_Handle_SaveError_Nacks(t *testing.T) {
	boom := errors.New("mongo write timeout")
	pRepo := &fixtures.MockProposalRepository{Proposals: fixtures.ProposalList(2), TotalCount: 2}
	aRepo := &fixtures.MockAuditRepository{Err: boom}

	handler := newBatchHandler(pRepo, &fixtures.MockReceiptRepository{}, aRepo)
	err := handler.Handle(context.Background(), validBatchMessage("12|56"))
	if !errors.Is(err, boom) {
		t.Errorf("expected save error to propagate, got: %v", err)
	}
}

// TestProposalBatchHandler_Handle_IdempotentReplay_ProducesSameCanonicals verifies
// that processing the same message twice produces identical canonical records —
// the basis for safe at-least-once delivery.
func TestProposalBatchHandler_Handle_IdempotentReplay_ProducesSameCanonicals(t *testing.T) {
	pRepo := &fixtures.MockProposalRepository{Proposals: fixtures.ProposalList(3), TotalCount: 3}
	aRepo := &fixtures.MockAuditRepository{}

	handler := newBatchHandler(pRepo, &fixtures.MockReceiptRepository{}, aRepo)
	body := validBatchMessage("12|56")

	if err := handler.Handle(context.Background(), body); err != nil {
		t.Fatalf("first handle: %v", err)
	}
	if err := handler.Handle(context.Background(), body); err != nil {
		t.Fatalf("second handle: %v", err)
	}

	// Six saves total (3 per call), but the two sets must be identical.
	if len(aRepo.SavedCanonical) != 6 {
		t.Fatalf("expected 6 total saves (2 replays × 3), got %d", len(aRepo.SavedCanonical))
	}
	first := aRepo.SavedCanonical[:3]
	second := aRepo.SavedCanonical[3:]
	for i := range first {
		if first[i].ProposalID != second[i].ProposalID {
			t.Errorf("position %d: replay produced different proposal_id: %q vs %q",
				i, first[i].ProposalID, second[i].ProposalID)
		}
		if first[i].Status != second[i].Status {
			t.Errorf("position %d: replay produced different status: %q vs %q",
				i, first[i].Status, second[i].Status)
		}
	}
}
