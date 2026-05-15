package pipelines_test

import (
	"context"
	"errors"
	"testing"

	"validators/src/internal/domain"
	"validators/src/internal/engine"
	"validators/src/internal/pipelines/proposals"
	proposalRules "validators/src/internal/rules/proposals"
	"validators/src/tests/fixtures"
)

func buildEngine() *engine.ValidationEngine {
	reg := engine.NewRegistry()
	reg.MustRegister(proposalRules.NewRule001())
	reg.MustRegister(proposalRules.NewRule002())
	reg.MustRegister(proposalRules.NewRule003())
	reg.MustRegister(proposalRules.NewRule004())
	return engine.NewValidationEngine(reg, engine.Sequential)
}

func TestBuild_RunsAllFourStages(t *testing.T) {
	pRepo := &fixtures.MockProposalRepository{
		Proposals:    fixtures.ProposalList(3),
		TotalCount:   10,
		InvalidCount: 0,
	}
	rRepo := &fixtures.MockReceiptRepository{
		DistinctPaidCount:    8,
		FalseDelinquentCount: 0,
	}
	aRepo := &fixtures.MockAuditRepository{}

	runner := proposals.Build(proposals.Deps{
		ProposalRepo: pRepo,
		ReceiptRepo:  rRepo,
		AuditRepo:    aRepo,
		Engine:       buildEngine(),
	})

	if err := runner.Run(context.Background()); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	results := runner.Results()
	if len(results) != 4 {
		t.Fatalf("expected 4 rule results, got %d", len(results))
	}

	seen := make(map[string]bool)
	for _, r := range results {
		seen[r.RuleName] = true
	}
	for _, name := range []string{"RULE-001", "RULE-002", "RULE-003", "RULE-004"} {
		if !seen[name] {
			t.Errorf("missing result for %s", name)
		}
	}

	if len(aRepo.SavedRuns) != 4 {
		t.Errorf("expected 4 saved audit runs, got %d", len(aRepo.SavedRuns))
	}
}

func TestBuild_TriggersRule003And004WhenStatsNonZero(t *testing.T) {
	pRepo := &fixtures.MockProposalRepository{
		Proposals:    fixtures.ProposalList(2),
		TotalCount:   50,
		InvalidCount: 3,
	}
	rRepo := &fixtures.MockReceiptRepository{
		DistinctPaidCount:    40,
		FalseDelinquentCount: 2,
	}
	aRepo := &fixtures.MockAuditRepository{}

	runner := proposals.Build(proposals.Deps{
		ProposalRepo: pRepo,
		ReceiptRepo:  rRepo,
		AuditRepo:    aRepo,
		Engine:       buildEngine(),
	})

	if err := runner.Run(context.Background()); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	for _, r := range runner.Results() {
		switch r.RuleName {
		case "RULE-003":
			if !r.Triggered {
				t.Error("RULE-003 should be triggered (FalseDelinquentCount=2)")
			}
		case "RULE-004":
			if !r.Triggered {
				t.Error("RULE-004 should be triggered (InvalidCount=3)")
			}
		}
	}
}

func TestBuild_PropagatesIngestionError(t *testing.T) {
	boom := errors.New("db down")
	pRepo := &fixtures.MockProposalRepository{Err: boom}
	rRepo := &fixtures.MockReceiptRepository{}
	aRepo := &fixtures.MockAuditRepository{}

	runner := proposals.Build(proposals.Deps{
		ProposalRepo: pRepo,
		ReceiptRepo:  rRepo,
		AuditRepo:    aRepo,
		Engine:       buildEngine(),
	})

	err := runner.Run(context.Background())
	if err == nil {
		t.Fatal("expected error from failed ingestion, got nil")
	}
	if !errors.Is(err, boom) {
		t.Errorf("expected wrapped boom error, got: %v", err)
	}
}

func TestBuild_ResultsNilBeforeRun(t *testing.T) {
	runner := proposals.Build(proposals.Deps{
		ProposalRepo: &fixtures.MockProposalRepository{},
		ReceiptRepo:  &fixtures.MockReceiptRepository{},
		AuditRepo:    &fixtures.MockAuditRepository{},
		Engine:       buildEngine(),
	})

	if runner.Results() != nil {
		t.Error("Results() should be nil before Run is called")
	}
}

