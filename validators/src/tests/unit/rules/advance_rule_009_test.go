package rules_test

import (
	"testing"

	advances "validators/src/internal/rules/advances"
	"validators/src/tests/fixtures"
)

func TestRuleAdv009_Execute_SameBroker_NotFlagged(t *testing.T) {
	ctx := fixtures.NewValidationContextBuilder().
		WithAdvanceReports(fixtures.NewAdvanceReport(
			fixtures.WithAdvanceID("adv-1"), fixtures.WithAdvanceBrokerID("broker-1"),
		)).
		WithAdvanceReportReceipts(fixtures.NewAdvanceReportReceipt(
			fixtures.WithLinkAdvanceID("adv-1"), fixtures.WithLinkReceiptID("rec-1"),
		)).
		WithAdvanceReceipts(fixtures.NewAdvanceReceipt(
			fixtures.WithAdvReceiptID("rec-1"), fixtures.WithAdvReceiptBrokerID("broker-1"),
		)).
		Build()

	result := advances.NewRuleAdv009().Execute(ctx)
	if result.Triggered {
		t.Errorf("same broker on advance and receipt must not be flagged")
	}
}

func TestRuleAdv009_Execute_DifferentBroker_Flagged(t *testing.T) {
	ctx := fixtures.NewValidationContextBuilder().
		WithAdvanceReports(fixtures.NewAdvanceReport(
			fixtures.WithAdvanceID("adv-1"), fixtures.WithAdvanceBrokerID("broker-1"),
		)).
		WithAdvanceReportReceipts(fixtures.NewAdvanceReportReceipt(
			fixtures.WithLinkAdvanceID("adv-1"), fixtures.WithLinkReceiptID("rec-1"),
		)).
		WithAdvanceReceipts(fixtures.NewAdvanceReceipt(
			fixtures.WithAdvReceiptID("rec-1"), fixtures.WithAdvReceiptBrokerID("broker-2"),
		)).
		Build()

	result := advances.NewRuleAdv009().Execute(ctx)
	if !result.Triggered {
		t.Fatal("expected trigger: broker mismatch between advance and receipt")
	}
	if _, ok := result.FlaggedProposals["adv-1"]; !ok {
		t.Errorf("expected adv-1 to be flagged")
	}
}

func TestRuleAdv009_Execute_EmptyBrokerID_NotFlagged(t *testing.T) {
	// When broker_id is not present on either side, the rule must not flag.
	ctx := fixtures.NewValidationContextBuilder().
		WithAdvanceReports(fixtures.NewAdvanceReport(
			fixtures.WithAdvanceID("adv-1"), fixtures.WithAdvanceBrokerID(""),
		)).
		WithAdvanceReportReceipts(fixtures.NewAdvanceReportReceipt(
			fixtures.WithLinkAdvanceID("adv-1"), fixtures.WithLinkReceiptID("rec-1"),
		)).
		WithAdvanceReceipts(fixtures.NewAdvanceReceipt(
			fixtures.WithAdvReceiptID("rec-1"), fixtures.WithAdvReceiptBrokerID(""),
		)).
		Build()

	result := advances.NewRuleAdv009().Execute(ctx)
	if result.Triggered {
		t.Errorf("missing broker IDs must not be flagged as mismatch")
	}
}
