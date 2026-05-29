package rules_test

import (
	"testing"

	advances "validators/src/internal/rules/advances"
	"validators/src/tests/fixtures"
)

func TestRuleAdv005_Execute_AdvanceWithReceipts_NotFlagged(t *testing.T) {
	ctx := fixtures.NewValidationContextBuilder().
		WithAdvanceReports(fixtures.NewAdvanceReport(fixtures.WithAdvanceID("adv-1"))).
		WithAdvanceReportReceipts(fixtures.NewAdvanceReportReceipt(
			fixtures.WithLinkAdvanceID("adv-1"),
		)).
		Build()

	result := advances.NewRuleAdv005().Execute(ctx)
	if result.Triggered {
		t.Errorf("advance with receipt links must not be flagged")
	}
}

func TestRuleAdv005_Execute_AdvanceWithoutReceipts_Flagged(t *testing.T) {
	ctx := fixtures.NewValidationContextBuilder().
		WithAdvanceReports(fixtures.NewAdvanceReport(fixtures.WithAdvanceID("adv-1"))).
		// no links
		Build()

	result := advances.NewRuleAdv005().Execute(ctx)
	if !result.Triggered {
		t.Fatal("expected trigger: advance with no receipt links")
	}
	if _, ok := result.FlaggedProposals["adv-1"]; !ok {
		t.Errorf("expected adv-1 to be flagged")
	}
}

func TestRuleAdv005_Execute_MixedAdvances_OnlyFlagsEmpty(t *testing.T) {
	ctx := fixtures.NewValidationContextBuilder().
		WithAdvanceReports(
			fixtures.NewAdvanceReport(fixtures.WithAdvanceID("adv-1")),
			fixtures.NewAdvanceReport(fixtures.WithAdvanceID("adv-2")), // no links
		).
		WithAdvanceReportReceipts(fixtures.NewAdvanceReportReceipt(
			fixtures.WithLinkAdvanceID("adv-1"),
		)).
		Build()

	result := advances.NewRuleAdv005().Execute(ctx)
	if result.IssuesFound != 1 {
		t.Errorf("expected 1 issue (adv-2), got %d", result.IssuesFound)
	}
	if _, ok := result.FlaggedProposals["adv-2"]; !ok {
		t.Errorf("expected adv-2 to be flagged")
	}
}

func TestRuleAdv005_Execute_EmptyContext_NotFlagged(t *testing.T) {
	ctx := fixtures.NewValidationContextBuilder().Build()
	result := advances.NewRuleAdv005().Execute(ctx)
	if result.Triggered {
		t.Errorf("empty context must not trigger")
	}
}
