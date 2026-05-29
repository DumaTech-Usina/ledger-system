package advances

import (
	"fmt"
	"math"

	"validators/src/internal/rules"
)

const (
	ruleAdv006Name    = "RULE-ADV-006"
	amountDiffTolerance = 0.01
)

// RuleAdv006 detects advance reports where the sum of linked receipt amounts
// diverges from the advance's own amount_to_pay by more than the allowed tolerance.
type RuleAdv006 struct{}

func NewRuleAdv006() *RuleAdv006 { return &RuleAdv006{} }

func (r *RuleAdv006) Name() string { return ruleAdv006Name }
func (r *RuleAdv006) Description() string {
	return "Detects advance reports where receipt sum diverges from advance amount_to_pay"
}

func (r *RuleAdv006) Execute(ctx *rules.ValidationContext) rules.RuleResult {
	result := rules.RuleResult{
		RuleName:         ruleAdv006Name,
		RecordsScanned:   len(ctx.AdvanceReports),
		FlaggedProposals: make(map[string]string),
	}

	receiptAmount := make(map[string]float64, len(ctx.AdvanceReceipts))
	for _, rec := range ctx.AdvanceReceipts {
		receiptAmount[rec.ID] = rec.Amount
	}

	// Sum receipt amounts per advance report.
	sumByAdvance := make(map[string]float64)
	for _, link := range ctx.AdvanceReportReceipts {
		sumByAdvance[link.AdvanceReportID] += receiptAmount[link.ReceiptID]
	}

	for _, ar := range ctx.AdvanceReports {
		receiptTotal := sumByAdvance[ar.ID]
		diff := math.Abs(ar.AmountToPay - receiptTotal)
		if diff > amountDiffTolerance {
			result.IssuesFound++
			result.FlaggedProposals[ar.ID] = fmt.Sprintf(
				"receipt sum %.2f diverges from advance amount_to_pay %.2f by %.2f",
				receiptTotal, ar.AmountToPay, diff)
			result.Details = append(result.Details,
				fmt.Sprintf("advance %s: amount_to_pay=%.2f receipts_total=%.2f diff=%.2f",
					ar.ID, ar.AmountToPay, receiptTotal, diff))
		}
	}

	result.Triggered = result.IssuesFound > 0
	return result
}
