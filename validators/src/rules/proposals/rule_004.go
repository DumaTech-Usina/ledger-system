package rules

import (
	"context"
	"database/sql"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

type Rule004 struct {
	MongoDB  *mongo.Database
	Postgres *sql.DB
}

func (r Rule004) RuleID() string      { return "RULE-004" }
func (r Rule004) RuleVersion() string { return "1.0" }
func (r Rule004) Description() string {
	return "Identifica propostas com número vazio, nulo ou preenchido apenas com zeros"
}

func (r Rule004) Execute(ctx context.Context) (int, int, error) {
	start := time.Now()
	queryTotal := `SELECT COUNT(*) FROM proposals`
	var totalAnalyzed int

	err := r.Postgres.QueryRowContext(ctx, queryTotal).Scan(&totalAnalyzed)
	if err != nil {
		return 0, 0, err
	}

	queryAnomalies := `
		SELECT COUNT(*)
		FROM proposals
		WHERE proposal_number IS NULL
		   OR TRIM(proposal_number) = ''
		   OR proposal_number ~ '^0+$'
	`

	var totalInconsistencies int
	err = r.Postgres.QueryRowContext(ctx, queryAnomalies).Scan(&totalInconsistencies)
	if err != nil {
		return 0, 0, err
	}

	runData := bson.M{
		"rule_id":         r.RuleID(),
		"started_at":      start,
		"finished_at":     time.Now(),
		"records_scanned": totalAnalyzed,
		"issues_found":    totalInconsistencies,
	}
	_, _ = r.MongoDB.Collection("rule_runs").InsertOne(ctx, runData)

	return totalAnalyzed, totalInconsistencies, nil
}
