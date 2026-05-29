package rules_test

import (
	"testing"

	advances "validators/src/internal/rules/advances"
	"validators/src/tests/fixtures"
)

func TestRuleAdv006_Execute_SumMatchesAmount_NotFlagged(t *testing.T) {
	ctx := fixtures.NewValidationContextBuilder().
		WithAdvanceReports(fixtures.NewAdvanceReport(
			fixtures.WithAdvanceID("adv-1"), fixtures.WithAmountToPay(500.00),
		)).
		WithAdvanceReportReceipts(
			fixtures.NewAdvanceReportReceipt(fixtures.WithLinkAdvanceID("adv-1"), fixtures.WithLinkReceiptID("rec-1")),
			fixtures.NewAdvanceReportReceipt(fixtures.WithLinkAdvanceID("adv-1"), fixtures.WithLinkReceiptID("rec-2")),
		).
		WithAdvanceReceipts(
			fixtures.NewAdvanceReceipt(fixtures.WithAdvReceiptID("rec-1"), fixtures.WithAdvReceiptAmount(300.00)),
			fixtures.NewAdvanceReceipt(fixtures.WithAdvReceiptID("rec-2"), fixtures.WithAdvReceiptAmount(200.00)),
		).
		Build()

	result := advances.NewRuleAdv006().Execute(ctx)
	if result.Triggered {
		t.Errorf("sum equals advance amount — must not be flagged")
	}
}

func TestRuleAdv006_Execute_SumDivergesFromAmount_Flagged(t *testing.T) {
	ctx := fixtures.NewValidationContextBuilder().
		WithAdvanceReports(fixtures.NewAdvanceReport(
			fixtures.WithAdvanceID("adv-1"), fixtures.WithAmountToPay(500.00),
		)).
		WithAdvanceReportReceipts(
			fixtures.NewAdvanceReportReceipt(fixtures.WithLinkAdvanceID("adv-1"), fixtures.WithLinkReceiptID("rec-1")),
		).
		WithAdvanceReceipts(
			fixtures.NewAdvanceReceipt(fixtures.WithAdvReceiptID("rec-1"), fixtures.WithAdvReceiptAmount(400.00)),
		).
		Build()

	result := advances.NewRuleAdv006().Execute(ctx)
	if !result.Triggered {
		t.Fatal("expected trigger: receipt sum diverges from advance amount by 100")
	}
	if _, ok := result.FlaggedProposals["adv-1"]; !ok {
		t.Errorf("expected adv-1 to be flagged")
	}
}

func TestRuleAdv006_Execute_DivergenceWithinTolerance_NotFlagged(t *testing.T) {
	// Diff = 0.005 < 0.01 tolerance → should not be flagged.
	ctx := fixtures.NewValidationContextBuilder().
		WithAdvanceReports(fixtures.NewAdvanceReport(
			fixtures.WithAdvanceID("adv-1"), fixtures.WithAmountToPay(100.00),
		)).
		WithAdvanceReportReceipts(
			fixtures.NewAdvanceReportReceipt(fixtures.WithLinkAdvanceID("adv-1"), fixtures.WithLinkReceiptID("rec-1")),
		).
		WithAdvanceReceipts(
			fixtures.NewAdvanceReceipt(fixtures.WithAdvReceiptID("rec-1"), fixtures.WithAdvReceiptAmount(100.005)),
		).
		Build()

	result := advances.NewRuleAdv006().Execute(ctx)
	if result.Triggered {
		t.Errorf("diff within tolerance (0.005 < 0.01) must not trigger")
	}
}
