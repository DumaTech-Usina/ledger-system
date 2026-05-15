package mongodb

import (
	"context"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"validators/src/internal/domain"
)

type CanonicalProposalReader struct {
	db *mongo.Database
}

func NewCanonicalProposalReader(db *mongo.Database) *CanonicalProposalReader {
	return &CanonicalProposalReader{db: db}
}

// canonicalProposalDoc is the BSON read model for canonical_proposals.
type canonicalProposalDoc struct {
	ProposalID string  `bson:"proposal_id"`
	Number     string  `bson:"number"`
	Value      float64 `bson:"value"`
	ClientID   string  `bson:"client_id"`
	PlanID     string  `bson:"plan_id"`
	RunID      string  `bson:"run_id"`
}

func (r *CanonicalProposalReader) FetchClean(ctx context.Context) ([]domain.CanonicalProposal, error) {
	return r.fetchWithFilter(ctx, bson.D{{Key: "status", Value: "CLEAN"}}, 0)
}

func (r *CanonicalProposalReader) CountClean(ctx context.Context) (int, error) {
	n, err := r.db.Collection("canonical_proposals").
		CountDocuments(ctx, bson.D{{Key: "status", Value: "CLEAN"}})
	return int(n), err
}

func (r *CanonicalProposalReader) FetchCleanBatch(ctx context.Context, afterID string, limit int) ([]domain.CanonicalProposal, error) {
	filter := bson.D{{Key: "status", Value: "CLEAN"}}
	if afterID != "" {
		filter = append(filter, bson.E{Key: "proposal_id", Value: bson.D{{Key: "$gt", Value: afterID}}})
	}
	return r.fetchWithFilter(ctx, filter, int64(limit))
}

func (r *CanonicalProposalReader) fetchWithFilter(ctx context.Context, filter bson.D, limit int64) ([]domain.CanonicalProposal, error) {
	opts := options.Find().SetSort(bson.D{{Key: "proposal_id", Value: 1}})
	if limit > 0 {
		opts.SetLimit(limit)
	}

	cursor, err := r.db.Collection("canonical_proposals").Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var proposals []domain.CanonicalProposal
	for cursor.Next(ctx) {
		var doc canonicalProposalDoc
		if err := cursor.Decode(&doc); err != nil {
			return nil, err
		}
		proposals = append(proposals, domain.CanonicalProposal{
			RunID:      doc.RunID,
			ProposalID: doc.ProposalID,
			Number:     doc.Number,
			Value:      doc.Value,
			ClientID:   doc.ClientID,
			PlanID:     doc.PlanID,
			Status:     domain.ProposalStatusClean,
		})
	}
	return proposals, cursor.Err()
}
