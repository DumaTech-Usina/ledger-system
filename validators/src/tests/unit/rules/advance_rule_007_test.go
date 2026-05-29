package rules_test

import (
	"testing"

	advances "validators/src/internal/rules/advances"
	"validators/src/tests/fixtures"
)

func TestRuleAdv007_Execute_PaidNotCancelled_NotFlagged(t *testing.T) {
	ctx := fixtures.NewValidationContextBuilder().
		WithAdvanceReports(fixtures.NewAdvanceReport(
			fixtures.WithIsPaid(true), fixtures.WithIsCancelled(false),
		)).
		Build()

	result := advances.NewRuleAdv007().Execute(ctx)
	if result.Triggered {
		t.Errorf("paid-only advance must not be flagged")
	}
}

func TestRuleAdv007_Execute_BothPaidAndCancelled_Flagged(t *testing.T) {
	ctx := fixtures.NewValidationContextBuilder().
		WithAdvanceReports(fixtures.NewAdvanceReport(
			fixtures.WithAdvanceID("adv-1"),
			fixtures.WithIsPaid(true),
			fixtures.WithIsCancelled(true),
		)).
		Build()

	result := advances.NewRuleAdv007().Execute(ctx)
	if !result.Triggered {
		t.Fatal("expected trigger: advance is simultaneously paid and cancelled")
	}
	if _, ok := result.FlaggedProposals["adv-1"]; !ok {
		t.Errorf("expected adv-1 to be flagged")
	}
}

func TestRuleAdv007_Execute_CancelledNotPaid_NotFlagged(t *testing.T) {
	ctx := fixtures.NewValidationContextBuilder().
		WithAdvanceReports(fixtures.NewAdvanceReport(
			fixtures.WithIsPaid(false), fixtures.WithIsCancelled(true),
		)).
		Build()

	result := advances.NewRuleAdv007().Execute(ctx)
	if result.Triggered {
		t.Errorf("cancelled-only advance must not be flagged")
	}
}

func TestRuleAdv007_Execute_NeitherPaidNorCancelled_NotFlagged(t *testing.T) {
	ctx := fixtures.NewValidationContextBuilder().
		WithAdvanceReports(fixtures.NewAdvanceReport(
			fixtures.WithIsPaid(false), fixtures.WithIsCancelled(false),
		)).
		Build()

	result := advances.NewRuleAdv007().Execute(ctx)
	if result.Triggered {
		t.Errorf("normal advance must not be flagged")
	}
}
