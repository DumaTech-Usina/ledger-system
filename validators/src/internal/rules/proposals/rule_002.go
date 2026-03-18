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
		RuleName:       rule002Name,
		RecordsScanned: scanned,
	}

	for clusterID, receipts := range ctx.Receipts {
		byInstallment := make(map[int][]string) // installment number → proposal numbers
		for _, rec := range receipts {
			byInstallment[rec.InstallmentNumber] = append(byInstallment[rec.InstallmentNumber], rec.ProposalNumber)
		}
		for instNum, proposalNumbers := range byInstallment {
			if len(proposalNumbers) > 1 {
				result.IssuesFound++
				result.Details = append(result.Details,
					fmt.Sprintf("cluster %s: installment %d paid %d times (proposals: %v)",
						clusterID, instNum, len(proposalNumbers), proposalNumbers),
				)
			}
		}
	}

	result.Triggered = result.IssuesFound > 0
	return result
}
