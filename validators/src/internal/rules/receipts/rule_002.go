package receipts

// RULE_ID: RULE-REC-002
// TITLE: Commissioned Receipt Without Valid Financial Compensation
// ENTITY: receipts
// WORKER_SCOPE: receipt_validator
//
// Domain invariant: every BAIXADO receipt with installment_percentage > 0 must have
// either a non-zero amount_to_pay OR an active advance_report_receipts link.
// Receipts that have amount_to_pay = 0 and no active compensation link are flagged
// as SUSPICIOUS (possible loss of traceability or unregistered compensation).

import "validators/src/internal/rules"

type Rule002 struct{}

func NewRule002() *Rule002 { return &Rule002{} }

func (r *Rule002) Name() string { return "RULE-REC-002" }
func (r *Rule002) Description() string {
	return "Commissioned receipt (BAIXADO, installment_percentage > 0, amount_to_pay = 0) without an active financial compensation link"
}

func (r *Rule002) Execute(ctx *rules.ValidationContext) rules.RuleResult {
	activeLinks := make(map[string]bool, len(ctx.AdvanceReportReceipts))
	for _, link := range ctx.AdvanceReportReceipts {
		if link.IsActive {
			activeLinks[link.ReceiptID] = true
		}
	}

	flagged := make(map[string]string)
	for _, rec := range ctx.CanonicalReceipts {
		if rec.ReceiptStatus != "BAIXADO" || rec.InstallmentPercentage <= 0 || rec.AmountToPay != 0 {
			continue
		}
		if !activeLinks[rec.ID] {
			flagged[rec.ID] = "commissioned receipt with zero amount_to_pay has no active financial compensation"
		}
	}

	return rules.RuleResult{
		RuleName:         r.Name(),
		RecordsScanned:   len(ctx.CanonicalReceipts),
		IssuesFound:      len(flagged),
		Triggered:        len(flagged) > 0,
		FlaggedProposals: flagged,
	}
}
