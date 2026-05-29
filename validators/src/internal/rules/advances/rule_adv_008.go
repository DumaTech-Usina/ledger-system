package advances

import (
	"fmt"

	"validators/src/internal/rules"
)

const ruleAdv008Name = "RULE-ADV-008"

// RuleAdv008 detects advance reports with a negative advance_fee, which indicates
// financial corruption, overflow, or calculation error.
type RuleAdv008 struct{}

func NewRuleAdv008() *RuleAdv008 { return &RuleAdv008{} }

func (r *RuleAdv008) Name() string { return ruleAdv008Name }
func (r *RuleAdv008) Description() string {
	return "Detects advance reports with a negative advance_fee"
}

func (r *RuleAdv008) Execute(ctx *rules.ValidationContext) rules.RuleResult {
	result := rules.RuleResult{
		RuleName:         ruleAdv008Name,
		RecordsScanned:   len(ctx.AdvanceReports),
		FlaggedProposals: make(map[string]string),
	}

	for _, ar := range ctx.AdvanceReports {
		if ar.AdvanceFee < 0 {
			result.IssuesFound++
			result.FlaggedProposals[ar.ID] = fmt.Sprintf("advance_fee is negative: %.4f", ar.AdvanceFee)
			result.Details = append(result.Details,
				fmt.Sprintf("advance %s: advance_fee=%.4f", ar.ID, ar.AdvanceFee))
		}
	}

	result.Triggered = result.IssuesFound > 0
	return result
}
