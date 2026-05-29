package mongodb

import (
	"context"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// EnsureIndexes creates all required indexes idempotently.
// Safe to call on every startup — MongoDB skips creation if an identical index already exists.
func EnsureIndexes(ctx context.Context, db *mongo.Database) error {
	if err := ensureCanonicalProposalsIndexes(ctx, db); err != nil {
		return err
	}
	if err := ensureAspiantReceiptCanonicalIndexes(ctx, db); err != nil {
		return err
	}
	if err := ensureAspiantAdvanceCanonicalIndexes(ctx, db); err != nil {
		return err
	}
	if err := ensureClustersIndexes(ctx, db); err != nil {
		return err
	}
	return ensureRuleRunsIndexes(ctx, db)
}

func ensureCanonicalProposalsIndexes(ctx context.Context, db *mongo.Database) error {
	col := db.Collection("canonical_proposals")
	_, err := col.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "proposal_id", Value: 1}},
			Options: options.Index().SetUnique(true).SetName("uq_proposal_id"),
		},
		// Covers FetchCleanBatch: filter {status, proposal_id $gt} + sort proposal_id
		{
			Keys:    bson.D{{Key: "status", Value: 1}, {Key: "proposal_id", Value: 1}},
			Options: options.Index().SetName("idx_status_proposal_id"),
		},
	})
	return err
}

func ensureAspiantReceiptCanonicalIndexes(ctx context.Context, db *mongo.Database) error {
	col := db.Collection("aspirant_receipt_canonical")
	_, err := col.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "receipt_id", Value: 1}},
		Options: options.Index().SetUnique(true).SetName("uq_receipt_id"),
	})
	return err
}

func ensureAspiantAdvanceCanonicalIndexes(ctx context.Context, db *mongo.Database) error {
	col := db.Collection("aspirant_advance_canonical")
	_, err := col.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "advance_report_id", Value: 1}},
		Options: options.Index().SetUnique(true).SetName("uq_advance_report_id"),
	})
	return err
}

func ensureClustersIndexes(ctx context.Context, db *mongo.Database) error {
	col := db.Collection("clusters")
	_, err := col.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "cluster_id", Value: 1}},
		Options: options.Index().SetUnique(true).SetName("uq_cluster_id"),
	})
	return err
}

func ensureRuleRunsIndexes(ctx context.Context, db *mongo.Database) error {
	col := db.Collection("rule_runs")
	_, err := col.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "run_id", Value: 1}, {Key: "rule_name", Value: 1}},
		Options: options.Index().SetUnique(true).SetName("uq_run_id_rule_name"),
	})
	return err
}
