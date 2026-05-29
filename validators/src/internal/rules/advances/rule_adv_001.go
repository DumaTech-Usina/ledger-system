package advances

import (
	"fmt"
	"math"

	"validators/src/internal/rules"
)

const ruleAdv001Name = "RULE-ADV-001"

// RuleAdv001 detects paid advance reports whose amount_to_pay has more than
// two decimal places, which indicates a rounding or calculation error.
type RuleAdv001 struct{}

func NewRuleAdv001() *RuleAdv001 { return &RuleAdv001{} }

func (r *RuleAdv001) Name() string { return ruleAdv001Name }
func (r *RuleAdv001) Description() string {
	return "Detects paid advance reports with invalid monetary precision in amount_to_pay"
}

func (r *RuleAdv001) Execute(ctx *rules.ValidationContext) rules.RuleResult {
	result := rules.RuleResult{
		RuleName:         ruleAdv001Name,
		RecordsScanned:   len(ctx.AdvanceReports),
		FlaggedProposals: make(map[string]string),
	}

	for _, ar := range ctx.AdvanceReports {
		if !ar.IsPaid {
			continue
		}
		rounded := math.Round(ar.AmountToPay*100) / 100
		if math.Abs(ar.AmountToPay-rounded) > 1e-9 {
			result.IssuesFound++
			result.Details = append(result.Details,
				fmt.Sprintf("advance %s: amount_to_pay=%v has more than 2 decimal places", ar.ID, ar.AmountToPay))
			result.FlaggedProposals[ar.ID] = fmt.Sprintf("amount_to_pay %v has invalid monetary precision", ar.AmountToPay)
		}
	}

	result.Triggered = result.IssuesFound > 0
	return result
}
