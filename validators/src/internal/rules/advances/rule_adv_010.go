package advances

import (
	"fmt"

	"validators/src/internal/rules"
)

const ruleAdv010Name = "RULE-ADV-010"

// RuleAdv010 detects cases where the same receipt appears more than once within
// the same advance report, indicating a deduplication failure or retry error.
type RuleAdv010 struct{}

func NewRuleAdv010() *RuleAdv010 { return &RuleAdv010{} }

func (r *RuleAdv010) Name() string { return ruleAdv010Name }
func (r *RuleAdv010) Description() string {
	return "Detects advance reports that contain the same receipt more than once"
}

func (r *RuleAdv010) Execute(ctx *rules.ValidationContext) rules.RuleResult {
	result := rules.RuleResult{
		RuleName:         ruleAdv010Name,
		RecordsScanned:   len(ctx.AdvanceReportReceipts),
		FlaggedProposals: make(map[string]string),
	}

	type key struct{ advanceID, receiptID string }
	counts := make(map[key]int, len(ctx.AdvanceReportReceipts))
	for _, link := range ctx.AdvanceReportReceipts {
		counts[key{link.AdvanceReportID, link.ReceiptID}]++
	}

	for k, count := range counts {
		if count <= 1 {
			continue
		}
		result.IssuesFound++
		result.FlaggedProposals[k.advanceID] = fmt.Sprintf(
			"receipt %s appears %d times in the same advance report", k.receiptID, count)
		result.Details = append(result.Details,
			fmt.Sprintf("advance %s: receipt %s duplicated %d times", k.advanceID, k.receiptID, count))
	}

	result.Triggered = result.IssuesFound > 0
	return result
}
