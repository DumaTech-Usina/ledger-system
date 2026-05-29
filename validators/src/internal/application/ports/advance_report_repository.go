package ports

import (
	"context"

	"validators/src/internal/domain"
)

// AdvanceReportRepository provides access to advance_reports and related tables.
// All read methods are scoped to tenant_id = 1 (lab mode).
type AdvanceReportRepository interface {
	// CountAll returns the total number of advance_reports for tenant 1.
	CountAll(ctx context.Context) (int, error)

	// FetchBatch returns at most limit advance_reports whose ID is strictly
	// greater than afterID, sorted ascending. Pass an empty afterID to start
	// from the beginning. Used by AdvanceBatchProducer for cursor pagination.
	FetchBatch(ctx context.Context, afterID string, limit int) ([]domain.AdvanceReport, error)

	// FetchByIDs returns the advance_reports for the given IDs.
	// Used by AdvanceBatchHandler to reload full records from a published batch.
	FetchByIDs(ctx context.Context, ids []string) ([]domain.AdvanceReport, error)

	// FetchActiveReceiptLinks returns all active advance_report_receipts entries
	// for the given advance report IDs.
	FetchActiveReceiptLinks(ctx context.Context, advanceIDs []string) ([]domain.AdvanceReportReceipt, error)

	// FetchReceiptsByIDs returns the advance-relevant receipt projection for
	// the given receipt IDs (amount, amount_to_pay, broker_id, proposal_id).
	FetchReceiptsByIDs(ctx context.Context, receiptIDs []string) ([]domain.AdvanceReceipt, error)
}
