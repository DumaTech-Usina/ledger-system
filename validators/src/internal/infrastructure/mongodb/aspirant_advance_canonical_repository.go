package mongodb

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"validators/src/internal/domain"
)

// AspiantAdvanceCanonicalRepository implements ports.AspiantAdvanceCanonicalRepository.
type AspiantAdvanceCanonicalRepository struct {
	db *mongo.Database
}

func NewAspiantAdvanceCanonicalRepository(db *mongo.Database) *AspiantAdvanceCanonicalRepository {
	return &AspiantAdvanceCanonicalRepository{db: db}
}

func (r *AspiantAdvanceCanonicalRepository) SaveAll(ctx context.Context, records []domain.CanonicalAdvanceReport) error {
	if len(records) == 0 {
		return nil
	}

	col := r.db.Collection("aspirant_advance_canonical")
	now := time.Now()

	models := make([]mongo.WriteModel, len(records))
	for i, rec := range records {
		violations := make([]bson.M, len(rec.Violations))
		for j, v := range rec.Violations {
			violations[j] = bson.M{"rule": v.Rule, "reason": v.Reason}
		}
		models[i] = mongo.NewUpdateOneModel().
			SetFilter(bson.M{"advance_report_id": rec.AdvanceReportID}).
			SetUpdate(bson.M{"$set": bson.M{
				"advance_report_id": rec.AdvanceReportID,
				"tenant_id":         rec.TenantID,
				"status":            string(rec.Status),
				"violations":        violations,
				"amount_to_pay":     rec.AmountToPay,
				"broker_id":         rec.BrokerID,
				"is_paid":           rec.IsPaid,
				"is_cancelled":      rec.IsCancelled,
				"updated_at":        now,
			}}).
			SetUpsert(true)
	}

	_, err := col.BulkWrite(ctx, models, options.BulkWrite().SetOrdered(false))
	return err
}
