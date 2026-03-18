package rules_test

import (
	"testing"

	"validators/src/internal/rules"
	"validators/src/internal/rules/proposals"
	"validators/src/tests/fixtures"
)

func TestRule004_NoInvalidNumbers(t *testing.T) {
	rule := proposals.NewRule004()
	ctx := fixtures.NewValidationContextBuilder().
		WithStats(rules.ProposalStats{
			TotalProposals:     100,
			InvalidNumberCount: 0,
		}).
		Build()

	result := rule.Execute(ctx)

	if result.Triggered {
		t.Error("expected no trigger when InvalidNumberCount is 0")
	}
	if result.RecordsScanned != 100 {
		t.Errorf("expected 100 scanned, got %d", result.RecordsScanned)
	}
}

func TestRule004_InvalidNumbersFound(t *testing.T) {
	rule := proposals.NewRule004()
	ctx := fixtures.NewValidationContextBuilder().
		WithStats(rules.ProposalStats{
			TotalProposals:     50,
			InvalidNumberCount: 5,
		}).
		Build()

	result := rule.Execute(ctx)

	if !result.Triggered {
		t.Error("expected rule to trigger when InvalidNumberCount > 0")
	}
	if result.IssuesFound != 5 {
		t.Errorf("expected 5 issues, got %d", result.IssuesFound)
	}
}

func TestRule004_EmptyStats(t *testing.T) {
	rule := proposals.NewRule004()
	ctx := fixtures.NewValidationContextBuilder().Build()

	result := rule.Execute(ctx)

	if result.Triggered {
		t.Error("zero-value stats must not trigger the rule")
	}
}
