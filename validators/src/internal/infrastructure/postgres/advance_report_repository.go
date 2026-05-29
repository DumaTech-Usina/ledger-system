package postgres

import (
	"context"
	"database/sql"

	"github.com/lib/pq"

	"validators/src/internal/domain"
)

// AdvanceReportRepository implements ports.AdvanceReportRepository against PostgreSQL.
// All queries are scoped to tenant_id = 1 (lab mode).
type AdvanceReportRepository struct {
	db *sql.DB
}

func NewAdvanceReportRepository(db *sql.DB) *AdvanceReportRepository {
	return &AdvanceReportRepository{db: db}
}

func (r *AdvanceReportRepository) CountAll(ctx context.Context) (int, error) {
	var count int
	err := r.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM advance_reports WHERE tenant_id = 1`,
	).Scan(&count)
	return count, err
}

// FetchBatch returns at most limit rows with id > afterID, sorted ascending.
func (r *AdvanceReportRepository) FetchBatch(ctx context.Context, afterID string, limit int) ([]domain.AdvanceReport, error) {
	var rows *sql.Rows
	var err error

	if afterID == "" {
		rows, err = r.db.QueryContext(ctx, `
			SELECT id::text, tenant_id,
			       COALESCE(is_paid, false),
			       COALESCE(is_canceled, false),
			       COALESCE(amount_to_pay, 0)::numeric,
			       COALESCE(advance_fee, 0)::numeric,
			       COALESCE(broker_id::text, '')
			FROM advance_reports
			WHERE tenant_id = 1
			ORDER BY id
			LIMIT $1
		`, limit)
	} else {
		rows, err = r.db.QueryContext(ctx, `
			SELECT id::text, tenant_id,
			       COALESCE(is_paid, false),
			       COALESCE(is_canceled, false),
			       COALESCE(amount_to_pay, 0)::numeric,
			       COALESCE(advance_fee, 0)::numeric,
			       COALESCE(broker_id::text, '')
			FROM advance_reports
			WHERE tenant_id = 1
			  AND id::text > $1
			ORDER BY id
			LIMIT $2
		`, afterID, limit)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanAdvanceReports(rows)
}

func (r *AdvanceReportRepository) FetchByIDs(ctx context.Context, ids []string) ([]domain.AdvanceReport, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id::text, tenant_id,
		       COALESCE(is_paid, false),
		       COALESCE(is_canceled, false),
		       COALESCE(amount_to_pay, 0)::numeric,
		       COALESCE(advance_fee, 0)::numeric,
		       COALESCE(broker_id::text, '')
		FROM advance_reports
		WHERE id::text = ANY($1)
	`, pq.Array(ids))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanAdvanceReports(rows)
}

func (r *AdvanceReportRepository) FetchActiveReceiptLinks(ctx context.Context, advanceIDs []string) ([]domain.AdvanceReportReceipt, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT advance_report_id::text, receipt_id::text, is_active
		FROM advance_report_receipts
		WHERE advance_report_id::text = ANY($1)
		  AND is_active = true
	`, pq.Array(advanceIDs))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var links []domain.AdvanceReportReceipt
	for rows.Next() {
		var l domain.AdvanceReportReceipt
		if err := rows.Scan(&l.AdvanceReportID, &l.ReceiptID, &l.IsActive); err != nil {
			return nil, err
		}
		links = append(links, l)
	}
	return links, rows.Err()
}

func (r *AdvanceReportRepository) FetchReceiptsByIDs(ctx context.Context, receiptIDs []string) ([]domain.AdvanceReceipt, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id::text,
		       COALESCE(proposal_id::text, ''),
		       COALESCE(amount_to_pay, 0)::numeric,
		       COALESCE(broker_id::text, '')
		FROM receipts
		WHERE id::text = ANY($1)
	`, pq.Array(receiptIDs))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var receipts []domain.AdvanceReceipt
	for rows.Next() {
		var rec domain.AdvanceReceipt
		if err := rows.Scan(&rec.ID, &rec.ProposalID, &rec.AmountToPay, &rec.BrokerID); err != nil {
			return nil, err
		}
		receipts = append(receipts, rec)
	}
	return receipts, rows.Err()
}

func scanAdvanceReports(rows *sql.Rows) ([]domain.AdvanceReport, error) {
	var reports []domain.AdvanceReport
	for rows.Next() {
		var ar domain.AdvanceReport
		if err := rows.Scan(
			&ar.ID, &ar.TenantID,
			&ar.IsPaid, &ar.IsCancelled,
			&ar.AmountToPay, &ar.AdvanceFee,
			&ar.BrokerID,
		); err != nil {
			return nil, err
		}
		reports = append(reports, ar)
	}
	return reports, rows.Err()
}
