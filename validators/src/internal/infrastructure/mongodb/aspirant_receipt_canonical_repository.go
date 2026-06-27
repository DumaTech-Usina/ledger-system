package mongodb

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"validators/src/internal/domain"
)

type AspiantReceiptCanonicalRepository struct {
	db *mongo.Database
}

func NewAspiantReceiptCanonicalRepository(db *mongo.Database) *AspiantReceiptCanonicalRepository {
	return &AspiantReceiptCanonicalRepository{db: db}
}

func (r *AspiantReceiptCanonicalRepository) SaveAll(ctx context.Context, records []domain.AspiantReceiptCanonical) error {
	if len(records) == 0 {
		return nil
	}

	col := r.db.Collection("aspirant_receipt_canonical")
	now := time.Now()

	models := make([]mongo.WriteModel, len(records))
	for i, rec := range records {
		models[i] = mongo.NewUpdateOneModel().
			SetFilter(bson.M{"receipt_id": rec.ReceiptID}).
			SetUpdate(bson.M{"$set": bson.M{
				"receipt_id":         rec.ReceiptID,
				"proposal_id":        rec.ProposalID,
				"installment_number": rec.InstallmentNumber,
				"downloaded_value":   rec.DownloadedValue,
				"discharge_date":     rec.DischargeDate,
				"receipt_status":     rec.ReceiptStatus,
				"created_at":         rec.CreatedAt,
				"metadata":           rec.Metadata,
				"updated_at":         now,
			}}).
			SetUpsert(true)
	}

	_, err := col.BulkWrite(ctx, models, options.BulkWrite().SetOrdered(false))
	return err
}
