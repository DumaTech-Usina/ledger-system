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

func TestRule004_FlaggedProposalsContainsKnownIDs(t *testing.T) {
	rule := proposals.NewRule004()
	ctx := fixtures.NewValidationContextBuilder().
		WithStats(rules.ProposalStats{
			TotalProposals:     5,
			InvalidNumberCount: 2,
			InvalidNumberIDs:   []string{"proposal-X", "proposal-Y"},
		}).
		Build()

	result := rule.Execute(ctx)

	for _, id := range []string{"proposal-X", "proposal-Y"} {
		if _, ok := result.FlaggedProposals[id]; !ok {
			t.Errorf("expected proposal %q in FlaggedProposals", id)
		}
	}
	if len(result.FlaggedProposals) != 2 {
		t.Errorf("expected exactly 2 flagged proposals, got %d", len(result.FlaggedProposals))
	}
}

func TestRule004_FlaggedProposalsEmptyWhenNotTriggered(t *testing.T) {
	rule := proposals.NewRule004()
	ctx := fixtures.NewValidationContextBuilder().
		WithStats(rules.ProposalStats{
			TotalProposals:     10,
			InvalidNumberCount: 0,
		}).
		Build()

	result := rule.Execute(ctx)

	if len(result.FlaggedProposals) != 0 {
		t.Errorf("expected no flagged proposals when count is 0, got %d", len(result.FlaggedProposals))
	}
}
