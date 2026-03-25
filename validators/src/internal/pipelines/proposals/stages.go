package proposals

import (
	"context"
	"log"
	"time"

	"validators/src/internal/application/ports"
	"validators/src/internal/domain"
	"validators/src/internal/engine"
	"validators/src/internal/pipeline"
	"validators/src/internal/rules"
	"validators/src/internal/shared/clustering"
)

// IngestionStage fetches all proposals from the repository and stores them
// in the ValidationContext. No business logic lives here.
type IngestionStage struct {
	proposalRepo ports.ProposalRepository
}

func NewIngestionStage(proposalRepo ports.ProposalRepository) *IngestionStage {
	return &IngestionStage{proposalRepo: proposalRepo}
}

func (s *IngestionStage) Name() string { return "IngestionStage" }

func (s *IngestionStage) Execute(ctx context.Context, pctx *pipeline.Context[*Data]) error {
	proposals, err := s.proposalRepo.FetchAll(ctx)
	if err != nil {
		return err
	}
	pctx.Data.ValidationCtx.Proposals = proposals
	return nil
}

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

func (s *EnrichmentStage) Execute(ctx context.Context, pctx *pipeline.Context[*Data]) error {
	vctx := pctx.Data.ValidationCtx

	vctx.Clusters = clustering.ComputeClusters(vctx.Proposals)

	if err := s.fetchReceiptsForClusters(ctx, vctx); err != nil {
		return err
	}

	return s.fetchAggregateStats(ctx, vctx)
}

func (s *EnrichmentStage) fetchReceiptsForClusters(ctx context.Context, vctx *rules.ValidationContext) error {
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
	invalidCount, err := s.proposalRepo.CountInvalidNumbers(ctx)
	if err != nil {
		return err
	}
	invalidIDs, err := s.proposalRepo.FetchInvalidNumberProposalIDs(ctx)
	if err != nil {
		return err
	}
	paid, err := s.receiptRepo.CountDistinctPaidProposals(ctx)
	if err != nil {
		return err
	}
	falseDelinquentCount, err := s.receiptRepo.CountFalseDelinquents(ctx)
	if err != nil {
		return err
	}
	falseDelinquentIDs, err := s.receiptRepo.FetchFalseDelinquentProposalIDs(ctx)
	if err != nil {
		return err
	}

	vctx.ProposalStats = rules.ProposalStats{
		TotalProposals:       total,
		TotalPaidProposals:   paid,
		InvalidNumberCount:   invalidCount,
		InvalidNumberIDs:     invalidIDs,
		FalseDelinquentCount: falseDelinquentCount,
		FalseDelinquentIDs:   falseDelinquentIDs,
	}
	return nil
}

// ValidationStage delegates rule execution to the ValidationEngine and stores
// the results in the pipeline Data. It contains no business logic.
type ValidationStage struct {
	engine *engine.ValidationEngine
}

func NewValidationStage(eng *engine.ValidationEngine) *ValidationStage {
	return &ValidationStage{engine: eng}
}

func (s *ValidationStage) Name() string { return "ValidationStage" }

func (s *ValidationStage) Execute(ctx context.Context, pctx *pipeline.Context[*Data]) error {
	pctx.Data.Results = s.engine.Run(ctx, pctx.Data.ValidationCtx)
	return nil
}

// AggregationStage persists clusters, rule-run results, and the canonical
// proposal verdicts to the audit repository.
// Failures on individual saves are logged but do not abort the pipeline —
// audit persistence is best-effort.
type AggregationStage struct {
	auditRepo ports.AuditRepository
}

func NewAggregationStage(auditRepo ports.AuditRepository) *AggregationStage {
	return &AggregationStage{auditRepo: auditRepo}
}

func (s *AggregationStage) Name() string { return "AggregationStage" }

func (s *AggregationStage) Execute(ctx context.Context, pctx *pipeline.Context[*Data]) error {
	vctx := pctx.Data.ValidationCtx
	results := pctx.Data.Results

	if len(vctx.Clusters) > 0 {
		if err := s.auditRepo.SaveClusters(ctx, vctx.Clusters); err != nil {
			log.Printf("aggregation: failed to save clusters: %v", err)
		}
	}

	finishedAt := time.Now()
	for _, r := range results {
		run := domain.RuleRunResult{
			RunID:          pctx.RunID,
			RuleName:       r.RuleName,
			RecordsScanned: r.RecordsScanned,
			IssuesFound:    r.IssuesFound,
			Details:        r.Details,
			StartedAt:      pctx.StartedAt,
			FinishedAt:     finishedAt,
		}
		if err := s.auditRepo.SaveRuleRun(ctx, run); err != nil {
			log.Printf("aggregation: failed to save run for %s: %v", r.RuleName, err)
		}
	}

	canonical := buildCanonicalProposals(pctx.RunID, vctx, results)
	if err := s.auditRepo.SaveCanonicalProposals(ctx, canonical); err != nil {
		log.Printf("aggregation: failed to save canonical proposals: %v", err)
	}

	return nil
}

func buildCanonicalProposals(runID string, vctx *rules.ValidationContext, results []rules.RuleResult) []domain.CanonicalProposal {
	violationIndex := make(map[string][]domain.Violation)
	for _, r := range results {
		for pid, reason := range r.FlaggedProposals {
			violationIndex[pid] = append(violationIndex[pid], domain.Violation{
				Rule:   r.RuleName,
				Reason: reason,
			})
		}
	}

	now := time.Now()
	canonical := make([]domain.CanonicalProposal, len(vctx.Proposals))
	for i, p := range vctx.Proposals {
		cp := domain.CanonicalProposal{
			RunID:         runID,
			ProposalID:    p.ID,
			Number:        p.Number,
			Value:         p.Value,
			ClientID:      p.ClientID,
			PlanID:        p.PlanID,
			EffectiveDate: p.EffectiveDate,
			Status:        domain.ProposalStatusClean,
			Violations:    []domain.Violation{},
			CreatedAt:     now,
		}
		if violations, found := violationIndex[p.ID]; found {
			cp.Status = domain.ProposalStatusSuspicious
			cp.Violations = violations
		}
		canonical[i] = cp
	}
	return canonical
}
