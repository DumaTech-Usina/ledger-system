package rules_test

import (
	"testing"

	receiptRules "validators/src/internal/rules/receipts"
	"validators/src/tests/fixtures"
)

func TestReceiptRule002_EmptyContext(t *testing.T) {
	rule := receiptRules.NewRule002()
	ctx := fixtures.NewValidationContextBuilder().Build()

	result := rule.Execute(ctx)

	if result.Triggered {
		t.Error("expected no trigger with empty context")
	}
	if result.RecordsScanned != 0 {
		t.Errorf("expected 0 scanned, got %d", result.RecordsScanned)
	}
}

func TestReceiptRule002_CleanReceipt_NotBaixado(t *testing.T) {
	rule := receiptRules.NewRule002()
	ctx := fixtures.NewValidationContextBuilder().
		WithCanonicalReceipts(
			fixtures.NewReceipt(
				fixtures.WithReceiptID("r1"),
				fixtures.WithReceiptStatus("LIQUIDADO"),
				fixtures.WithReceiptInstallmentPercentage(5.0),
				fixtures.WithReceiptAmountToPay(0),
			),
		).
		Build()

	result := rule.Execute(ctx)

	if result.Triggered {
		t.Error("receipt not BAIXADO must not be flagged")
	}
}

func TestReceiptRule002_CleanReceipt_NoInstallmentPercentage(t *testing.T) {
	rule := receiptRules.NewRule002()
	ctx := fixtures.NewValidationContextBuilder().
		WithCanonicalReceipts(
			fixtures.NewReceipt(
				fixtures.WithReceiptID("r1"),
				fixtures.WithReceiptStatus("BAIXADO"),
				fixtures.WithReceiptInstallmentPercentage(0),
				fixtures.WithReceiptAmountToPay(0),
			),
		).
		Build()

	result := rule.Execute(ctx)

	if result.Triggered {
		t.Error("receipt with installment_percentage = 0 must not be flagged")
	}
}

func TestReceiptRule002_CleanReceipt_HasPositiveAmountToPay(t *testing.T) {
	rule := receiptRules.NewRule002()
	ctx := fixtures.NewValidationContextBuilder().
		WithCanonicalReceipts(
			fixtures.NewReceipt(
				fixtures.WithReceiptID("r1"),
				fixtures.WithReceiptStatus("BAIXADO"),
				fixtures.WithReceiptInstallmentPercentage(5.0),
				fixtures.WithReceiptAmountToPay(1000.00),
			),
		).
		Build()

	result := rule.Execute(ctx)

	if result.Triggered {
		t.Error("receipt with amount_to_pay > 0 is settled via pending balance and must not be flagged")
	}
}

func TestReceiptRule002_CleanReceipt_HasActiveCompensationLink(t *testing.T) {
	rule := receiptRules.NewRule002()
	ctx := fixtures.NewValidationContextBuilder().
		WithCanonicalReceipts(
			fixtures.NewReceipt(
				fixtures.WithReceiptID("r1"),
				fixtures.WithReceiptStatus("BAIXADO"),
				fixtures.WithReceiptInstallmentPercentage(5.0),
				fixtures.WithReceiptAmountToPay(0),
			),
		).
		WithAdvanceReportReceipts(
			fixtures.NewAdvanceReportReceipt(
				fixtures.WithLinkReceiptID("r1"),
			),
		).
		Build()

	result := rule.Execute(ctx)

	if result.Triggered {
		t.Error("receipt with active advance_report_receipts link must not be flagged")
	}
}

func TestReceiptRule002_SuspiciousReceipt_NoCompensation(t *testing.T) {
	rule := receiptRules.NewRule002()
	ctx := fixtures.NewValidationContextBuilder().
		WithCanonicalReceipts(
			fixtures.NewReceipt(
				fixtures.WithReceiptID("r1"),
				fixtures.WithReceiptStatus("BAIXADO"),
				fixtures.WithReceiptInstallmentPercentage(5.0),
				fixtures.WithReceiptAmountToPay(0),
			),
		).
		Build()

	result := rule.Execute(ctx)

	if !result.Triggered {
		t.Error("expected trigger: BAIXADO + installment_percentage > 0 + amount_to_pay = 0 + no active link")
	}
	if result.IssuesFound != 1 {
		t.Errorf("expected 1 issue, got %d", result.IssuesFound)
	}
	if _, flagged := result.FlaggedProposals["r1"]; !flagged {
		t.Error("expected r1 to be flagged")
	}
}

