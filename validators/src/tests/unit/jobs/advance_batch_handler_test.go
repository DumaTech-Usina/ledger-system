package jobs_test

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"validators/src/internal/application/jobs"
	"validators/src/internal/domain"
	"validators/src/internal/engine"
	"validators/src/internal/messaging/messages"
	advanceRules "validators/src/internal/rules/advances"
	"validators/src/tests/fixtures"
)

func buildAdvanceEngine() *engine.ValidationEngine {
	reg := engine.NewRegistry()
	reg.MustRegister(advanceRules.NewRuleAdv001())
	reg.MustRegister(advanceRules.NewRuleAdv002())
	reg.MustRegister(advanceRules.NewRuleAdv003())
	reg.MustRegister(advanceRules.NewRuleAdv004())
	reg.MustRegister(advanceRules.NewRuleAdv005())
	reg.MustRegister(advanceRules.NewRuleAdv006())
	reg.MustRegister(advanceRules.NewRuleAdv007())
	reg.MustRegister(advanceRules.NewRuleAdv008())
	reg.MustRegister(advanceRules.NewRuleAdv009())
	reg.MustRegister(advanceRules.NewRuleAdv010())
	return engine.NewValidationEngine(reg, engine.Sequential)
}

func newAdvanceHandler(
	repo *fixtures.MockAdvanceReportRepository,
	cRepo *fixtures.MockAspiantAdvanceCanonicalRepository,
	checker *fixtures.MockCanonicalProposalStatusChecker,
	aRepo *fixtures.MockAuditRepository,
) *jobs.AdvanceBatchHandler {
	return jobs.NewAdvanceBatchHandler(repo, cRepo, checker, aRepo, buildAdvanceEngine())
}

func validAdvanceBatchMsg(ids []string) []byte {
	msg := messages.AdvanceBatch{
		RunID:            "run-test-1",
		BatchID:          "batch-abc",
		Anchor:           ids[len(ids)-1],
		AdvanceReportIDs: ids,
	}
	body, _ := json.Marshal(msg)
	return body
}

// TestAdvanceBatchHandler_Handle_ValidBatch_SavesOneCanonicalPerAdvance verifies
// that every advance report fetched produces a canonical record.
func TestAdvanceBatchHandler_Handle_ValidBatch_SavesOneCanonicalPerAdvance(t *testing.T) {
	repo := &fixtures.MockAdvanceReportRepository{Advances: fixtures.AdvanceReportList(3)}
	cRepo := &fixtures.MockAspiantAdvanceCanonicalRepository{}
	aRepo := &fixtures.MockAuditRepository{}

	handler := newAdvanceHandler(repo, cRepo, &fixtures.MockCanonicalProposalStatusChecker{}, aRepo)
	if err := handler.Handle(context.Background(), validAdvanceBatchMsg([]string{"advance-1", "advance-2", "advance-3"})); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(cRepo.Saved) != 3 {
		t.Errorf("expected 3 canonical records, got %d", len(cRepo.Saved))
	}
}

// TestAdvanceBatchHandler_Handle_PropagatesSourceCreatedAt verifies that the advance's
// factual source registration time flows into the canonical record, rather than the
// canonicalization run time — so the Ledger dates the event when the fact occurred.
func TestAdvanceBatchHandler_Handle_PropagatesSourceCreatedAt(t *testing.T) {
	createdAt := time.Date(2026, 1, 5, 9, 30, 0, 0, time.UTC)
	repo := &fixtures.MockAdvanceReportRepository{
		Advances: []domain.AdvanceReport{
			fixtures.NewAdvanceReport(fixtures.WithAdvanceCreatedAt(createdAt)),
		},
	}
	cRepo := &fixtures.MockAspiantAdvanceCanonicalRepository{}

	handler := newAdvanceHandler(repo, cRepo, &fixtures.MockCanonicalProposalStatusChecker{}, &fixtures.MockAuditRepository{})
	if err := handler.Handle(context.Background(), validAdvanceBatchMsg([]string{"advance-1"})); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(cRepo.Saved) != 1 {
		t.Fatalf("expected 1 canonical record, got %d", len(cRepo.Saved))
	}
	if !cRepo.Saved[0].CreatedAt.Equal(createdAt) {
		t.Errorf("expected canonical CreatedAt %v, got %v", createdAt, cRepo.Saved[0].CreatedAt)
	}
}

// TestAdvanceBatchHandler_Handle_InvalidJSON_ReturnsError verifies that a malformed
// payload causes an error (→ worker nacks to DLQ) without panicking.
func TestAdvanceBatchHandler_Handle_InvalidJSON_ReturnsError(t *testing.T) {
	handler := newAdvanceHandler(
		&fixtures.MockAdvanceReportRepository{},
		&fixtures.MockAspiantAdvanceCanonicalRepository{},
		&fixtures.MockCanonicalProposalStatusChecker{},
		&fixtures.MockAuditRepository{},
	)
	err := handler.Handle(context.Background(), []byte(`not-json`))
	if err == nil {
		t.Fatal("expected error for invalid JSON payload")
	}
}

