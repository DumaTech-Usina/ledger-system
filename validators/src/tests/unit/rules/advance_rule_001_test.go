package rules_test

import (
	"testing"

	advances "validators/src/internal/rules/advances"
	"validators/src/tests/fixtures"
)

func TestRuleAdv001_Execute_PaidWithValidPrecision_NotFlagged(t *testing.T) {
	ctx := fixtures.NewValidationContextBuilder().
		WithAdvanceReports(fixtures.NewAdvanceReport(fixtures.WithAmountToPay(1000.00))).
		Build()

	result := advances.NewRuleAdv001().Execute(ctx)
	if result.Triggered {
		t.Errorf("expected no trigger for valid monetary precision")
	}
	if len(result.FlaggedProposals) != 0 {
		t.Errorf("expected no flagged advances, got %d", len(result.FlaggedProposals))
	}
}

func TestRuleAdv001_Execute_PaidWithInvalidPrecision_Flagged(t *testing.T) {
	ctx := fixtures.NewValidationContextBuilder().
		WithAdvanceReports(fixtures.NewAdvanceReport(
			fixtures.WithAmountToPay(1000.123),
		)).
		Build()

	result := advances.NewRuleAdv001().Execute(ctx)
	if !result.Triggered {
		t.Fatal("expected rule to trigger for invalid monetary precision")
	}
	if result.IssuesFound != 1 {
		t.Errorf("expected 1 issue, got %d", result.IssuesFound)
	}
	if _, ok := result.FlaggedProposals["advance-1"]; !ok {
		t.Errorf("expected advance-1 to be flagged")
	}
}

func TestRuleAdv001_Execute_UnpaidWithInvalidPrecision_NotFlagged(t *testing.T) {
	// Unpaid advance reports are out of scope for ADV-001.
	ctx := fixtures.NewValidationContextBuilder().
		WithAdvanceReports(fixtures.NewAdvanceReport(
			fixtures.WithIsPaid(false),
			fixtures.WithAmountToPay(1000.123),
		)).
		Build()

	result := advances.NewRuleAdv001().Execute(ctx)
	if result.Triggered {
		t.Errorf("unpaid advance must not be flagged by ADV-001")
	}
}

func TestRuleAdv001_Execute_EmptyContext_DoesNotPanic(t *testing.T) {
	ctx := fixtures.NewValidationContextBuilder().Build()
	result := advances.NewRuleAdv001().Execute(ctx)
	if result.RuleName != advances.NewRuleAdv001().Name() {
		t.Errorf("unexpected rule name: %q", result.RuleName)
	}
}

func TestRuleAdv001_Execute_MultipleAdvances_OnlyFlagsInvalid(t *testing.T) {
	ctx := fixtures.NewValidationContextBuilder().
		WithAdvanceReports(
			fixtures.NewAdvanceReport(fixtures.WithAdvanceID("a-1"), fixtures.WithAmountToPay(500.00)),
			fixtures.NewAdvanceReport(fixtures.WithAdvanceID("a-2"), fixtures.WithAmountToPay(500.005)),
			fixtures.NewAdvanceReport(fixtures.WithAdvanceID("a-3"), fixtures.WithAmountToPay(250.50)),
		).
		Build()

	result := advances.NewRuleAdv001().Execute(ctx)
	if result.IssuesFound != 1 {
		t.Errorf("expected 1 issue (a-2), got %d", result.IssuesFound)
	}
	if _, ok := result.FlaggedProposals["a-2"]; !ok {
		t.Errorf("expected a-2 to be flagged")
	}
	if _, ok := result.FlaggedProposals["a-1"]; ok {
		t.Errorf("a-1 must not be flagged")
	}
}
