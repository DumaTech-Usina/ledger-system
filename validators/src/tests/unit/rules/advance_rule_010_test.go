package rules_test

import (
	"testing"

	advances "validators/src/internal/rules/advances"
	"validators/src/tests/fixtures"
)

func TestRuleAdv010_Execute_UniqueReceipts_NotFlagged(t *testing.T) {
	ctx := fixtures.NewValidationContextBuilder().
		WithAdvanceReportReceipts(
			fixtures.NewAdvanceReportReceipt(fixtures.WithLinkAdvanceID("adv-1"), fixtures.WithLinkReceiptID("rec-1")),
			fixtures.NewAdvanceReportReceipt(fixtures.WithLinkAdvanceID("adv-1"), fixtures.WithLinkReceiptID("rec-2")),
		).
		Build()

	result := advances.NewRuleAdv010().Execute(ctx)
	if result.Triggered {
		t.Errorf("unique receipts in same advance must not be flagged")
	}
}

func TestRuleAdv010_Execute_DuplicateReceiptInSameAdvance_Flagged(t *testing.T) {
	ctx := fixtures.NewValidationContextBuilder().
		WithAdvanceReportReceipts(
			fixtures.NewAdvanceReportReceipt(fixtures.WithLinkAdvanceID("adv-1"), fixtures.WithLinkReceiptID("rec-1")),
			fixtures.NewAdvanceReportReceipt(fixtures.WithLinkAdvanceID("adv-1"), fixtures.WithLinkReceiptID("rec-1")),
		).
		Build()

	result := advances.NewRuleAdv010().Execute(ctx)
	if !result.Triggered {
		t.Fatal("expected trigger: duplicate receipt in same advance")
	}
	if _, ok := result.FlaggedProposals["adv-1"]; !ok {
		t.Errorf("expected adv-1 to be flagged")
	}
}

func TestRuleAdv010_Execute_SameReceiptInDifferentAdvances_NotFlagged(t *testing.T) {
	// Same receipt ID, different advances — not a duplicate within the same advance.
	ctx := fixtures.NewValidationContextBuilder().
		WithAdvanceReportReceipts(
			fixtures.NewAdvanceReportReceipt(fixtures.WithLinkAdvanceID("adv-1"), fixtures.WithLinkReceiptID("rec-1")),
			fixtures.NewAdvanceReportReceipt(fixtures.WithLinkAdvanceID("adv-2"), fixtures.WithLinkReceiptID("rec-1")),
		).
		Build()

	result := advances.NewRuleAdv010().Execute(ctx)
	if result.Triggered {
		t.Errorf("same receipt in different advances is ADV-004's concern, not ADV-010")
	}
}

func TestRuleAdv010_Execute_EmptyLinks_NotFlagged(t *testing.T) {
	ctx := fixtures.NewValidationContextBuilder().Build()
	result := advances.NewRuleAdv010().Execute(ctx)
	if result.Triggered {
		t.Errorf("empty context must not trigger")
	}
}
