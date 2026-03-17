package rules

import (
	"context"
	"database/sql"

	"go.mongodb.org/mongo-driver/mongo"

	"time"

	"go.mongodb.org/mongo-driver/bson"
)

type Rule003 struct {
	MongoDB  *mongo.Database
	Postgres *sql.DB
}

func (r Rule003) RuleID() string      { return "RULE-003" }
func (r Rule003) RuleVersion() string { return "1.0" }
func (r Rule003) Description() string {
	return "Identifica parcelas abertas/inadimplentes com parcelas subsequentes pagas"
}

func (r Rule003) Execute(ctx context.Context) (int, int, error) {
	start := time.Now()
	queryTotal := `SELECT COUNT(DISTINCT proposal_id) FROM receipts WHERE payment_status = 'PAGO'`
	var totalAnalyzed int

	err := r.Postgres.QueryRowContext(ctx, queryTotal).Scan(&totalAnalyzed)
	if err != nil {
		return 0, 0, err
	}

	queryAnomalies := `
		WITH PaidMax AS (
			SELECT proposal_id, MAX(installment_number) as max_paid_installment
			FROM receipts
			WHERE payment_status = 'PAGO'
			GROUP BY proposal_id
		)
		SELECT COUNT(*)
		FROM receipts r
		JOIN PaidMax pm ON r.proposal_id = pm.proposal_id
		WHERE (r.payment_status != 'PAGO' AND r.payment_status != 'canceled_duplicate')
		  AND r.installment_number < pm.max_paid_installment
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
