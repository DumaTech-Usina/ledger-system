package proposals

import (
	"fmt"

	"validators/src/internal/rules"
)

const rule001Name = "RULE-001"

// Rule001 detects duplicate proposals by inspecting pre-computed clusters.
// It contains zero database or infrastructure dependencies.
type Rule001 struct{}

func NewRule001() *Rule001 { return &Rule001{} }

func (r *Rule001) Name() string        { return rule001Name }
func (r *Rule001) Description() string { return "Detects duplicate proposals via multidimensional clustering" }

func (r *Rule001) Execute(ctx *rules.ValidationContext) rules.RuleResult {
	result := rules.RuleResult{
		RuleName:       rule001Name,
		RecordsScanned: len(ctx.Proposals),
	}

	for _, cluster := range ctx.Clusters {
		if len(cluster.Proposals) >= 2 {
			result.IssuesFound++
			result.Details = append(result.Details,
				fmt.Sprintf("cluster %s: proposals %v | reasons: %v",
					cluster.ID, cluster.Numbers, cluster.Reasons),
			)
		}
	}

	result.Triggered = result.IssuesFound > 0
	return result
}
