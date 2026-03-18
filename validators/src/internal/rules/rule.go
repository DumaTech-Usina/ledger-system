package rules

// Rule is the strategy interface for every validation rule.
// Each implementation must be fully independent: no cross-rule calls,
// no database access, operates exclusively on the ValidationContext.
type Rule interface {
	Name() string
	Description() string
	Execute(ctx *ValidationContext) RuleResult
}

// RuleResult is the output produced by a single rule execution.
type RuleResult struct {
	RuleName       string
	RecordsScanned int
	IssuesFound    int
	Triggered      bool
	Details        []string

	// FlaggedProposals maps each individually flagged proposal ID to the
	// human-readable reason this rule raised a violation for it.
	// Every rule must populate this — it is the source for the canonical
	// per-proposal verdict stored in MongoDB.
	FlaggedProposals map[string]string // proposalID → reason
}
