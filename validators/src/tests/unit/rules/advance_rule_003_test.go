package rules_test

import (
	"testing"

	advances "validators/src/internal/rules/advances"
	"validators/src/tests/fixtures"
)

func TestRuleAdv003_Execute_PaidAdvanceWithZeroAmountToPay_NotFlagged(t *testing.T) {
	ctx := fixtures.NewValidationContextBuilder().
		WithAdvanceReports(fixtures.NewAdvanceReport(fixtures.WithAdvanceID("adv-1"))).
		WithAdvanceReportReceipts(fixtures.NewAdvanceReportReceipt(
			fixtures.WithLinkAdvanceID("adv-1"), fixtures.WithLinkReceiptID("rec-1"),
		)).
		WithAdvanceReceipts(fixtures.NewAdvanceReceipt(
			fixtures.WithAdvReceiptID("rec-1"), fixtures.WithAdvReceiptAmountToPay(0),
		)).
		Build()

	result := advances.NewRuleAdv003().Execute(ctx)
	if result.Triggered {
		t.Errorf("receipt with amount_to_pay=0 must not be flagged")
	}
}

func TestRuleAdv003_Execute_PaidAdvanceWithPositiveAmountToPay_Flagged(t *testing.T) {
	ctx := fixtures.NewValidationContextBuilder().
		WithAdvanceReports(fixtures.NewAdvanceReport(
			fixtures.WithAdvanceID("adv-1"), fixtures.WithIsPaid(true),
		)).
		WithAdvanceReportReceipts(fixtures.NewAdvanceReportReceipt(
			fixtures.WithLinkAdvanceID("adv-1"), fixtures.WithLinkReceiptID("rec-1"),
		)).
		WithAdvanceReceipts(fixtures.NewAdvanceReceipt(
			fixtures.WithAdvReceiptID("rec-1"), fixtures.WithAdvReceiptAmountToPay(50.00),
		)).
		Build()

	result := advances.NewRuleAdv003().Execute(ctx)
	if !result.Triggered {
		t.Fatal("expected trigger: receipt still has amount_to_pay after paid advance")
	}
	if _, ok := result.FlaggedProposals["adv-1"]; !ok {
		t.Errorf("expected adv-1 to be flagged")
	}
}

func TestRuleAdv003_Execute_UnpaidAdvance_NotFlagged(t *testing.T) {
	ctx := fixtures.NewValidationContextBuilder().
		WithAdvanceReports(fixtures.NewAdvanceReport(
			fixtures.WithAdvanceID("adv-1"), fixtures.WithIsPaid(false),
		)).
		WithAdvanceReportReceipts(fixtures.NewAdvanceReportReceipt(
			fixtures.WithLinkAdvanceID("adv-1"), fixtures.WithLinkReceiptID("rec-1"),
		)).
		WithAdvanceReceipts(fixtures.NewAdvanceReceipt(
			fixtures.WithAdvReceiptID("rec-1"), fixtures.WithAdvReceiptAmountToPay(100.00),
		)).
		Build()

	result := advances.NewRuleAdv003().Execute(ctx)
	if result.Triggered {
		t.Errorf("unpaid advance must not trigger ADV-003")
	}
}
