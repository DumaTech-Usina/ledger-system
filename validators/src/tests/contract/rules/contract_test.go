package contract_test

import (
	"testing"

	"validators/src/internal/rules"
	"validators/src/internal/rules/proposals"
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
		ctx := fixtures.NewValidationContextBuilder().Build()
		r1 := rule.Execute(ctx)
		r2 := rule.Execute(ctx)

		if r1.RuleName != r2.RuleName || r1.IssuesFound != r2.IssuesFound {
			t.Error("two calls with the same context must return the same result")
		}
	})

	t.Run("Execute does not mutate the context", func(t *testing.T) {
		ctx := fixtures.NewValidationContextBuilder().
			WithProposals(fixtures.ProposalList(3)...).
			Build()

		before := len(ctx.Proposals)
		rule.Execute(ctx)
		after := len(ctx.Proposals)

		if before != after {
			t.Errorf("Execute must not mutate Proposals: before=%d after=%d", before, after)
		}
	})
}

func TestRule001_Contract(t *testing.T) { verifyRuleContract(t, proposals.NewRule001()) }
func TestRule002_Contract(t *testing.T) { verifyRuleContract(t, proposals.NewRule002()) }
func TestRule003_Contract(t *testing.T) { verifyRuleContract(t, proposals.NewRule003()) }
func TestRule004_Contract(t *testing.T) { verifyRuleContract(t, proposals.NewRule004()) }