// TestAdvanceBatchHandler_Handle_EmptyIDList_DoesNotSave verifies that an empty
// advance_report_ids list causes an early return with no saves.
func TestAdvanceBatchHandler_Handle_EmptyIDList_DoesNotSave(t *testing.T) {
	cRepo := &fixtures.MockAspiantAdvanceCanonicalRepository{}
	handler := newAdvanceHandler(
		&fixtures.MockAdvanceReportRepository{},
		cRepo,
		&fixtures.MockCanonicalProposalStatusChecker{},
		&fixtures.MockAuditRepository{},
	)

	body, _ := json.Marshal(messages.AdvanceBatch{RunID: "run-1", BatchID: "b-1"})
	if err := handler.Handle(context.Background(), body); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(cRepo.Saved) != 0 {
		t.Errorf("expected no saves for empty ID list, got %d", len(cRepo.Saved))
	}
}

// TestAdvanceBatchHandler_Handle_FetchByIDsError_Nacks verifies that a failure
// fetching advances by IDs propagates as an error (→ nack).
func TestAdvanceBatchHandler_Handle_FetchByIDsError_Nacks(t *testing.T) {
	boom := errors.New("postgres timeout")
	repo := &fixtures.MockAdvanceReportRepository{ErrFetchByID: boom}

	handler := newAdvanceHandler(repo, &fixtures.MockAspiantAdvanceCanonicalRepository{},
		&fixtures.MockCanonicalProposalStatusChecker{}, &fixtures.MockAuditRepository{})
	err := handler.Handle(context.Background(), validAdvanceBatchMsg([]string{"adv-1"}))
	if !errors.Is(err, boom) {
		t.Errorf("expected FetchByIDs error to propagate, got: %v", err)
	}
}

// TestAdvanceBatchHandler_Handle_ReceiptLinksFetchError_Nacks verifies that a failure
// fetching active receipt links propagates (ErrLinks isolates it from FetchByIDs).
func TestAdvanceBatchHandler_Handle_ReceiptLinksFetchError_Nacks(t *testing.T) {
	boom := errors.New("receipt links unavailable")
	repo := &fixtures.MockAdvanceReportRepository{
		Advances: fixtures.AdvanceReportList(1),
		ErrLinks: boom,
	}

	handler := newAdvanceHandler(repo, &fixtures.MockAspiantAdvanceCanonicalRepository{},
		&fixtures.MockCanonicalProposalStatusChecker{}, &fixtures.MockAuditRepository{})
	err := handler.Handle(context.Background(), validAdvanceBatchMsg([]string{"advance-1"}))
	if !errors.Is(err, boom) {
		t.Errorf("expected receipt links error to propagate, got: %v", err)
	}
}

// TestAdvanceBatchHandler_Handle_ReceiptFetchError_Nacks verifies that a failure
// fetching receipt projections propagates (ErrReceipts isolates it).
func TestAdvanceBatchHandler_Handle_ReceiptFetchError_Nacks(t *testing.T) {
	boom := errors.New("receipts fetch failed")
	repo := &fixtures.MockAdvanceReportRepository{
		Advances:    fixtures.AdvanceReportList(1),
		Links:       []domain.AdvanceReportReceipt{{AdvanceReportID: "advance-1", ReceiptID: "rec-1", IsActive: true}},
		ErrReceipts: boom,
	}

	handler := newAdvanceHandler(repo, &fixtures.MockAspiantAdvanceCanonicalRepository{},
		&fixtures.MockCanonicalProposalStatusChecker{}, &fixtures.MockAuditRepository{})
	err := handler.Handle(context.Background(), validAdvanceBatchMsg([]string{"advance-1"}))
	if !errors.Is(err, boom) {
		t.Errorf("expected receipt fetch error to propagate, got: %v", err)
	}
}

// TestAdvanceBatchHandler_Handle_StatusCheckerError_Nacks verifies that a failure
// on canonical_proposals lookup propagates when there are receipt→proposal links.
func TestAdvanceBatchHandler_Handle_StatusCheckerError_Nacks(t *testing.T) {
	boom := errors.New("mongodb status check failed")
	repo := &fixtures.MockAdvanceReportRepository{
		Advances: fixtures.AdvanceReportList(1),
		Links:    []domain.AdvanceReportReceipt{{AdvanceReportID: "advance-1", ReceiptID: "rec-1", IsActive: true}},
		Receipts: []domain.AdvanceReceipt{{ID: "rec-1", ProposalID: "proposal-1", AmountToPay: 100}},
	}
	checker := &fixtures.MockCanonicalProposalStatusChecker{Err: boom}

	handler := newAdvanceHandler(repo, &fixtures.MockAspiantAdvanceCanonicalRepository{},
		checker, &fixtures.MockAuditRepository{})
	err := handler.Handle(context.Background(), validAdvanceBatchMsg([]string{"advance-1"}))
	if !errors.Is(err, boom) {
		t.Errorf("expected status checker error to propagate, got: %v", err)
	}
}

