package mongodb

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"

	"validators/src/internal/domain"
)

type AuditRepository struct {
	db *mongo.Database
}

func NewAuditRepository(db *mongo.Database) *AuditRepository {
	return &AuditRepository{db: db}
}

func (r *AuditRepository) SaveClusters(ctx context.Context, clusters []domain.Cluster) error {
	docs := make([]interface{}, len(clusters))
	for i, c := range clusters {
		docs[i] = bson.M{
			"cluster_id":   c.ID,
			"blocking_key": c.BlockingKey,
			"proposals":    c.Proposals,
			"numbers":      c.Numbers,
			"reasons":      c.Reasons,
			"created_at":   time.Now(),
		}
	}
	_, err := r.db.Collection("clusters").InsertMany(ctx, docs)
	return err
}

func (r *AuditRepository) SaveRuleRun(ctx context.Context, result domain.RuleRunResult) error {
	_, err := r.db.Collection("rule_runs").InsertOne(ctx, bson.M{
		"run_id":          result.RunID,
		"rule_name":       result.RuleName,
		"records_scanned": result.RecordsScanned,
		"issues_found":    result.IssuesFound,
		"details":         result.Details,
		"started_at":      result.StartedAt,
		"finished_at":     result.FinishedAt,
	})
	return err
}
