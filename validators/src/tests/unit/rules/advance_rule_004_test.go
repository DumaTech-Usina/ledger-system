package rules_test

import (
	"testing"

	advances "validators/src/internal/rules/advances"
	"validators/src/tests/fixtures"
)

func TestRuleAdv004_Execute_ReceiptInOneAdvance_NotFlagged(t *testing.T) {
	ctx := fixtures.NewValidationContextBuilder().
		WithAdvanceReports(fixtures.NewAdvanceReport(fixtures.WithAdvanceID("adv-1"))).
		WithAdvanceReportReceipts(fixtures.NewAdvanceReportReceipt(
			fixtures.WithLinkAdvanceID("adv-1"), fixtures.WithLinkReceiptID("rec-1"),
		)).
		Build()

	result := advances.NewRuleAdv004().Execute(ctx)
	if result.Triggered {
		t.Errorf("receipt in a single advance must not be flagged")
	}
}

func TestRuleAdv004_Execute_ReceiptInMultiplePaidAdvances_Flagged(t *testing.T) {
	ctx := fixtures.NewValidationContextBuilder().
		WithAdvanceReports(
			fixtures.NewAdvanceReport(fixtures.WithAdvanceID("adv-1"), fixtures.WithIsPaid(true)),
			fixtures.NewAdvanceReport(fixtures.WithAdvanceID("adv-2"), fixtures.WithIsPaid(true)),
		).
		WithAdvanceReportReceipts(
			fixtures.NewAdvanceReportReceipt(fixtures.WithLinkAdvanceID("adv-1"), fixtures.WithLinkReceiptID("rec-1")),
			fixtures.NewAdvanceReportReceipt(fixtures.WithLinkAdvanceID("adv-2"), fixtures.WithLinkReceiptID("rec-1")),
		).
		Build()

	result := advances.NewRuleAdv004().Execute(ctx)
	if !result.Triggered {
		t.Fatal("expected trigger: same receipt in two paid advances")
	}
	if _, ok := result.FlaggedProposals["adv-1"]; !ok {
		t.Errorf("expected adv-1 to be flagged")
	}
	if _, ok := result.FlaggedProposals["adv-2"]; !ok {
		t.Errorf("expected adv-2 to be flagged")
	}
}

func TestRuleAdv004_Execute_ReceiptInUnpaidAdvances_NotFlagged(t *testing.T) {
	ctx := fixtures.NewValidationContextBuilder().
		WithAdvanceReports(
			fixtures.NewAdvanceReport(fixtures.WithAdvanceID("adv-1"), fixtures.WithIsPaid(false)),
			fixtures.NewAdvanceReport(fixtures.WithAdvanceID("adv-2"), fixtures.WithIsPaid(false)),
		).
		WithAdvanceReportReceipts(
			fixtures.NewAdvanceReportReceipt(fixtures.WithLinkAdvanceID("adv-1"), fixtures.WithLinkReceiptID("rec-1")),
			fixtures.NewAdvanceReportReceipt(fixtures.WithLinkAdvanceID("adv-2"), fixtures.WithLinkReceiptID("rec-1")),
		).
		Build()

	result := advances.NewRuleAdv004().Execute(ctx)
	if result.Triggered {
		t.Errorf("receipt shared across unpaid advances must not be flagged")
	}
}
