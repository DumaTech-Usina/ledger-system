package proposals

import "validators/src/internal/rules"

const rule003Name = "RULE-003"

// Rule003 reports proposals that have open/defaulted installments while
// later installments have already been paid (false delinquents).
// The aggregate counts are pre-computed during enrichment.
type Rule003 struct{}

func NewRule003() *Rule003 { return &Rule003{} }

func (r *Rule003) Name() string        { return rule003Name }
func (r *Rule003) Description() string { return "Detects false delinquents: open installments with later ones already paid" }

func (r *Rule003) Execute(ctx *rules.ValidationContext) rules.RuleResult {
	flagged := make(map[string]string, len(ctx.ProposalStats.FalseDelinquentIDs))
	for _, pid := range ctx.ProposalStats.FalseDelinquentIDs {
		flagged[pid] = "open installment with later installment already paid"
	}
	return rules.RuleResult{
		RuleName:         rule003Name,
		RecordsScanned:   ctx.ProposalStats.TotalPaidProposals,
		IssuesFound:      ctx.ProposalStats.FalseDelinquentCount,
		Triggered:        ctx.ProposalStats.FalseDelinquentCount > 0,
		FlaggedProposals: flagged,
	}
}
