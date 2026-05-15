package pipelines_test

import (
	"context"
	"errors"
	"testing"

	"validators/src/internal/domain"
	"validators/src/internal/engine"
	"validators/src/internal/pipelines/receipts"
	receiptRules "validators/src/internal/rules/receipts"
	"validators/src/tests/fixtures"
)

func buildReceiptsEngine() *engine.ValidationEngine {
	reg := engine.NewRegistry()
	reg.MustRegister(receiptRules.NewRule001())
	return engine.NewValidationEngine(reg, engine.Sequential)
}

func TestReceiptsBuild_RunsSuccessfully(t *testing.T) {
	reader := &fixtures.MockCanonicalProposalReader{
		Proposals: fixtures.CanonicalProposalList(3),
	}
	rRepo := &fixtures.MockReceiptRepository{
		Receipts: fixtures.ReceiptList(3),
	}
	cRepo := &fixtures.MockAspiantReceiptCanonicalRepository{}

	runner := receipts.Build(receipts.Deps{
		ProposalReader: reader,
		ReceiptRepo:    rRepo,
		CanonicalRepo:  cRepo,
		Engine:         buildReceiptsEngine(),
	})

	if err := runner.Run(context.Background()); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	results := runner.Results()
	if len(results) != 1 {
		t.Fatalf("expected 1 rule result, got %d", len(results))
	}
	if results[0].RuleName != "RECEIPT-RULE-001" {
		t.Errorf("expected RECEIPT-RULE-001, got %q", results[0].RuleName)
	}
}

func TestReceiptsBuild_ResultsNilBeforeRun(t *testing.T) {
	runner := receipts.Build(receipts.Deps{
		ProposalReader: &fixtures.MockCanonicalProposalReader{},
		ReceiptRepo:    &fixtures.MockReceiptRepository{},
		CanonicalRepo:  &fixtures.MockAspiantReceiptCanonicalRepository{},
		Engine:         buildReceiptsEngine(),
	})

	if runner.Results() != nil {
		t.Error("Results() must be nil before Run is called")
	}
}

func TestReceiptsBuild_PropagatesIngestionError(t *testing.T) {
	boom := errors.New("mongodb unavailable")
	reader := &fixtures.MockCanonicalProposalReader{Err: boom}

	runner := receipts.Build(receipts.Deps{
		ProposalReader: reader,
		ReceiptRepo:    &fixtures.MockReceiptRepository{},
		CanonicalRepo:  &fixtures.MockAspiantReceiptCanonicalRepository{},
		Engine:         buildReceiptsEngine(),
	})

	err := runner.Run(context.Background())
	if !errors.Is(err, boom) {
		t.Errorf("expected ingestion error to propagate, got: %v", err)
	}
}

func TestReceiptsBuild_PropagatesEnrichmentError(t *testing.T) {
	boom := errors.New("postgres connection reset")
	reader := &fixtures.MockCanonicalProposalReader{
		Proposals: fixtures.CanonicalProposalList(2),
	}
	rRepo := &fixtures.MockReceiptRepository{Err: boom}

	runner := receipts.Build(receipts.Deps{
		ProposalReader: reader,
		ReceiptRepo:    rRepo,
		CanonicalRepo:  &fixtures.MockAspiantReceiptCanonicalRepository{},
		Engine:         buildReceiptsEngine(),
	})

	err := runner.Run(context.Background())
	if !errors.Is(err, boom) {
		t.Errorf("expected enrichment error to propagate, got: %v", err)
	}
}

func TestReceiptsBuild_AggregationFailureIsNonFatal(t *testing.T) {
	reader := &fixtures.MockCanonicalProposalReader{
		Proposals: fixtures.CanonicalProposalList(2),
	}
	rRepo := &fixtures.MockReceiptRepository{
		Receipts: fixtures.ReceiptList(2),
	}
	cRepo := &fixtures.MockAspiantReceiptCanonicalRepository{
		Err: errors.New("mongodb write timeout"),
	}

	runner := receipts.Build(receipts.Deps{
		ProposalReader: reader,
		ReceiptRepo:    rRepo,
		CanonicalRepo:  cRepo,
		Engine:         buildReceiptsEngine(),
	})

	if err := runner.Run(context.Background()); err != nil {
		t.Errorf("aggregation failure must be non-fatal, but got: %v", err)
	}
}

