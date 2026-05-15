package pipeline_test

import (
	"context"
	"errors"
	"testing"

	"validators/src/internal/domain"
	"validators/src/internal/engine"
	"validators/src/internal/pipeline"
	"validators/src/internal/pipelines/proposals"
	receiptPipeline "validators/src/internal/pipelines/receipts"
	proposalRules "validators/src/internal/rules/proposals"
	receiptRules "validators/src/internal/rules/receipts"
	"validators/src/tests/fixtures"
)

// TestFullPipeline_WithMocks wires every real layer (rules, engine, stages,
// use-case) but substitutes infrastructure with in-memory mocks.
// This proves the seams between layers work correctly without a database.
func TestFullPipeline_WithMocks(t *testing.T) {
	pRepo := &fixtures.MockProposalRepository{
		Proposals:    fixtures.ProposalList(2),
		TotalCount:   50,
		InvalidCount: 2,
	}
	rRepo := &fixtures.MockReceiptRepository{
		Receipts: []domain.Receipt{
			fixtures.NewReceipt(fixtures.WithProposalID("proposal-1"), fixtures.WithInstallmentNumber(1)),
		},
		DistinctPaidCount:    40,
		FalseDelinquentCount: 5,
	}
	aRepo := &fixtures.MockAuditRepository{}

	reg := engine.NewRegistry()
	reg.MustRegister(proposalRules.NewRule001())
	reg.MustRegister(proposalRules.NewRule002())
	reg.MustRegister(proposalRules.NewRule003())
	reg.MustRegister(proposalRules.NewRule004())

	eng := engine.NewValidationEngine(reg, engine.Sequential)

	runner := proposals.Build(proposals.Deps{
		ProposalRepo: pRepo,
		ReceiptRepo:  rRepo,
		AuditRepo:    aRepo,
		Engine:       eng,
	})

	if err := runner.Run(context.Background()); err != nil {
		t.Fatalf("pipeline failed: %v", err)
	}

	results := runner.Results()
	if len(results) != 4 {
		t.Fatalf("expected 4 rule results, got %d", len(results))
	}

	ruleNames := make(map[string]bool)
	for _, r := range results {
		ruleNames[r.RuleName] = true
	}
	for _, expected := range []string{"RULE-001", "RULE-002", "RULE-003", "RULE-004"} {
		if !ruleNames[expected] {
			t.Errorf("missing result for %s", expected)
		}
	}

	for _, r := range results {
		switch r.RuleName {
		case "RULE-003":
			if !r.Triggered {
				t.Error("RULE-003 should be triggered (FalseDelinquentCount=5)")
			}
		case "RULE-004":
			if !r.Triggered {
				t.Error("RULE-004 should be triggered (InvalidCount=2)")
			}
		}
	}

	if len(aRepo.SavedRuns) != 4 {
		t.Errorf("expected 4 saved rule runs, got %d", len(aRepo.SavedRuns))
	}
}

func TestFullPipeline_PropagatesIngestionError(t *testing.T) {
	boom := errors.New("db connection lost")
	pRepo := &fixtures.MockProposalRepository{Err: boom}
	rRepo := &fixtures.MockReceiptRepository{}
	aRepo := &fixtures.MockAuditRepository{}

	reg := engine.NewRegistry()
	reg.MustRegister(proposalRules.NewRule001())

	eng := engine.NewValidationEngine(reg, engine.Sequential)

	runner := proposals.Build(proposals.Deps{
		ProposalRepo: pRepo,
		ReceiptRepo:  rRepo,
		AuditRepo:    aRepo,
		Engine:       eng,
	})

	err := runner.Run(context.Background())
	if err == nil {
		t.Fatal("expected error from failed ingestion, got nil")
	}
	if !errors.Is(err, boom) {
		t.Errorf("expected wrapped boom error, got: %v", err)
	}
}

func TestFullPipeline_PropagatesEnrichmentError(t *testing.T) {
	boom := errors.New("receipt repo down")
	pRepo := &fixtures.MockProposalRepository{
		Proposals:  fixtures.ProposalList(1),
		TotalCount: 1,
	}
	rRepo := &fixtures.MockReceiptRepository{Err: boom}
	aRepo := &fixtures.MockAuditRepository{}

	reg := engine.NewRegistry()
	reg.MustRegister(proposalRules.NewRule001())

	eng := engine.NewValidationEngine(reg, engine.Sequential)

	runner := proposals.Build(proposals.Deps{
		ProposalRepo: pRepo,
		ReceiptRepo:  rRepo,
		AuditRepo:    aRepo,
		Engine:       eng,
	})

	err := runner.Run(context.Background())
	if !errors.Is(err, boom) {
		t.Errorf("expected enrichment error to propagate, got: %v", err)
	}
}

