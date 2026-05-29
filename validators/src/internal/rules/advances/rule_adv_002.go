package advances

import (
	"fmt"

	"validators/src/internal/rules"
)

const ruleAdv002Name = "RULE-ADV-002"

// RuleAdv002 detects advance reports that are linked (via advance_report_receipts
// → receipts → proposals) to a proposal flagged as SUSPICIOUS in canonical_proposals.
type RuleAdv002 struct{}

func NewRuleAdv002() *RuleAdv002 { return &RuleAdv002{} }

func (r *RuleAdv002) Name() string { return ruleAdv002Name }
func (r *RuleAdv002) Description() string {
	return "Detects advance reports linked to proposals marked as SUSPICIOUS in canonical_proposals"
}

func (r *RuleAdv002) Execute(ctx *rules.ValidationContext) rules.RuleResult {
	result := rules.RuleResult{
		RuleName:         ruleAdv002Name,
		RecordsScanned:   len(ctx.AdvanceReportReceipts),
		FlaggedProposals: make(map[string]string),
	}

	receiptIndex := make(map[string]string, len(ctx.AdvanceReceipts)) // receiptID → proposalID
	for _, rec := range ctx.AdvanceReceipts {
		receiptIndex[rec.ID] = rec.ProposalID
	}

	for _, link := range ctx.AdvanceReportReceipts {
		proposalID, ok := receiptIndex[link.ReceiptID]
		if !ok {
			continue
		}
		if ctx.SuspectProposalIDs[proposalID] {
			result.IssuesFound++
			result.FlaggedProposals[link.AdvanceReportID] = fmt.Sprintf(
				"receipt %s is linked to suspect proposal %s", link.ReceiptID, proposalID)
		}
	}

	result.Details = buildDetails(result.FlaggedProposals, "advance")
	result.Triggered = result.IssuesFound > 0
	return result
}
