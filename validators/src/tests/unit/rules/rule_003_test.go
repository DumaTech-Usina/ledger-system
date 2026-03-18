package rules_test

import (
	"testing"

	"validators/src/internal/rules"
	"validators/src/internal/rules/proposals"
	"validators/src/tests/fixtures"
)

func TestRule003_NoFalseDelinquents(t *testing.T) {
	rule := proposals.NewRule003()
	ctx := fixtures.NewValidationContextBuilder().
		WithStats(rules.ProposalStats{
			TotalPaidProposals:   200,
			FalseDelinquentCount: 0,
		}).
		Build()

	result := rule.Execute(ctx)

	if result.Triggered {
		t.Error("expected no trigger when FalseDelinquentCount is 0")
	}
	if result.RecordsScanned != 200 {
		t.Errorf("expected 200 scanned, got %d", result.RecordsScanned)
	}
}

func TestRule003_FalseDelinquentsFound(t *testing.T) {
	rule := proposals.NewRule003()
	ctx := fixtures.NewValidationContextBuilder().
		WithStats(rules.ProposalStats{
			TotalPaidProposals:   150,
			FalseDelinquentCount: 12,
		}).
		Build()

	result := rule.Execute(ctx)

	if !result.Triggered {
		t.Error("expected rule to trigger when FalseDelinquentCount > 0")
	}
	if result.IssuesFound != 12 {
		t.Errorf("expected 12 issues, got %d", result.IssuesFound)
	}
	if result.RecordsScanned != 150 {
		t.Errorf("expected 150 scanned, got %d", result.RecordsScanned)
	}
}

func TestRule003_EmptyStats(t *testing.T) {
	rule := proposals.NewRule003()
	ctx := fixtures.NewValidationContextBuilder().Build()

	result := rule.Execute(ctx)

	if result.Triggered {
		t.Error("zero-value stats must not trigger the rule")
	}
}