// TestAdvanceBatchHandler_Handle_SaveError_Nacks verifies that a MongoDB write
// failure propagates as an error so the worker nacks the message.
func TestAdvanceBatchHandler_Handle_SaveError_Nacks(t *testing.T) {
	boom := errors.New("mongo write timeout")
	repo := &fixtures.MockAdvanceReportRepository{Advances: fixtures.AdvanceReportList(2)}
	cRepo := &fixtures.MockAspiantAdvanceCanonicalRepository{Err: boom}

	handler := newAdvanceHandler(repo, cRepo, &fixtures.MockCanonicalProposalStatusChecker{}, &fixtures.MockAuditRepository{})
	err := handler.Handle(context.Background(), validAdvanceBatchMsg([]string{"advance-1", "advance-2"}))
	if !errors.Is(err, boom) {
		t.Errorf("expected save error to propagate, got: %v", err)
	}
}

// TestAdvanceBatchHandler_Handle_IdempotentReplay verifies that replaying the same
// message produces identical canonical records — the basis for safe at-least-once delivery.
func TestAdvanceBatchHandler_Handle_IdempotentReplay(t *testing.T) {
	repo := &fixtures.MockAdvanceReportRepository{Advances: fixtures.AdvanceReportList(2)}
	cRepo := &fixtures.MockAspiantAdvanceCanonicalRepository{}
	aRepo := &fixtures.MockAuditRepository{}

	handler := newAdvanceHandler(repo, cRepo, &fixtures.MockCanonicalProposalStatusChecker{}, aRepo)
	body := validAdvanceBatchMsg([]string{"advance-1", "advance-2"})

	if err := handler.Handle(context.Background(), body); err != nil {
		t.Fatalf("first handle: %v", err)
	}
	if err := handler.Handle(context.Background(), body); err != nil {
		t.Fatalf("second handle: %v", err)
	}

	if len(cRepo.Saved) != 4 {
		t.Fatalf("expected 4 total saves (2 replays × 2), got %d", len(cRepo.Saved))
	}
	first := cRepo.Saved[:2]
	second := cRepo.Saved[2:]
	for i := range first {
		if first[i].AdvanceReportID != second[i].AdvanceReportID {
			t.Errorf("replay produced different advance_report_id at position %d", i)
		}
		if first[i].Status != second[i].Status {
			t.Errorf("replay produced different status at position %d", i)
		}
	}
}

// TestAdvanceBatchHandler_Handle_SuspectProposalFlagsAdvance verifies end-to-end that
// when a receipt's proposal is SUSPICIOUS in canonical_proposals, the linked advance
// report is marked SUSPICIOUS in the canonical output (ADV-002 integration).
func TestAdvanceBatchHandler_Handle_SuspectProposalFlagsAdvance(t *testing.T) {
	repo := &fixtures.MockAdvanceReportRepository{
		Advances: []domain.AdvanceReport{
			fixtures.NewAdvanceReport(fixtures.WithAdvanceID("adv-1")),
		},
		Links: []domain.AdvanceReportReceipt{
			{AdvanceReportID: "adv-1", ReceiptID: "rec-1", IsActive: true},
		},
		Receipts: []domain.AdvanceReceipt{
			{ID: "rec-1", ProposalID: "proposal-bad", AmountToPay: 1000},
		},
	}
	checker := &fixtures.MockCanonicalProposalStatusChecker{
		SuspectIDs: []string{"proposal-bad"},
	}
	cRepo := &fixtures.MockAspiantAdvanceCanonicalRepository{}

	handler := newAdvanceHandler(repo, cRepo, checker, &fixtures.MockAuditRepository{})
	if err := handler.Handle(context.Background(), validAdvanceBatchMsg([]string{"adv-1"})); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(cRepo.Saved) != 1 {
		t.Fatalf("expected 1 canonical record, got %d", len(cRepo.Saved))
	}
	if cRepo.Saved[0].Status != domain.AdvanceReportStatusSuspicious {
		t.Errorf("expected SUSPICIOUS status, got %q", cRepo.Saved[0].Status)
	}
}

// TestAdvanceBatchHandler_Handle_NoAdvancesAfterFetch_DoesNotSave verifies that when
// FetchByIDs returns an empty slice (e.g. IDs were deleted between publish and consume),
// no canonical records are saved.
func TestAdvanceBatchHandler_Handle_NoAdvancesAfterFetch_DoesNotSave(t *testing.T) {
	repo := &fixtures.MockAdvanceReportRepository{Advances: nil}
	cRepo := &fixtures.MockAspiantAdvanceCanonicalRepository{}

	handler := newAdvanceHandler(repo, cRepo, &fixtures.MockCanonicalProposalStatusChecker{}, &fixtures.MockAuditRepository{})
	if err := handler.Handle(context.Background(), validAdvanceBatchMsg([]string{"ghost-1"})); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(cRepo.Saved) != 0 {
		t.Errorf("expected no saves when advances are empty, got %d", len(cRepo.Saved))
	}
}
