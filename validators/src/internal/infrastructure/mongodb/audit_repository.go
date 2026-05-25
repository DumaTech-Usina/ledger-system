package mongodb

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"validators/src/internal/domain"
)

type AuditRepository struct {
	db *mongo.Database
}

func NewAuditRepository(db *mongo.Database) *AuditRepository {
	return &AuditRepository{db: db}
}

func (r *AuditRepository) SaveClusters(ctx context.Context, clusters []domain.Cluster) error {
	if len(clusters) == 0 {
		return nil
	}
	col := r.db.Collection("clusters")
	models := make([]mongo.WriteModel, len(clusters))
	for i, c := range clusters {
		models[i] = mongo.NewUpdateOneModel().
			SetFilter(bson.M{"cluster_id": c.ID}).
			SetUpdate(bson.M{"$set": bson.M{
				"cluster_id":   c.ID,
				"blocking_key": c.BlockingKey,
				"proposals":    c.Proposals,
				"numbers":      c.Numbers,
				"reasons":      c.Reasons,
				"updated_at":   time.Now(),
			}}).
			SetUpsert(true)
	}
	_, err := col.BulkWrite(ctx, models, options.BulkWrite().SetOrdered(false))
	return err
}

func (r *AuditRepository) SaveRuleRun(ctx context.Context, result domain.RuleRunResult) error {
	col := r.db.Collection("rule_runs")
	filter := bson.M{"run_id": result.RunID, "rule_name": result.RuleName}
	update := bson.M{"$set": bson.M{
		"run_id":          result.RunID,
		"rule_name":       result.RuleName,
		"records_scanned": result.RecordsScanned,
		"issues_found":    result.IssuesFound,
		"details":         result.Details,
		"started_at":      result.StartedAt,
		"finished_at":     result.FinishedAt,
	}}
	_, err := col.UpdateOne(ctx, filter, update, options.Update().SetUpsert(true))
	return err
}

// SaveCanonicalProposals upserts every proposal verdict into the
// `canonical_proposals` collection, keyed by proposal_id.
// Downstream systems (e.g. the Ledger) query this collection to decide
// whether a proposal is safe to process.
func (r *AuditRepository) SaveCanonicalProposals(ctx context.Context, proposals []domain.CanonicalProposal) error {
	col := r.db.Collection("canonical_proposals")
	opts := options.Update().SetUpsert(true)

	for _, p := range proposals {
		violations := make([]bson.M, len(p.Violations))
		for i, v := range p.Violations {
			violations[i] = bson.M{"rule": v.Rule, "reason": v.Reason}
		}

		filter := bson.M{"proposal_id": p.ProposalID}
		update := bson.M{"$set": bson.M{
			"run_id":         p.RunID,
			"proposal_id":    p.ProposalID,
			"number":         p.Number,
			"value":          p.Value,
			"client_id":      p.ClientID,
			"plan_id":        p.PlanID,
			"effective_date": p.EffectiveDate,
			"status":         string(p.Status),
			"violations":     violations,
			"updated_at":     p.CreatedAt,
		}}
		if _, err := col.UpdateOne(ctx, filter, update, opts); err != nil {
			return err
		}
	}
	return nil
}
