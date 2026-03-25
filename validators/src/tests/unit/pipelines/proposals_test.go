package pipelines_test

import (
	"context"
	"errors"
	"testing"

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
