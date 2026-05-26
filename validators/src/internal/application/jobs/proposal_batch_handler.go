package jobs

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"validators/src/internal/application/ports"
	"validators/src/internal/domain"
	"validators/src/internal/engine"
	"validators/src/internal/messaging/messages"
	"validators/src/internal/rules"
	"validators/src/internal/shared/clustering"
)

// ProposalBatchHandler implements ports.MessageHandler for ProposalBlockBatch messages.
// It fetches only the proposals belonging to the given blocking key, runs clustering,
// enriches with receipts and aggregate stats, evaluates all rules, and upserts
// canonical records — safe to replay because SaveCanonicalProposals is an upsert
// keyed on (run_id, proposal_id).
type ProposalBatchHandler struct {
	proposalRepo ports.ProposalRepository
	receiptRepo  ports.ReceiptRepository
	auditRepo    ports.AuditRepository
	eng          *engine.ValidationEngine
}

func NewProposalBatchHandler(
	proposalRepo ports.ProposalRepository,
	receiptRepo ports.ReceiptRepository,
	auditRepo ports.AuditRepository,
	eng *engine.ValidationEngine,
) *ProposalBatchHandler {
	return &ProposalBatchHandler{
		proposalRepo: proposalRepo,
		receiptRepo:  receiptRepo,
		auditRepo:    auditRepo,
		eng:          eng,
	}
}

// Handle deserializes the batch, runs the full proposal pipeline scoped to the
// blocking key, and saves canonical records. A non-nil error causes the worker
// to nack the message to the DLQ.
func (h *ProposalBatchHandler) Handle(ctx context.Context, body []byte) error {
	var msg messages.ProposalBlockBatch
	if err := json.Unmarshal(body, &msg); err != nil {
		return fmt.Errorf("invalid payload: %w", err)
	}

	startedAt := time.Now()

	proposals, err := h.proposalRepo.FetchByBlockingKey(ctx, msg.BlockingKey)
	if err != nil {
		return fmt.Errorf("batch_id=%s fetch proposals: %w", msg.BatchID, err)
	}
	if len(proposals) == 0 {
		return nil
	}

	vctx, err := h.buildContext(ctx, proposals)
	if err != nil {
		return fmt.Errorf("batch_id=%s enrich: %w", msg.BatchID, err)
	}

	results := h.eng.Run(ctx, vctx)

	if len(vctx.Clusters) > 0 {
		if err := h.auditRepo.SaveClusters(ctx, vctx.Clusters); err != nil {
			return fmt.Errorf("batch_id=%s save clusters: %w", msg.BatchID, err)
		}
	}

	finishedAt := time.Now()
	for _, r := range results {
		run := domain.RuleRunResult{
			RunID:          msg.RunID,
			RuleName:       r.RuleName,
			RecordsScanned: r.RecordsScanned,
			IssuesFound:    r.IssuesFound,
			Details:        r.Details,
			StartedAt:      startedAt,
			FinishedAt:     finishedAt,
		}
		if err := h.auditRepo.SaveRuleRun(ctx, run); err != nil {
			return fmt.Errorf("batch_id=%s save rule run %s: %w", msg.BatchID, r.RuleName, err)
		}
	}

	canonicals := buildBlockCanonicals(msg.RunID, vctx, results)
	if err := h.auditRepo.SaveCanonicalProposals(ctx, canonicals); err != nil {
		return fmt.Errorf("batch_id=%s save canonicals: %w", msg.BatchID, err)
	}
	return nil
}

// buildContext populates a ValidationContext for the given proposals:
//   - clusters computed in-memory within the block (Rules 001/002)
//   - paid receipts fetched for clustered proposals only
//   - aggregate stats fetched from the full table (Rules 003/004)
func (h *ProposalBatchHandler) buildContext(ctx context.Context, proposals []domain.Proposal) (*rules.ValidationContext, error) {
	vctx := rules.NewValidationContext()
	vctx.Proposals = proposals

	clusters := clustering.ComputeClusters(proposals)
	vctx.Clusters = clusters

	if err := h.enrichReceipts(ctx, vctx, clusters); err != nil {
		return nil, err
	}
	if err := h.enrichStats(ctx, vctx); err != nil {
		return nil, err
	}
	return vctx, nil
}

func (h *ProposalBatchHandler) enrichReceipts(ctx context.Context, vctx *rules.ValidationContext, clusters []domain.Cluster) error {
	proposalToCluster := make(map[string]string)
	var clusteredIDs []string
	for _, c := range clusters {
		for _, pid := range c.Proposals {
			clusteredIDs = append(clusteredIDs, pid)
			proposalToCluster[pid] = c.ID
		}
	}
	if len(clusteredIDs) == 0 {
		return nil
	}
	receipts, err := h.receiptRepo.FetchPaidByProposalIDs(ctx, clusteredIDs)
	if err != nil {
		return err
	}
	for _, rec := range receipts {
		cid := proposalToCluster[rec.ProposalID]
		vctx.Receipts[cid] = append(vctx.Receipts[cid], rec)
	}
	return nil
}

func (h *ProposalBatchHandler) enrichStats(ctx context.Context, vctx *rules.ValidationContext) error {
	total, err := h.proposalRepo.CountTotal(ctx)
	if err != nil {
		return err
	}
	invalidCount, err := h.proposalRepo.CountInvalidNumbers(ctx)
	if err != nil {
		return err
	}
	invalidIDs, err := h.proposalRepo.FetchInvalidNumberProposalIDs(ctx)
	if err != nil {
		return err
	}
	paid, err := h.receiptRepo.CountDistinctPaidProposals(ctx)
	if err != nil {
		return err
	}
	falseDelinquentCount, err := h.receiptRepo.CountFalseDelinquents(ctx)
	if err != nil {
		return err
	}
	falseDelinquentIDs, err := h.receiptRepo.FetchFalseDelinquentProposalIDs(ctx)
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

func buildBlockCanonicals(runID string, vctx *rules.ValidationContext, results []rules.RuleResult) []domain.CanonicalProposal {
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
	out := make([]domain.CanonicalProposal, len(vctx.Proposals))
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
		out[i] = cp
	}
	return out
}
