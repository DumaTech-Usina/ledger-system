package domain

import "time"

type RuleRunResult struct {
	RunID          string
	RuleName       string
	Description    string
	RecordsScanned int
	IssuesFound    int
	Details        []string
	StartedAt      time.Time
	FinishedAt     time.Time
}
