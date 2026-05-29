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
)

// AdvanceBatchHandler implements ports.MessageHandler for AdvanceBatch messages.
// For each batch it:
//  1. Fetches the advance reports by IDs
//  2. Fetches active receipt links and receipt projections
//  3. Checks canonical_proposals for any linked suspect proposals (RULE-ADV-002)
//  4. Runs all registered advance rules
//  5. Persists rule-run audit records and canonical advance verdicts
//
// All MongoDB writes are upserts keyed on advance_report_id, so replaying the
// same message is safe.
type AdvanceBatchHandler struct {
	advanceRepo    ports.AdvanceReportRepository
	canonicalRepo  ports.AspiantAdvanceCanonicalRepository
	statusChecker  ports.CanonicalProposalStatusChecker
	auditRepo      ports.AuditRepository
	eng            *engine.ValidationEngine
}

func NewAdvanceBatchHandler(
	advanceRepo ports.AdvanceReportRepository,
	canonicalRepo ports.AspiantAdvanceCanonicalRepository,
	statusChecker ports.CanonicalProposalStatusChecker,
	auditRepo ports.AuditRepository,
	eng *engine.ValidationEngine,
) *AdvanceBatchHandler {
	return &AdvanceBatchHandler{
		advanceRepo:   advanceRepo,
		canonicalRepo: canonicalRepo,
		statusChecker: statusChecker,
		auditRepo:     auditRepo,
		eng:           eng,
	}
}

// Handle deserializes the batch, runs the advance validation pipeline, and saves
// canonical records. A non-nil error causes the worker to nack to the DLQ.
func (h *AdvanceBatchHandler) Handle(ctx context.Context, body []byte) error {
	var msg messages.AdvanceBatch
	if err := json.Unmarshal(body, &msg); err != nil {
		return fmt.Errorf("invalid payload: %w", err)
	}
	if len(msg.AdvanceReportIDs) == 0 {
		return nil
	}

	startedAt := time.Now()

	vctx, err := h.buildContext(ctx, msg.AdvanceReportIDs)
	if err != nil {
		return fmt.Errorf("batch_id=%s enrich: %w", msg.BatchID, err)
	}
	if len(vctx.AdvanceReports) == 0 {
		return nil
	}

	results := h.eng.Run(ctx, vctx)

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

	canonicals := buildAdvanceCanonicals(vctx, results)
	if err := h.canonicalRepo.SaveAll(ctx, canonicals); err != nil {
		return fmt.Errorf("batch_id=%s save canonicals: %w", msg.BatchID, err)
	}
	return nil
}

// buildContext populates a ValidationContext for the given advance report IDs.
func (h *AdvanceBatchHandler) buildContext(ctx context.Context, ids []string) (*rules.ValidationContext, error) {
	vctx := rules.NewValidationContext()

	advances, err := h.advanceRepo.FetchByIDs(ctx, ids)
	if err != nil {
		return nil, fmt.Errorf("fetch advances: %w", err)
	}
	vctx.AdvanceReports = advances

	links, err := h.advanceRepo.FetchActiveReceiptLinks(ctx, ids)
	if err != nil {
		return nil, fmt.Errorf("fetch receipt links: %w", err)
	}
	vctx.AdvanceReportReceipts = links

	receiptIDs := uniqueReceiptIDs(links)
	if len(receiptIDs) > 0 {
		receipts, err := h.advanceRepo.FetchReceiptsByIDs(ctx, receiptIDs)
		if err != nil {
			return nil, fmt.Errorf("fetch receipts: %w", err)
		}
		vctx.AdvanceReceipts = receipts

		if err := h.enrichSuspectProposals(ctx, vctx, receipts); err != nil {
			return nil, err
		}
	}

	return vctx, nil
}

// enrichSuspectProposals populates SuspectProposalIDs by checking which proposals
// linked to the batch receipts are marked SUSPICIOUS in canonical_proposals.
func (h *AdvanceBatchHandler) enrichSuspectProposals(
	ctx context.Context,
	vctx *rules.ValidationContext,
	receipts []domain.AdvanceReceipt,
) error {
	proposalIDs := make([]string, 0, len(receipts))
	seen := make(map[string]bool, len(receipts))
	for _, rec := range receipts {
		if rec.ProposalID != "" && !seen[rec.ProposalID] {
			proposalIDs = append(proposalIDs, rec.ProposalID)
			seen[rec.ProposalID] = true
		}
	}
	if len(proposalIDs) == 0 {
		return nil
	}

	suspectIDs, err := h.statusChecker.FetchSuspiciousByProposalIDs(ctx, proposalIDs)
	if err != nil {
		return fmt.Errorf("fetch suspect proposals: %w", err)
	}
	for _, pid := range suspectIDs {
		vctx.SuspectProposalIDs[pid] = true
	}
	return nil
}

func uniqueReceiptIDs(links []domain.AdvanceReportReceipt) []string {
	seen := make(map[string]bool, len(links))
	ids := make([]string, 0, len(links))
	for _, link := range links {
		if !seen[link.ReceiptID] {
			ids = append(ids, link.ReceiptID)
			seen[link.ReceiptID] = true
		}
	}
	return ids
}

func buildAdvanceCanonicals(vctx *rules.ValidationContext, results []rules.RuleResult) []domain.CanonicalAdvanceReport {
	violationIndex := make(map[string][]domain.AdvanceViolation)
	for _, r := range results {
		for advID, reason := range r.FlaggedProposals {
			violationIndex[advID] = append(violationIndex[advID], domain.AdvanceViolation{
				Rule:   r.RuleName,
				Reason: reason,
			})
		}
	}

	now := time.Now()
	out := make([]domain.CanonicalAdvanceReport, len(vctx.AdvanceReports))
	for i, ar := range vctx.AdvanceReports {
		rec := domain.CanonicalAdvanceReport{
			AdvanceReportID: ar.ID,
			TenantID:        ar.TenantID,
			Status:          domain.AdvanceReportStatusClean,
			Violations:      []domain.AdvanceViolation{},
			AmountToPay:     ar.AmountToPay,
			BrokerID:        ar.BrokerID,
			IsPaid:          ar.IsPaid,
			IsCancelled:     ar.IsCancelled,
			CreatedAt:       now,
		}
		if violations, found := violationIndex[ar.ID]; found {
			rec.Status = domain.AdvanceReportStatusSuspicious
			rec.Violations = violations
		}
		out[i] = rec
	}
	return out
}
