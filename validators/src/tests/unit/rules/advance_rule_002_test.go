package rules_test

import (
	"testing"

	advances "validators/src/internal/rules/advances"
	"validators/src/tests/fixtures"
)

func TestRuleAdv002_Execute_NoneLinkedToSuspect_NotFlagged(t *testing.T) {
	ctx := fixtures.NewValidationContextBuilder().
		WithAdvanceReports(fixtures.NewAdvanceReport()).
		WithAdvanceReportReceipts(fixtures.NewAdvanceReportReceipt()).
		WithAdvanceReceipts(fixtures.NewAdvanceReceipt(fixtures.WithAdvReceiptProposalID("proposal-clean"))).
		Build() // SuspectProposalIDs is empty

	result := advances.NewRuleAdv002().Execute(ctx)
	if result.Triggered {
		t.Errorf("expected no trigger when no suspect proposals")
	}
}

func TestRuleAdv002_Execute_LinkedToSuspectProposal_Flagged(t *testing.T) {
	ctx := fixtures.NewValidationContextBuilder().
		WithAdvanceReports(fixtures.NewAdvanceReport(fixtures.WithAdvanceID("adv-1"))).
		WithAdvanceReportReceipts(
			fixtures.NewAdvanceReportReceipt(
				fixtures.WithLinkAdvanceID("adv-1"),
				fixtures.WithLinkReceiptID("rec-1"),
			),
		).
		WithAdvanceReceipts(
			fixtures.NewAdvanceReceipt(
				fixtures.WithAdvReceiptID("rec-1"),
				fixtures.WithAdvReceiptProposalID("proposal-bad"),
			),
		).
		WithSuspectProposalIDs("proposal-bad").
		Build()

	result := advances.NewRuleAdv002().Execute(ctx)
	if !result.Triggered {
		t.Fatal("expected rule to trigger for suspect proposal link")
	}
	if _, ok := result.FlaggedProposals["adv-1"]; !ok {
		t.Errorf("expected adv-1 to be flagged")
	}
}

func TestRuleAdv002_Execute_EmptyLinks_NotFlagged(t *testing.T) {
	ctx := fixtures.NewValidationContextBuilder().
		WithAdvanceReports(fixtures.NewAdvanceReport()).
		WithSuspectProposalIDs("proposal-bad").
		Build()

	result := advances.NewRuleAdv002().Execute(ctx)
	if result.Triggered {
		t.Errorf("expected no trigger when no receipt links exist")
	}
}

func TestRuleAdv002_Execute_ReceiptNotInIndex_NotFlagged(t *testing.T) {
	// Link references a receipt that isn't in AdvanceReceipts — no crash, no flag.
	ctx := fixtures.NewValidationContextBuilder().
		WithAdvanceReportReceipts(
			fixtures.NewAdvanceReportReceipt(fixtures.WithLinkReceiptID("unknown-receipt")),
		).
		WithSuspectProposalIDs("proposal-bad").
		Build()

	result := advances.NewRuleAdv002().Execute(ctx)
	if result.Triggered {
		t.Errorf("unknown receipt must not cause a false positive")
	}
}