func TestBuild_PropagatesEnrichmentError(t *testing.T) {
	boom := errors.New("receipt db down")
	pRepo := &fixtures.MockProposalRepository{
		Proposals:  fixtures.ProposalList(1),
		TotalCount: 1,
	}
	rRepo := &fixtures.MockReceiptRepository{Err: boom}
	aRepo := &fixtures.MockAuditRepository{}

	runner := proposals.Build(proposals.Deps{
		ProposalRepo: pRepo,
		ReceiptRepo:  rRepo,
		AuditRepo:    aRepo,
		Engine:       buildEngine(),
	})

	err := runner.Run(context.Background())
	if !errors.Is(err, boom) {
		t.Errorf("expected enrichment error to propagate, got: %v", err)
	}
}

func TestBuild_AggregationFailureIsNonFatal(t *testing.T) {
	pRepo := &fixtures.MockProposalRepository{
		Proposals:  fixtures.ProposalList(2),
		TotalCount: 2,
	}
	rRepo := &fixtures.MockReceiptRepository{}
	aRepo := &fixtures.MockAuditRepository{Err: errors.New("mongo write failed")}

	runner := proposals.Build(proposals.Deps{
		ProposalRepo: pRepo,
		ReceiptRepo:  rRepo,
		AuditRepo:    aRepo,
		Engine:       buildEngine(),
	})

	if err := runner.Run(context.Background()); err != nil {
		t.Errorf("aggregation failure must be non-fatal, but got: %v", err)
	}
}

func TestBuild_ZeroProposalsCompletesCleanly(t *testing.T) {
	pRepo := &fixtures.MockProposalRepository{TotalCount: 0}
	rRepo := &fixtures.MockReceiptRepository{}
	aRepo := &fixtures.MockAuditRepository{}

	runner := proposals.Build(proposals.Deps{
		ProposalRepo: pRepo,
		ReceiptRepo:  rRepo,
		AuditRepo:    aRepo,
		Engine:       buildEngine(),
	})

	if err := runner.Run(context.Background()); err != nil {
		t.Errorf("zero proposals must not error, got: %v", err)
	}
	if len(runner.Results()) != 4 {
		t.Errorf("expected 4 rule results even with zero proposals, got %d", len(runner.Results()))
	}
}

func TestBuild_CanonicalProposals_CleanWhenNoViolations(t *testing.T) {
	pRepo := &fixtures.MockProposalRepository{
		Proposals:  fixtures.ProposalList(3),
		TotalCount: 3,
	}
	rRepo := &fixtures.MockReceiptRepository{}
	aRepo := &fixtures.MockAuditRepository{}

	runner := proposals.Build(proposals.Deps{
		ProposalRepo: pRepo,
		ReceiptRepo:  rRepo,
		AuditRepo:    aRepo,
		Engine:       buildEngine(),
	})

	if err := runner.Run(context.Background()); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(aRepo.SavedCanonical) != 3 {
		t.Fatalf("expected 3 canonical proposals saved, got %d", len(aRepo.SavedCanonical))
	}
	for _, cp := range aRepo.SavedCanonical {
		if cp.Status != domain.ProposalStatusClean {
			t.Errorf("proposal %q: expected CLEAN status, got %q", cp.ProposalID, cp.Status)
		}
	}
}

func TestBuild_CanonicalProposals_SuspiciousWhenFlagged(t *testing.T) {
	// The mock generates IDs like "invalid-number-1" for InvalidCount=1.
	// Use a matching proposal ID so the violation is attributed correctly.
	pRepo := &fixtures.MockProposalRepository{
		Proposals: []domain.Proposal{
			fixtures.NewProposal(fixtures.WithID("invalid-number-1"), fixtures.WithNumber("000000")),
			fixtures.NewProposal(fixtures.WithID("proposal-2"), fixtures.WithNumber("654321")),
		},
		TotalCount:   2,
		InvalidCount: 1,
	}
	rRepo := &fixtures.MockReceiptRepository{}
	aRepo := &fixtures.MockAuditRepository{}

	runner := proposals.Build(proposals.Deps{
		ProposalRepo: pRepo,
		ReceiptRepo:  rRepo,
		AuditRepo:    aRepo,
		Engine:       buildEngine(),
	})

	if err := runner.Run(context.Background()); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	found := false
	for _, cp := range aRepo.SavedCanonical {
		if cp.ProposalID == "invalid-number-1" {
			found = true
			if cp.Status != domain.ProposalStatusSuspicious {
				t.Errorf("expected SUSPICIOUS for invalid-number-1, got %q", cp.Status)
			}
			if len(cp.Violations) == 0 {
				t.Error("expected at least one violation for the suspicious proposal")
			}
		}
	}
	if !found {
		t.Error("expected invalid-number-1 to appear in SavedCanonical")
	}
}
