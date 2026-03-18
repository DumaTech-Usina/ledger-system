package stages

import (
	"context"
	"log"
	"time"

	"validators/src/internal/application/ports"
	"validators/src/internal/domain"
	"validators/src/internal/pipeline"
)

// AggregationStage persists clusters and rule-run results to the audit
// repository. Failures on individual saves are logged but do not abort the
// pipeline — audit persistence is best-effort.
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
	return nil
}
