package advances

import (
	"fmt"

	"validators/src/internal/rules"
)

const ruleAdv009Name = "RULE-ADV-009"

// RuleAdv009 detects advance reports linked to receipts that belong to a different
// broker, which indicates a relational inconsistency or financial isolation failure.
type RuleAdv009 struct{}

func NewRuleAdv009() *RuleAdv009 { return &RuleAdv009{} }

func (r *RuleAdv009) Name() string { return ruleAdv009Name }
func (r *RuleAdv009) Description() string {
	return "Detects advance reports linked to receipts belonging to a different broker"
}

func (r *RuleAdv009) Execute(ctx *rules.ValidationContext) rules.RuleResult {
	result := rules.RuleResult{
		RuleName:         ruleAdv009Name,
		RecordsScanned:   len(ctx.AdvanceReportReceipts),
		FlaggedProposals: make(map[string]string),
	}

	advanceIndex := make(map[string]string, len(ctx.AdvanceReports)) // advanceID → brokerID
	for _, ar := range ctx.AdvanceReports {
		advanceIndex[ar.ID] = ar.BrokerID
	}

	receiptIndex := make(map[string]string, len(ctx.AdvanceReceipts)) // receiptID → brokerID
	for _, rec := range ctx.AdvanceReceipts {
		receiptIndex[rec.ID] = rec.BrokerID
	}

	for _, link := range ctx.AdvanceReportReceipts {
		advBroker := advanceIndex[link.AdvanceReportID]
		recBroker := receiptIndex[link.ReceiptID]

		// Only flag when both broker IDs are present and they differ.
		if advBroker == "" || recBroker == "" {
			continue
		}
		if advBroker != recBroker {
			result.IssuesFound++
			result.FlaggedProposals[link.AdvanceReportID] = fmt.Sprintf(
				"receipt %s belongs to broker %s but advance belongs to broker %s",
				link.ReceiptID, recBroker, advBroker)
			result.Details = append(result.Details,
				fmt.Sprintf("advance %s: receipt %s broker_mismatch (advance=%s receipt=%s)",
					link.AdvanceReportID, link.ReceiptID, advBroker, recBroker))
		}
	}

	result.Triggered = result.IssuesFound > 0
	return result
}
