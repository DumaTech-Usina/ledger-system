package proposals

import "validators/src/internal/rules"

const rule004Name = "RULE-004"

// Rule004 detects proposals with null, empty, or zero-filled numbers.
// The aggregate counts are pre-computed during enrichment.
type Rule004 struct{}

func NewRule004() *Rule004 { return &Rule004{} }

func (r *Rule004) Name() string        { return rule004Name }
func (r *Rule004) Description() string { return "Detects proposals with invalid numbering (null, empty, or zero-filled)" }

func (r *Rule004) Execute(ctx *rules.ValidationContext) rules.RuleResult {
	flagged := make(map[string]string, len(ctx.ProposalStats.InvalidNumberIDs))
	for _, pid := range ctx.ProposalStats.InvalidNumberIDs {
		flagged[pid] = "proposal number is null, empty, or zero-filled"
	}
	return rules.RuleResult{
		RuleName:         rule004Name,
		RecordsScanned:   ctx.ProposalStats.TotalProposals,
		IssuesFound:      ctx.ProposalStats.InvalidNumberCount,
		Triggered:        ctx.ProposalStats.InvalidNumberCount > 0,
		FlaggedProposals: flagged,
	}
}