// TestReceiptPipeline_WithMocks wires the full receipts pipeline (real rules,
// real stages) with mocked infrastructure and asserts end-to-end behavior.
func TestReceiptPipeline_WithMocks(t *testing.T) {
	reader := &fixtures.MockCanonicalProposalReader{
		Proposals: fixtures.CanonicalProposalList(3),
	}
	rRepo := &fixtures.MockReceiptRepository{
		Receipts: append(
			fixtures.ReceiptList(2),
			fixtures.NewReceipt(
				fixtures.WithReceiptID("receipt-3"),
				fixtures.WithProposalID("proposal-3"),
				fixtures.WithDownloadedValue("bad"), // suspicious
				fixtures.WithReceiptStatus("LIQUIDADO"),
			),
		),
	}
	cRepo := &fixtures.MockAspiantReceiptCanonicalRepository{}

	receiptReg := engine.NewRegistry()
	receiptReg.MustRegister(receiptRules.NewRule001())
	eng := engine.NewValidationEngine(receiptReg, engine.Sequential)

	runner := receiptPipeline.Build(receiptPipeline.Deps{
		ProposalReader: reader,
		ReceiptRepo:    rRepo,
		CanonicalRepo:  cRepo,
		Engine:         eng,
	})

	if err := runner.Run(context.Background()); err != nil {
		t.Fatalf("pipeline failed: %v", err)
	}

	results := runner.Results()
	if len(results) != 1 {
		t.Fatalf("expected 1 rule result, got %d", len(results))
	}
	if !results[0].Triggered {
		t.Error("RECEIPT-RULE-001 should be triggered (one suspicious receipt)")
	}
	if results[0].IssuesFound != 1 {
		t.Errorf("expected 1 issue, got %d", results[0].IssuesFound)
	}

	if len(cRepo.Saved) != 3 {
		t.Fatalf("expected 3 canonical records saved, got %d", len(cRepo.Saved))
	}

	for _, rec := range cRepo.Saved {
		expected := "CLEAN"
		if rec.ReceiptID == "receipt-3" {
			expected = "SUSPICIOUS"
		}
		if rec.Metadata["receiptValidationStatus"] != expected {
			t.Errorf("receipt %q: expected %s, got %s",
				rec.ReceiptID, expected, rec.Metadata["receiptValidationStatus"])
		}
	}
}

func TestReceiptPipeline_AggregationFailureIsNonFatal(t *testing.T) {
	reader := &fixtures.MockCanonicalProposalReader{
		Proposals: fixtures.CanonicalProposalList(1),
	}
	rRepo := &fixtures.MockReceiptRepository{Receipts: fixtures.ReceiptList(1)}
	cRepo := &fixtures.MockAspiantReceiptCanonicalRepository{
		Err: errors.New("mongodb unreachable"),
	}

	receiptReg := engine.NewRegistry()
	receiptReg.MustRegister(receiptRules.NewRule001())
	eng := engine.NewValidationEngine(receiptReg, engine.Sequential)

	runner := receiptPipeline.Build(receiptPipeline.Deps{
		ProposalReader: reader,
		ReceiptRepo:    rRepo,
		CanonicalRepo:  cRepo,
		Engine:         eng,
	})

	if err := runner.Run(context.Background()); err != nil {
		t.Errorf("aggregation failure must be non-fatal, but got: %v", err)
	}
}

// TestPipelineRegistry_RunsProposalByName verifies the registry dispatches
// correctly to the registered runner.
func TestPipelineRegistry_RunsProposalByName(t *testing.T) {
	pRepo := &fixtures.MockProposalRepository{
		Proposals:  fixtures.ProposalList(1),
		TotalCount: 1,
	}
	rRepo := &fixtures.MockReceiptRepository{}
	aRepo := &fixtures.MockAuditRepository{}

	reg := engine.NewRegistry()
	reg.MustRegister(proposalRules.NewRule001())
	reg.MustRegister(proposalRules.NewRule002())
	reg.MustRegister(proposalRules.NewRule003())
	reg.MustRegister(proposalRules.NewRule004())

	eng := engine.NewValidationEngine(reg, engine.Sequential)

	runner := proposals.Build(proposals.Deps{
		ProposalRepo: pRepo,
		ReceiptRepo:  rRepo,
		AuditRepo:    aRepo,
		Engine:       eng,
	})

	pipelineRegistry := pipeline.NewRegistry()
	pipelineRegistry.MustRegister("proposals", runner)

	if err := pipelineRegistry.Run(context.Background(), "proposals"); err != nil {
		t.Fatalf("registry.Run failed: %v", err)
	}

	if runner.Results() == nil {
		t.Error("expected results after registry run, got nil")
	}
}
