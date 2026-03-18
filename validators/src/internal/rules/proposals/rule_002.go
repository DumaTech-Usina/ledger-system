package proposals

import (
	"fmt"

	"validators/src/internal/rules"
)

const rule002Name = "RULE-002"

// Rule002 detects the same installment being paid more than once across
// proposals that belong to the same duplicate cluster.
type Rule002 struct{}

func NewRule002() *Rule002 { return &Rule002{} }

func (r *Rule002) Name() string        { return rule002Name }
func (r *Rule002) Description() string { return "Detects double payments within duplicate proposal clusters" }

func (r *Rule002) Execute(ctx *rules.ValidationContext) rules.RuleResult {
	scanned := 0
	for _, c := range ctx.Clusters {
		scanned += len(c.Proposals)
	}

	result := rules.RuleResult{
		RuleName:         rule002Name,
		RecordsScanned:   scanned,
		FlaggedProposals: make(map[string]string),
	}

	for clusterID, receipts := range ctx.Receipts {
		type receiptRef struct{ id, number string }
		byInstallment := make(map[int][]receiptRef)
		for _, rec := range receipts {
			byInstallment[rec.InstallmentNumber] = append(
				byInstallment[rec.InstallmentNumber],
				receiptRef{id: rec.ProposalID, number: rec.ProposalNumber},
			)
		}
		for instNum, refs := range byInstallment {
			if len(refs) > 1 {
				result.IssuesFound++
				numbers := make([]string, len(refs))
				for i, ref := range refs {
					numbers[i] = ref.number
				}
				detail := fmt.Sprintf("cluster %s: installment %d paid %d times (proposals: %v)",
					clusterID, instNum, len(refs), numbers)
				result.Details = append(result.Details, detail)

				reason := fmt.Sprintf("installment %d paid %d times in cluster %s", instNum, len(refs), clusterID)
				for _, ref := range refs {
					result.FlaggedProposals[ref.id] = reason
				}
			}
		}
	}

	result.Triggered = result.IssuesFound > 0
	return result
}
