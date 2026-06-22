package receipts

import (
	"context"
	"log"

	"validators/src/internal/application/ports"
	"validators/src/internal/domain"
	"validators/src/internal/engine"
	"validators/src/internal/pipeline"
)

// IngestionStage reads CLEAN canonical proposals from MongoDB.
type IngestionStage struct {
	reader ports.CanonicalProposalReader
}

func NewIngestionStage(reader ports.CanonicalProposalReader) *IngestionStage {
	return &IngestionStage{reader: reader}
}

func (s *IngestionStage) Name() string { return "IngestionStage" }

func (s *IngestionStage) Execute(ctx context.Context, pctx *pipeline.Context[*Data]) error {
	proposals, err := s.reader.FetchClean(ctx)
	if err != nil {
		return err
	}
	pctx.Data.Proposals = proposals
	return nil
}

// EnrichmentStage fetches all receipts for the ingested proposals from PostgreSQL.
type EnrichmentStage struct {
	receiptRepo ports.ReceiptRepository
}

func NewEnrichmentStage(receiptRepo ports.ReceiptRepository) *EnrichmentStage {
	return &EnrichmentStage{receiptRepo: receiptRepo}
}

func (s *EnrichmentStage) Name() string { return "EnrichmentStage" }

func (s *EnrichmentStage) Execute(ctx context.Context, pctx *pipeline.Context[*Data]) error {
	ids := make([]string, len(pctx.Data.Proposals))
	for i, p := range pctx.Data.Proposals {
		ids[i] = p.ProposalID
	}

	receipts, err := s.receiptRepo.FetchAllByProposalIDs(ctx, ids)
	if err != nil {
		return err
	}
	pctx.Data.ValidationCtx.CanonicalReceipts = receipts

	receiptIDs := make([]string, len(receipts))
	for i, r := range receipts {
		receiptIDs[i] = r.ID
	}
	links, err := s.receiptRepo.FetchActiveReceiptLinksByReceiptIDs(ctx, receiptIDs)
	if err != nil {
		return err
	}
	pctx.Data.ValidationCtx.AdvanceReportReceipts = links
	return nil
}

// ValidationStage runs all registered receipt rules.
type ValidationStage struct {
	eng *engine.ValidationEngine
}

func NewValidationStage(eng *engine.ValidationEngine) *ValidationStage {
	return &ValidationStage{eng: eng}
}

func (s *ValidationStage) Name() string { return "ValidationStage" }

func (s *ValidationStage) Execute(ctx context.Context, pctx *pipeline.Context[*Data]) error {
	pctx.Data.Results = s.eng.Run(ctx, pctx.Data.ValidationCtx)
	return nil
}

// AggregationStage builds canonical records from rule results and persists them.
// Failures are non-fatal: logged and the pipeline continues.
type AggregationStage struct {
	repo ports.AspiantReceiptCanonicalRepository
}

func NewAggregationStage(repo ports.AspiantReceiptCanonicalRepository) *AggregationStage {
	return &AggregationStage{repo: repo}
}

func (s *AggregationStage) Name() string { return "AggregationStage" }

func (s *AggregationStage) Execute(ctx context.Context, pctx *pipeline.Context[*Data]) error {
	// Build a set of receipt IDs flagged by any rule.
	flagged := map[string]string{}
	for _, result := range pctx.Data.Results {
		for receiptID, reason := range result.FlaggedProposals {
			flagged[receiptID] = reason
		}
	}

	receipts := pctx.Data.ValidationCtx.CanonicalReceipts
	canonicals := make([]domain.AspiantReceiptCanonical, 0, len(receipts))
	for _, rec := range receipts {
		status := "CLEAN"
		if _, suspicious := flagged[rec.ID]; suspicious {
			status = "SUSPICIOUS"
		}
		canonicals = append(canonicals, domain.AspiantReceiptCanonical{
			ReceiptID:         rec.ID,
			ProposalID:        rec.ProposalID,
			InstallmentNumber: rec.InstallmentNumber,
			DownloadedValue:   rec.DownloadedValue,
			DischargeDate:     rec.DischargeDate,
			ReceiptStatus:     rec.ReceiptStatus,
			Metadata:          map[string]string{"receiptValidationStatus": status},
		})
	}

	if err := s.repo.SaveAll(ctx, canonicals); err != nil {
		log.Printf("AggregationStage: failed to save aspirant_receipt_canonical records: %v", err)
	}
	return nil
}