func TestReceiptRule002_SuspiciousReceipt_InactiveLinkOnly(t *testing.T) {
	rule := receiptRules.NewRule002()
	ctx := fixtures.NewValidationContextBuilder().
		WithCanonicalReceipts(
			fixtures.NewReceipt(
				fixtures.WithReceiptID("r1"),
				fixtures.WithReceiptStatus("BAIXADO"),
				fixtures.WithReceiptInstallmentPercentage(5.0),
				fixtures.WithReceiptAmountToPay(0),
			),
		).
		WithAdvanceReportReceipts(
			// inactive link — should not count as valid compensation
			fixtures.NewAdvanceReportReceipt(
				fixtures.WithLinkReceiptID("r1"),
				fixtures.WithLinkIsActive(false),
			),
		).
		Build()

	result := rule.Execute(ctx)

	if !result.Triggered {
		t.Error("inactive link must not satisfy compensation requirement")
	}
	if _, flagged := result.FlaggedProposals["r1"]; !flagged {
		t.Error("expected r1 to be flagged")
	}
}

func TestReceiptRule002_MixedReceipts(t *testing.T) {
	rule := receiptRules.NewRule002()
	ctx := fixtures.NewValidationContextBuilder().
		WithCanonicalReceipts(
			// suspicious: BAIXADO + commission + zero balance + no link
			fixtures.NewReceipt(
				fixtures.WithReceiptID("bad-1"),
				fixtures.WithReceiptStatus("BAIXADO"),
				fixtures.WithReceiptInstallmentPercentage(5.0),
				fixtures.WithReceiptAmountToPay(0),
			),
			// clean: BAIXADO + commission + zero balance + active link
			fixtures.NewReceipt(
				fixtures.WithReceiptID("ok-1"),
				fixtures.WithReceiptStatus("BAIXADO"),
				fixtures.WithReceiptInstallmentPercentage(5.0),
				fixtures.WithReceiptAmountToPay(0),
			),
			// clean: not BAIXADO
			fixtures.NewReceipt(
				fixtures.WithReceiptID("ok-2"),
				fixtures.WithReceiptStatus("LIQUIDADO"),
				fixtures.WithReceiptInstallmentPercentage(5.0),
				fixtures.WithReceiptAmountToPay(0),
			),
			// clean: has positive balance
			fixtures.NewReceipt(
				fixtures.WithReceiptID("ok-3"),
				fixtures.WithReceiptStatus("BAIXADO"),
				fixtures.WithReceiptInstallmentPercentage(5.0),
				fixtures.WithReceiptAmountToPay(500.00),
			),
		).
		WithAdvanceReportReceipts(
			fixtures.NewAdvanceReportReceipt(fixtures.WithLinkReceiptID("ok-1")),
		).
		Build()

	result := rule.Execute(ctx)

	if !result.Triggered {
		t.Error("expected trigger")
	}
	if result.IssuesFound != 1 {
		t.Errorf("expected 1 issue, got %d", result.IssuesFound)
	}
	if result.RecordsScanned != 4 {
		t.Errorf("expected 4 scanned, got %d", result.RecordsScanned)
	}
	if _, flagged := result.FlaggedProposals["bad-1"]; !flagged {
		t.Error("expected bad-1 to be flagged")
	}
	for _, id := range []string{"ok-1", "ok-2", "ok-3"} {
		if _, flagged := result.FlaggedProposals[id]; flagged {
			t.Errorf("%s must not be flagged", id)
		}
	}
}

func TestReceiptRule002_RuleNameIsPreserved(t *testing.T) {
	rule := receiptRules.NewRule002()
	ctx := fixtures.NewValidationContextBuilder().Build()

	result := rule.Execute(ctx)

	if result.RuleName != rule.Name() {
		t.Errorf("result.RuleName %q does not match rule.Name() %q", result.RuleName, rule.Name())
	}
}
