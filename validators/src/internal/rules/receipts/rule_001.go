package receipts

import (
	"regexp"

	"validators/src/internal/rules"
)

// monetaryPattern matches values with exactly two decimal places (e.g. "1000.00", "54.90").
var monetaryPattern = regexp.MustCompile(`^\d+\.\d{2}$`)

// singleDecimalPattern matches values with exactly one decimal place (e.g. "309.9").
var singleDecimalPattern = regexp.MustCompile(`^\d+\.\d{1}$`)

// NormalizeDownloadedValue pads a single-decimal value to two decimal places (e.g. "309.9" → "309.90").
// All other values are returned unchanged.
func NormalizeDownloadedValue(v string) string {
	if singleDecimalPattern.MatchString(v) {
		return v + "0"
	}
	return v
}

type Rule001 struct{}

func NewRule001() *Rule001 { return &Rule001{} }

func (r *Rule001) Name() string        { return "RECEIPT-RULE-001" }
func (r *Rule001) Description() string { return "Detects receipts with suspicious monetary precision in downloaded_value" }

func (r *Rule001) Execute(ctx *rules.ValidationContext) rules.RuleResult {
	flagged := map[string]string{}

	for _, rec := range ctx.CanonicalReceipts {
		if !monetaryPattern.MatchString(rec.DownloadedValue) {
			flagged[rec.ID] = "downloaded_value does not match expected monetary format (e.g. 1000.00)"
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
