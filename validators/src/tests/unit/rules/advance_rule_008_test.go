package rules_test

import (
	"testing"

	advances "validators/src/internal/rules/advances"
	"validators/src/tests/fixtures"
)

func TestRuleAdv008_Execute_PositiveAdvanceFee_NotFlagged(t *testing.T) {
	ctx := fixtures.NewValidationContextBuilder().
		WithAdvanceReports(fixtures.NewAdvanceReport(fixtures.WithAdvanceFee(10.00))).
		Build()

	result := advances.NewRuleAdv008().Execute(ctx)
	if result.Triggered {
		t.Errorf("positive advance_fee must not be flagged")
	}
}

func TestRuleAdv008_Execute_ZeroAdvanceFee_NotFlagged(t *testing.T) {
	ctx := fixtures.NewValidationContextBuilder().
		WithAdvanceReports(fixtures.NewAdvanceReport(fixtures.WithAdvanceFee(0))).
		Build()

	result := advances.NewRuleAdv008().Execute(ctx)
	if result.Triggered {
		t.Errorf("zero advance_fee must not be flagged")
	}
}

func TestRuleAdv008_Execute_NegativeAdvanceFee_Flagged(t *testing.T) {
	ctx := fixtures.NewValidationContextBuilder().
		WithAdvanceReports(fixtures.NewAdvanceReport(
			fixtures.WithAdvanceID("adv-1"),
			fixtures.WithAdvanceFee(-5.00),
		)).
		Build()

	result := advances.NewRuleAdv008().Execute(ctx)
	if !result.Triggered {
		t.Fatal("expected trigger: negative advance_fee")
	}
	if _, ok := result.FlaggedProposals["adv-1"]; !ok {
		t.Errorf("expected adv-1 to be flagged")
	}
}

func TestRuleAdv008_Execute_MultipleAdvances_OnlyFlagsNegative(t *testing.T) {
	ctx := fixtures.NewValidationContextBuilder().
		WithAdvanceReports(
			fixtures.NewAdvanceReport(fixtures.WithAdvanceID("adv-1"), fixtures.WithAdvanceFee(10.00)),
			fixtures.NewAdvanceReport(fixtures.WithAdvanceID("adv-2"), fixtures.WithAdvanceFee(-1.00)),
			fixtures.NewAdvanceReport(fixtures.WithAdvanceID("adv-3"), fixtures.WithAdvanceFee(0.50)),
		).
		Build()

	result := advances.NewRuleAdv008().Execute(ctx)
	if result.IssuesFound != 1 {
		t.Errorf("expected 1 issue (adv-2), got %d", result.IssuesFound)
	}
	if _, ok := result.FlaggedProposals["adv-2"]; !ok {
		t.Errorf("expected adv-2 to be flagged")
	}
}
