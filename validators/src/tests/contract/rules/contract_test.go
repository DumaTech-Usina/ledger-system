package contract_test

import (
	"testing"

	"validators/src/internal/rules"
	advanceRules "validators/src/internal/rules/advances"
	"validators/src/internal/rules/proposals"
	receiptRules "validators/src/internal/rules/receipts"
	"validators/src/tests/fixtures"
)

// verifyRuleContract asserts the invariants that every Rule implementation
// must satisfy regardless of its business logic.
func verifyRuleContract(t *testing.T, rule rules.Rule) {
	t.Helper()

	t.Run("Name is non-empty", func(t *testing.T) {
		if rule.Name() == "" {
			t.Fatal("Name() must return a non-empty string")
		}
	})

	t.Run("Description is non-empty", func(t *testing.T) {
		if rule.Description() == "" {
			t.Fatal("Description() must return a non-empty string")
		}
	})

	t.Run("Execute with empty context does not panic", func(t *testing.T) {
		ctx := fixtures.NewValidationContextBuilder().Build()
		defer func() {
			if r := recover(); r != nil {
				t.Fatalf("Execute panicked with empty context: %v", r)
			}
		}()
		result := rule.Execute(ctx)

		if result.RuleName != rule.Name() {
			t.Errorf("result.RuleName %q must equal rule.Name() %q", result.RuleName, rule.Name())
		}
	})

	t.Run("Execute is idempotent on the same context", func(t *testing.T) {
		ctx := fixtures.NewValidationContextBuilder().
			WithProposals(fixtures.ProposalList(3)...).
			WithCanonicalReceipts(fixtures.ReceiptList(3)...).
			Build()
		r1 := rule.Execute(ctx)
		r2 := rule.Execute(ctx)

		if r1.RuleName != r2.RuleName {
			t.Error("RuleName must be stable across calls")
		}
		if r1.IssuesFound != r2.IssuesFound {
			t.Error("IssuesFound must be stable across calls")
		}
		if r1.Triggered != r2.Triggered {
			t.Error("Triggered must be stable across calls")
		}
		if r1.RecordsScanned != r2.RecordsScanned {
			t.Error("RecordsScanned must be stable across calls")
		}
		if len(r1.FlaggedProposals) != len(r2.FlaggedProposals) {
			t.Error("FlaggedProposals length must be stable across calls")
		}
	})

	t.Run("Execute does not mutate the context", func(t *testing.T) {
		ctx := fixtures.NewValidationContextBuilder().
			WithProposals(fixtures.ProposalList(3)...).
			WithCanonicalReceipts(fixtures.ReceiptList(3)...).
			Build()

		beforeProposals := len(ctx.Proposals)
		beforeReceipts := len(ctx.CanonicalReceipts)
		rule.Execute(ctx)

		if len(ctx.Proposals) != beforeProposals {
			t.Errorf("Execute must not mutate Proposals: before=%d after=%d", beforeProposals, len(ctx.Proposals))
		}
		if len(ctx.CanonicalReceipts) != beforeReceipts {
			t.Errorf("Execute must not mutate CanonicalReceipts: before=%d after=%d", beforeReceipts, len(ctx.CanonicalReceipts))
		}
	})
}

func TestRule001_Contract(t *testing.T)        { verifyRuleContract(t, proposals.NewRule001()) }
func TestRule002_Contract(t *testing.T)        { verifyRuleContract(t, proposals.NewRule002()) }
func TestRule003_Contract(t *testing.T)        { verifyRuleContract(t, proposals.NewRule003()) }
func TestRule004_Contract(t *testing.T)        { verifyRuleContract(t, proposals.NewRule004()) }
func TestReceiptRule001_Contract(t *testing.T) { verifyRuleContract(t, receiptRules.NewRule001()) }

func TestRuleAdv001_Contract(t *testing.T) { verifyRuleContract(t, advanceRules.NewRuleAdv001()) }
func TestRuleAdv002_Contract(t *testing.T) { verifyRuleContract(t, advanceRules.NewRuleAdv002()) }
func TestRuleAdv003_Contract(t *testing.T) { verifyRuleContract(t, advanceRules.NewRuleAdv003()) }
func TestRuleAdv004_Contract(t *testing.T) { verifyRuleContract(t, advanceRules.NewRuleAdv004()) }
func TestRuleAdv005_Contract(t *testing.T) { verifyRuleContract(t, advanceRules.NewRuleAdv005()) }
func TestRuleAdv006_Contract(t *testing.T) { verifyRuleContract(t, advanceRules.NewRuleAdv006()) }
func TestRuleAdv007_Contract(t *testing.T) { verifyRuleContract(t, advanceRules.NewRuleAdv007()) }
func TestRuleAdv008_Contract(t *testing.T) { verifyRuleContract(t, advanceRules.NewRuleAdv008()) }
func TestRuleAdv009_Contract(t *testing.T) { verifyRuleContract(t, advanceRules.NewRuleAdv009()) }
func TestRuleAdv010_Contract(t *testing.T) { verifyRuleContract(t, advanceRules.NewRuleAdv010()) }
