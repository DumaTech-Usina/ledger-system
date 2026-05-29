package advances

import (
	"fmt"

	"validators/src/internal/rules"
)

const ruleAdv005Name = "RULE-ADV-005"

// RuleAdv005 detects advance reports that have no active receipt links,
// which indicates an orphaned or partially-created advance.
type RuleAdv005 struct{}

func NewRuleAdv005() *RuleAdv005 { return &RuleAdv005{} }

func (r *RuleAdv005) Name() string { return ruleAdv005Name }
func (r *RuleAdv005) Description() string {
	return "Detects advance reports with no active receipt links"
}

func (r *RuleAdv005) Execute(ctx *rules.ValidationContext) rules.RuleResult {
	result := rules.RuleResult{
		RuleName:         ruleAdv005Name,
		RecordsScanned:   len(ctx.AdvanceReports),
		FlaggedProposals: make(map[string]string),
	}

	hasReceipts := make(map[string]bool, len(ctx.AdvanceReportReceipts))
	for _, link := range ctx.AdvanceReportReceipts {
		hasReceipts[link.AdvanceReportID] = true
	}

	for _, ar := range ctx.AdvanceReports {
		if !hasReceipts[ar.ID] {
			result.IssuesFound++
			result.FlaggedProposals[ar.ID] = "advance report has no active receipt links"
			result.Details = append(result.Details,
				fmt.Sprintf("advance %s: no active receipt links found", ar.ID))
		}
	}

	result.Triggered = result.IssuesFound > 0
	return result
}
