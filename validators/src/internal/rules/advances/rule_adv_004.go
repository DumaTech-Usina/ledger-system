package advances

import (
	"fmt"

	"validators/src/internal/rules"
)

const ruleAdv004Name = "RULE-ADV-004"

// RuleAdv004 detects receipts that appear in more than one paid advance report,
// which indicates a duplicate payment or re-processing error.
type RuleAdv004 struct{}

func NewRuleAdv004() *RuleAdv004 { return &RuleAdv004{} }

func (r *RuleAdv004) Name() string { return ruleAdv004Name }
func (r *RuleAdv004) Description() string {
	return "Detects receipts used in multiple paid advance reports simultaneously"
}

func (r *RuleAdv004) Execute(ctx *rules.ValidationContext) rules.RuleResult {
	result := rules.RuleResult{
		RuleName:         ruleAdv004Name,
		RecordsScanned:   len(ctx.AdvanceReportReceipts),
		FlaggedProposals: make(map[string]string),
	}

	paidAdvances := make(map[string]bool, len(ctx.AdvanceReports))
	for _, ar := range ctx.AdvanceReports {
		if ar.IsPaid {
			paidAdvances[ar.ID] = true
		}
	}

	// receiptToAdvances maps receipt ID → slice of paid advance IDs that use it.
	receiptToAdvances := make(map[string][]string)
	for _, link := range ctx.AdvanceReportReceipts {
		if paidAdvances[link.AdvanceReportID] {
			receiptToAdvances[link.ReceiptID] = append(receiptToAdvances[link.ReceiptID], link.AdvanceReportID)
		}
	}

	for receiptID, advanceIDs := range receiptToAdvances {
		if len(advanceIDs) <= 1 {
			continue
		}
		result.IssuesFound++
		reason := fmt.Sprintf("receipt %s used in %d paid advance reports", receiptID, len(advanceIDs))
		result.Details = append(result.Details, reason)
		for _, advID := range advanceIDs {
			result.FlaggedProposals[advID] = reason
		}
	}

	result.Triggered = result.IssuesFound > 0
	return result
}
