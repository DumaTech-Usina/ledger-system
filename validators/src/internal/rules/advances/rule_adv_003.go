package advances

import (
	"fmt"

	"validators/src/internal/rules"
)

const ruleAdv003Name = "RULE-ADV-003"

// RuleAdv003 detects receipts that still have a positive amount_to_pay even though
// their linked advance report is already paid — indicating a financial settlement
// inconsistency or possible duplicate payment.
type RuleAdv003 struct{}

func NewRuleAdv003() *RuleAdv003 { return &RuleAdv003{} }

func (r *RuleAdv003) Name() string { return ruleAdv003Name }
func (r *RuleAdv003) Description() string {
	return "Detects receipts with amount_to_pay > 0 linked to already-paid advance reports"
}

func (r *RuleAdv003) Execute(ctx *rules.ValidationContext) rules.RuleResult {
	result := rules.RuleResult{
		RuleName:         ruleAdv003Name,
		RecordsScanned:   len(ctx.AdvanceReportReceipts),
		FlaggedProposals: make(map[string]string),
	}

	advanceIndex := make(map[string]bool, len(ctx.AdvanceReports)) // advanceID → isPaid
	for _, ar := range ctx.AdvanceReports {
		advanceIndex[ar.ID] = ar.IsPaid
	}

	receiptIndex := make(map[string]float64, len(ctx.AdvanceReceipts)) // receiptID → amountToPay
	for _, rec := range ctx.AdvanceReceipts {
		receiptIndex[rec.ID] = rec.AmountToPay
	}

	for _, link := range ctx.AdvanceReportReceipts {
		if !advanceIndex[link.AdvanceReportID] {
			continue
		}
		amountToPay, ok := receiptIndex[link.ReceiptID]
		if !ok {
			continue
		}
		if amountToPay > 0 {
			result.IssuesFound++
			result.FlaggedProposals[link.AdvanceReportID] = fmt.Sprintf(
				"receipt %s still has amount_to_pay=%.2f after advance payment", link.ReceiptID, amountToPay)
		}
	}

	result.Details = buildDetails(result.FlaggedProposals, "advance")
	result.Triggered = result.IssuesFound > 0
	return result
}
