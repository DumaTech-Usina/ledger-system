package stages

import (
	"context"
	"log"
	"time"

	"validators/src/internal/application/ports"
	"validators/src/internal/domain"
	"validators/src/internal/pipeline"
	"validators/src/internal/rules"
)

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

func (s *AggregationStage) Process(ctx context.Context, pctx *pipeline.PipelineContext) error {
	if len(pctx.ValidationCtx.Clusters) > 0 {
		if err := s.auditRepo.SaveClusters(ctx, pctx.ValidationCtx.Clusters); err != nil {
			log.Printf("aggregation: failed to save clusters: %v", err)
		}
	}

	finishedAt := time.Now()
	for _, r := range pctx.Results {
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

	canonical := buildCanonicalProposals(pctx.RunID, pctx.ValidationCtx, pctx.Results)
	if err := s.auditRepo.SaveCanonicalProposals(ctx, canonical); err != nil {
		log.Printf("aggregation: failed to save canonical proposals: %v", err)
	}

	return nil
}

// buildCanonicalProposals merges per-proposal flags from all rule results and
// assigns each proposal a CLEAN or SUSPICIOUS status with full violation details.
func buildCanonicalProposals(runID string, vctx *rules.ValidationContext, results []rules.RuleResult) []domain.CanonicalProposal {
	// violationIndex: proposalID → []Violation (one per rule that flagged it)
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