func TestReceiptsBuild_ZeroProposalsCompletesCleanly(t *testing.T) {
	reader := &fixtures.MockCanonicalProposalReader{Proposals: nil}

	runner := receipts.Build(receipts.Deps{
		ProposalReader: reader,
		ReceiptRepo:    &fixtures.MockReceiptRepository{},
		CanonicalRepo:  &fixtures.MockAspiantReceiptCanonicalRepository{},
		Engine:         buildReceiptsEngine(),
	})

	if err := runner.Run(context.Background()); err != nil {
		t.Errorf("zero proposals must not error, got: %v", err)
	}

	results := runner.Results()
	if len(results) != 1 {
		t.Fatalf("expected 1 rule result even with zero proposals, got %d", len(results))
	}
	if results[0].RecordsScanned != 0 {
		t.Errorf("expected 0 records scanned, got %d", results[0].RecordsScanned)
	}
}

func TestReceiptsBuild_SuspiciousReceiptTaggedInCanonical(t *testing.T) {
	reader := &fixtures.MockCanonicalProposalReader{
		Proposals: fixtures.CanonicalProposalList(1),
	}
	rRepo := &fixtures.MockReceiptRepository{
		Receipts: []domain.Receipt{
			fixtures.NewReceipt(
				fixtures.WithReceiptID("bad-receipt"),
				fixtures.WithProposalID("proposal-1"),
				fixtures.WithDownloadedValue("1000.5"), // one decimal — suspicious
				fixtures.WithReceiptStatus("LIQUIDADO"),
			),
		},
	}
	cRepo := &fixtures.MockAspiantReceiptCanonicalRepository{}

	runner := receipts.Build(receipts.Deps{
		ProposalReader: reader,
		ReceiptRepo:    rRepo,
		CanonicalRepo:  cRepo,
		Engine:         buildReceiptsEngine(),
	})

	if err := runner.Run(context.Background()); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(cRepo.Saved) != 1 {
		t.Fatalf("expected 1 saved canonical record, got %d", len(cRepo.Saved))
	}
	status := cRepo.Saved[0].Metadata["receiptValidationStatus"]
	if status != "SUSPICIOUS" {
		t.Errorf("expected SUSPICIOUS, got %q", status)
	}
}

func TestReceiptsBuild_CleanReceiptTaggedInCanonical(t *testing.T) {
	reader := &fixtures.MockCanonicalProposalReader{
		Proposals: fixtures.CanonicalProposalList(1),
	}
	rRepo := &fixtures.MockReceiptRepository{
		Receipts: []domain.Receipt{
			fixtures.NewReceipt(
				fixtures.WithReceiptID("good-receipt"),
				fixtures.WithProposalID("proposal-1"),
				fixtures.WithDownloadedValue("1000.00"),
				fixtures.WithReceiptStatus("LIQUIDADO"),
			),
		},
	}
	cRepo := &fixtures.MockAspiantReceiptCanonicalRepository{}

	runner := receipts.Build(receipts.Deps{
		ProposalReader: reader,
		ReceiptRepo:    rRepo,
		CanonicalRepo:  cRepo,
		Engine:         buildReceiptsEngine(),
	})

	if err := runner.Run(context.Background()); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(cRepo.Saved) != 1 {
		t.Fatalf("expected 1 saved canonical record, got %d", len(cRepo.Saved))
	}
	status := cRepo.Saved[0].Metadata["receiptValidationStatus"]
	if status != "CLEAN" {
		t.Errorf("expected CLEAN, got %q", status)
	}
}
