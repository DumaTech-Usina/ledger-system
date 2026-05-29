package advances

import (
	"fmt"

	"validators/src/internal/rules"
)

const ruleAdv007Name = "RULE-ADV-007"

// RuleAdv007 detects advance reports that are simultaneously paid and cancelled,
// which is a logically impossible state indicating a race condition or partial rollback.
type RuleAdv007 struct{}

func NewRuleAdv007() *RuleAdv007 { return &RuleAdv007{} }

func (r *RuleAdv007) Name() string { return ruleAdv007Name }
func (r *RuleAdv007) Description() string {
	return "Detects advance reports that are simultaneously paid and cancelled"
}

func (r *RuleAdv007) Execute(ctx *rules.ValidationContext) rules.RuleResult {
	result := rules.RuleResult{
		RuleName:         ruleAdv007Name,
		RecordsScanned:   len(ctx.AdvanceReports),
		FlaggedProposals: make(map[string]string),
	}

	for _, ar := range ctx.AdvanceReports {
		if ar.IsPaid && ar.IsCancelled {
			result.IssuesFound++
			result.FlaggedProposals[ar.ID] = "advance report is simultaneously paid and cancelled"
			result.Details = append(result.Details,
				fmt.Sprintf("advance %s: is_paid=true and is_cancelled=true", ar.ID))
		}
	}

	result.Triggered = result.IssuesFound > 0
	return result
}
