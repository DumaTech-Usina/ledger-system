package rules_test

import (
	"testing"

	receiptRules "validators/src/internal/rules/receipts"
	"validators/src/tests/fixtures"
)

func TestReceiptRule001_EmptyContext(t *testing.T) {
	rule := receiptRules.NewRule001()
	ctx := fixtures.NewValidationContextBuilder().Build()

	result := rule.Execute(ctx)

	if result.Triggered {
		t.Error("expected no trigger with empty context")
	}
	if result.RecordsScanned != 0 {
		t.Errorf("expected 0 scanned, got %d", result.RecordsScanned)
	}
	if result.IssuesFound != 0 {
		t.Errorf("expected 0 issues, got %d", result.IssuesFound)
	}
}

func TestReceiptRule001_AllValidValues(t *testing.T) {
	rule := receiptRules.NewRule001()
	ctx := fixtures.NewValidationContextBuilder().
		WithCanonicalReceipts(
			fixtures.NewReceipt(fixtures.WithReceiptID("r1"), fixtures.WithDownloadedValue("1000.00")),
			fixtures.NewReceipt(fixtures.WithReceiptID("r2"), fixtures.WithDownloadedValue("54.90")),
			fixtures.NewReceipt(fixtures.WithReceiptID("r3"), fixtures.WithDownloadedValue("0.01")),
			fixtures.NewReceipt(fixtures.WithReceiptID("r4"), fixtures.WithDownloadedValue("99999.99")),
		).
		Build()

	result := rule.Execute(ctx)

	if result.Triggered {
		t.Error("expected no trigger: all values are valid monetary format")
	}
	if result.IssuesFound != 0 {
		t.Errorf("expected 0 issues, got %d", result.IssuesFound)
	}
	if result.RecordsScanned != 4 {
		t.Errorf("expected 4 scanned, got %d", result.RecordsScanned)
	}
}

func TestReceiptRule001_MissingDecimalPart(t *testing.T) {
	rule := receiptRules.NewRule001()
	ctx := fixtures.NewValidationContextBuilder().
		WithCanonicalReceipts(
			fixtures.NewReceipt(fixtures.WithReceiptID("r1"), fixtures.WithDownloadedValue("1000")),
		).
		Build()

	result := rule.Execute(ctx)

	if !result.Triggered {
		t.Error("expected trigger: value has no decimal part")
	}
	if _, flagged := result.FlaggedProposals["r1"]; !flagged {
		t.Error("expected receipt r1 to be in FlaggedProposals")
	}
}

func TestReceiptRule001_OneDecimalPlace(t *testing.T) {
	rule := receiptRules.NewRule001()
	ctx := fixtures.NewValidationContextBuilder().
		WithCanonicalReceipts(
			fixtures.NewReceipt(fixtures.WithReceiptID("r1"), fixtures.WithDownloadedValue("54.9")),
		).
		Build()

	result := rule.Execute(ctx)

	if !result.Triggered {
		t.Error("expected trigger: only one decimal place")
	}
	if _, flagged := result.FlaggedProposals["r1"]; !flagged {
		t.Error("expected receipt r1 to be flagged")
	}
}

func TestReceiptRule001_ThreeDecimalPlaces(t *testing.T) {
	rule := receiptRules.NewRule001()
	ctx := fixtures.NewValidationContextBuilder().
		WithCanonicalReceipts(
			fixtures.NewReceipt(fixtures.WithReceiptID("r1"), fixtures.WithDownloadedValue("54.900")),
		).
		Build()

	result := rule.Execute(ctx)

	if !result.Triggered {
		t.Error("expected trigger: three decimal places")
	}
	if _, flagged := result.FlaggedProposals["r1"]; !flagged {
		t.Error("expected receipt r1 to be flagged")
	}
}

func TestReceiptRule001_EmptyString(t *testing.T) {
	rule := receiptRules.NewRule001()
	ctx := fixtures.NewValidationContextBuilder().
		WithCanonicalReceipts(
			fixtures.NewReceipt(fixtures.WithReceiptID("r1"), fixtures.WithDownloadedValue("")),
		).
		Build()

	result := rule.Execute(ctx)

	if !result.Triggered {
		t.Error("expected trigger: empty downloaded_value")
	}
}

func TestReceiptRule001_NegativeValue(t *testing.T) {
	rule := receiptRules.NewRule001()
	ctx := fixtures.NewValidationContextBuilder().
		WithCanonicalReceipts(
			fixtures.NewReceipt(fixtures.WithReceiptID("r1"), fixtures.WithDownloadedValue("-100.00")),
		).
		Build()

	result := rule.Execute(ctx)

	if !result.Triggered {
		t.Error("expected trigger: negative monetary value is suspicious")
	}
}

func TestReceiptRule001_MixedValidAndSuspicious(t *testing.T) {
	rule := receiptRules.NewRule001()
	ctx := fixtures.NewValidationContextBuilder().
		WithCanonicalReceipts(
			fixtures.NewReceipt(fixtures.WithReceiptID("clean-1"), fixtures.WithDownloadedValue("500.00")),
			fixtures.NewReceipt(fixtures.WithReceiptID("bad-1"), fixtures.WithDownloadedValue("500.0")),
			fixtures.NewReceipt(fixtures.WithReceiptID("clean-2"), fixtures.WithDownloadedValue("12.50")),
			fixtures.NewReceipt(fixtures.WithReceiptID("bad-2"), fixtures.WithDownloadedValue("12")),
		).
		Build()

	result := rule.Execute(ctx)

	if !result.Triggered {
		t.Error("expected trigger: two suspicious values present")
	}
	if result.IssuesFound != 2 {
		t.Errorf("expected 2 issues, got %d", result.IssuesFound)
	}
	if result.RecordsScanned != 4 {
		t.Errorf("expected 4 scanned, got %d", result.RecordsScanned)
	}
	if _, flagged := result.FlaggedProposals["bad-1"]; !flagged {
		t.Error("expected bad-1 to be flagged")
	}
	if _, flagged := result.FlaggedProposals["bad-2"]; !flagged {
		t.Error("expected bad-2 to be flagged")
	}
	if _, flagged := result.FlaggedProposals["clean-1"]; flagged {
		t.Error("clean-1 must not be flagged")
	}
	if _, flagged := result.FlaggedProposals["clean-2"]; flagged {
		t.Error("clean-2 must not be flagged")
	}
}

func TestReceiptRule001_RuleNameIsPreserved(t *testing.T) {
	rule := receiptRules.NewRule001()
	ctx := fixtures.NewValidationContextBuilder().Build()

	result := rule.Execute(ctx)

	if result.RuleName != rule.Name() {
		t.Errorf("result.RuleName %q does not match rule.Name() %q", result.RuleName, rule.Name())
	}
}
