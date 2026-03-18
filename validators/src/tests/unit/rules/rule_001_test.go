package rules_test

import (
	"testing"

	"validators/src/internal/domain"
	"validators/src/internal/rules/proposals"
	"validators/src/tests/fixtures"
)

func TestRule001_NoProposals(t *testing.T) {
	rule := proposals.NewRule001()
	ctx := fixtures.NewValidationContextBuilder().Build()

	result := rule.Execute(ctx)

	if result.Triggered {
		t.Error("expected no trigger with empty context")
	}
	if result.IssuesFound != 0 {
		t.Errorf("expected 0 issues, got %d", result.IssuesFound)
	}
	if result.RecordsScanned != 0 {
		t.Errorf("expected 0 scanned, got %d", result.RecordsScanned)
	}
}

func TestRule001_NoDuplicateClusters(t *testing.T) {
	rule := proposals.NewRule001()
	ctx := fixtures.NewValidationContextBuilder().
		WithProposals(
			fixtures.NewProposal(fixtures.WithID("1"), fixtures.WithNumber("123")),
			fixtures.NewProposal(fixtures.WithID("2"), fixtures.WithNumber("999")),
		).
		// No clusters — no duplicates detected during enrichment.
		Build()

	result := rule.Execute(ctx)

	if result.Triggered {
		t.Error("expected no trigger when there are no clusters")
	}
}

func TestRule001_SingleMemberClusterIgnored(t *testing.T) {
	rule := proposals.NewRule001()
	ctx := fixtures.NewValidationContextBuilder().
		WithProposals(fixtures.NewProposal()).
		WithClusters(domain.Cluster{
			ID:        "cluster-1",
			Proposals: []string{"proposal-1"}, // only one member, not a duplicate
		}).
		Build()

	result := rule.Execute(ctx)

	if result.Triggered {
		t.Error("single-member cluster must not trigger the rule")
	}
}

func TestRule001_DuplicateClusterDetected(t *testing.T) {
	rule := proposals.NewRule001()
	ctx := fixtures.NewValidationContextBuilder().
		WithProposals(
			fixtures.NewProposal(fixtures.WithID("1"), fixtures.WithNumber("123456")),
			fixtures.NewProposal(fixtures.WithID("2"), fixtures.WithNumber("0123456")),
		).
		WithClusters(
			fixtures.NewCluster(),
		).
		Build()

	result := rule.Execute(ctx)

	if !result.Triggered {
		t.Error("expected rule to be triggered")
	}
	if result.IssuesFound != 1 {
		t.Errorf("expected 1 cluster issue, got %d", result.IssuesFound)
	}
	if len(result.Details) == 0 {
		t.Error("expected at least one detail entry")
	}
}

func TestRule001_MultipleClusters(t *testing.T) {
	rule := proposals.NewRule001()
	ctx := fixtures.NewValidationContextBuilder().
		WithProposals(fixtures.ProposalList(6)...).
		WithClusters(
			domain.Cluster{ID: "c1", Proposals: []string{"p1", "p2"}, Numbers: []string{"1", "01"}},
			domain.Cluster{ID: "c2", Proposals: []string{"p3", "p4"}, Numbers: []string{"2", "02"}},
			domain.Cluster{ID: "c3", Proposals: []string{"p5", "p6"}, Numbers: []string{"3", "03"}},
		).
		Build()

	result := rule.Execute(ctx)

	if result.IssuesFound != 3 {
		t.Errorf("expected 3 cluster issues, got %d", result.IssuesFound)
	}
}

func TestRule001_RuleNameIsPreserved(t *testing.T) {
	rule := proposals.NewRule001()
	ctx := fixtures.NewValidationContextBuilder().Build()

	result := rule.Execute(ctx)

	if result.RuleName != rule.Name() {
		t.Errorf("result.RuleName %q does not match rule.Name() %q", result.RuleName, rule.Name())
	}
}
