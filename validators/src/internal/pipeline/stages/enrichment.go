package stages

import (
	"context"

	"validators/src/internal/application/ports"
	"validators/src/internal/pipeline"
	"validators/src/internal/rules"
	"validators/src/internal/shared/clustering"
)

// EnrichmentStage enriches the ValidationContext with:
//  1. Duplicate clusters (computed in-memory from ingested proposals)
//  2. Paid receipts for every clustered proposal
//  3. Aggregate statistics required by rules 003 and 004
type EnrichmentStage struct {
	proposalRepo ports.ProposalRepository
	receiptRepo  ports.ReceiptRepository
}

func NewEnrichmentStage(proposalRepo ports.ProposalRepository, receiptRepo ports.ReceiptRepository) *EnrichmentStage {
	return &EnrichmentStage{proposalRepo: proposalRepo, receiptRepo: receiptRepo}
}

func (s *EnrichmentStage) Name() string { return "EnrichmentStage" }

func (s *EnrichmentStage) Process(ctx context.Context, pctx *pipeline.PipelineContext) error {
	vctx := pctx.ValidationCtx

	// 1. Compute clusters from already-ingested proposals.
	vctx.Clusters = clustering.ComputeClusters(vctx.Proposals)

	// 2. Fetch paid receipts for every proposal that belongs to a cluster.
	if err := s.fetchReceiptsForClusters(ctx, vctx); err != nil {
		return err
	}

	// 3. Fetch aggregate stats for rules 003 / 004.
	return s.fetchAggregateStats(ctx, vctx)
}

func (s *EnrichmentStage) fetchReceiptsForClusters(ctx context.Context, vctx *rules.ValidationContext) error {
	// Build proposal-id → cluster-id index.
	proposalToCluster := make(map[string]string)
	var allIDs []string
	for _, c := range vctx.Clusters {
		for _, pid := range c.Proposals {
			proposalToCluster[pid] = c.ID
			allIDs = append(allIDs, pid)
		}
	}
	if len(allIDs) == 0 {
		return nil
	}

	receipts, err := s.receiptRepo.FetchPaidByProposalIDs(ctx, allIDs)
	if err != nil {
		return err
	}

	for _, rec := range receipts {
		cid := proposalToCluster[rec.ProposalID]
		vctx.Receipts[cid] = append(vctx.Receipts[cid], rec)
	}
	return nil
}

func (s *EnrichmentStage) fetchAggregateStats(ctx context.Context, vctx *rules.ValidationContext) error {
	total, err := s.proposalRepo.CountTotal(ctx)
	if err != nil {
		return err
	}
	invalid, err := s.proposalRepo.CountInvalidNumbers(ctx)
	if err != nil {
		return err
	}
	paid, err := s.receiptRepo.CountDistinctPaidProposals(ctx)
	if err != nil {
		return err
	}
	falseDelinquents, err := s.receiptRepo.CountFalseDelinquents(ctx)
	if err != nil {
		return err
	}

	vctx.ProposalStats = rules.ProposalStats{
		TotalProposals:       total,
		InvalidNumberCount:   invalid,
		TotalPaidProposals:   paid,
		FalseDelinquentCount: falseDelinquents,
	}
	return nil
}
