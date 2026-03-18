package rules_test

import (
	"testing"

	"validators/src/internal/domain"
	"validators/src/internal/rules/proposals"
	"validators/src/tests/fixtures"
)

func TestRule002_NoClusters(t *testing.T) {
	rule := proposals.NewRule002()
	ctx := fixtures.NewValidationContextBuilder().Build()

	result := rule.Execute(ctx)

	if result.Triggered {
		t.Error("expected no trigger with no clusters")
	}
	if result.RecordsScanned != 0 {
		t.Errorf("expected 0 scanned, got %d", result.RecordsScanned)
	}
}

func TestRule002_DifferentInstallments_NoDoublePayment(t *testing.T) {
	rule := proposals.NewRule002()
	ctx := fixtures.NewValidationContextBuilder().
		WithClusters(fixtures.NewCluster()).
		WithReceipts("cluster-1",
			// installment 1 for proposal-1, installment 2 for proposal-2 — no overlap
			fixtures.NewReceipt(fixtures.WithReceiptID("r1"), fixtures.WithProposalID("proposal-1"), fixtures.WithInstallmentNumber(1)),
			fixtures.NewReceipt(fixtures.WithReceiptID("r2"), fixtures.WithProposalID("proposal-2"), fixtures.WithInstallmentNumber(2)),
		).
		Build()

	result := rule.Execute(ctx)

	if result.Triggered {
		t.Error("expected no double payment when installments differ")
	}
}

func TestRule002_SameInstallment_DoublePaymentDetected(t *testing.T) {
	rule := proposals.NewRule002()
	ctx := fixtures.NewValidationContextBuilder().
		WithClusters(fixtures.NewCluster()).
		WithReceipts("cluster-1",
			// Both proposals paid installment 1 — this is the anomaly
			fixtures.NewReceipt(
				fixtures.WithReceiptID("r1"),
				fixtures.WithProposalID("proposal-1"),
				fixtures.WithInstallmentNumber(1),
				fixtures.WithProposalNumber("123456"),
			),
			fixtures.NewReceipt(
				fixtures.WithReceiptID("r2"),
				fixtures.WithProposalID("proposal-2"),
				fixtures.WithInstallmentNumber(1),
				fixtures.WithProposalNumber("0123456"),
			),
		).
		Build()

	result := rule.Execute(ctx)

	if !result.Triggered {
		t.Error("expected double payment to be detected")
	}
	if result.IssuesFound != 1 {
		t.Errorf("expected 1 double payment, got %d", result.IssuesFound)
	}
}

func TestRule002_MultipleDoublesAcrossClusters(t *testing.T) {
	rule := proposals.NewRule002()
	ctx := fixtures.NewValidationContextBuilder().
		WithClusters(
			domain.Cluster{ID: "c1", Proposals: []string{"p1", "p2"}},
			domain.Cluster{ID: "c2", Proposals: []string{"p3", "p4"}},
		).
		WithReceipts("c1",
			fixtures.NewReceipt(fixtures.WithProposalID("p1"), fixtures.WithInstallmentNumber(1)),
			fixtures.NewReceipt(fixtures.WithProposalID("p2"), fixtures.WithInstallmentNumber(1)),
		).
		WithReceipts("c2",
			fixtures.NewReceipt(fixtures.WithProposalID("p3"), fixtures.WithInstallmentNumber(2)),
			fixtures.NewReceipt(fixtures.WithProposalID("p4"), fixtures.WithInstallmentNumber(2)),
		).
		Build()

	result := rule.Execute(ctx)

	if result.IssuesFound != 2 {
		t.Errorf("expected 2 double payments (one per cluster), got %d", result.IssuesFound)
	}
}
