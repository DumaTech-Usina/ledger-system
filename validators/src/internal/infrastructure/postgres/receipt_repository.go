package postgres

import (
	"context"
	"database/sql"

	"github.com/lib/pq"

	"validators/src/internal/domain"
)

type ReceiptRepository struct {
	db *sql.DB
}

func NewReceiptRepository(db *sql.DB) *ReceiptRepository {
	return &ReceiptRepository{db: db}
}

func (r *ReceiptRepository) FetchPaidByProposalIDs(ctx context.Context, proposalIDs []string) ([]domain.Receipt, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT r.id::text, r.proposal_id::text, p.proposal_number,
		       r.installment_number, p.created_at
		FROM receipts r
		JOIN proposals p ON p.id = r.proposal_id
		WHERE r.payment_status = 'PAGO'
		  AND r.proposal_id = ANY($1::integer[])
	`, pq.Array(proposalIDs))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var receipts []domain.Receipt
	for rows.Next() {
		var rec domain.Receipt
		if err := rows.Scan(&rec.ID, &rec.ProposalID, &rec.ProposalNumber,
			&rec.InstallmentNumber, &rec.CreatedAt); err != nil {
			return nil, err
		}
		receipts = append(receipts, rec)
	}
	return receipts, rows.Err()
}

func (r *ReceiptRepository) CountDistinctPaidProposals(ctx context.Context) (int, error) {
	var count int
	err := r.db.QueryRowContext(ctx,
		`SELECT COUNT(DISTINCT proposal_id) FROM receipts WHERE payment_status = 'PAGO'`,
	).Scan(&count)
	return count, err
}

func (r *ReceiptRepository) CountFalseDelinquents(ctx context.Context) (int, error) {
	var count int
	err := r.db.QueryRowContext(ctx, `
		WITH PaidMax AS (
			SELECT proposal_id, MAX(installment_number) AS max_paid
			FROM receipts
			WHERE payment_status = 'PAGO'
			GROUP BY proposal_id
		)
		SELECT COUNT(*)
		FROM receipts r
		JOIN PaidMax pm ON r.proposal_id = pm.proposal_id
		WHERE r.payment_status NOT IN ('PAGO', 'canceled_duplicate')
		  AND r.installment_number < pm.max_paid
	`).Scan(&count)
	return count, err
}

func (r *ReceiptRepository) FetchAllByProposalIDs(ctx context.Context, proposalIDs []string) ([]domain.Receipt, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT r.id::text, r.proposal_id::text, p.proposal_number,
		       r.installment_number, r.payment_status,
		       COALESCE(TRIM(TO_CHAR(r.downloaded_value, 'FM999999999990.00')), '') AS downloaded_value,
		       r.discharge_date,
		       COALESCE(r.receipt_status, '') AS receipt_status,
		       COALESCE(r.installment_percentage, 0)::numeric,
		       COALESCE(r.amount_to_pay, 0)::numeric,
		       p.created_at
		FROM receipts r
		JOIN proposals p ON p.id = r.proposal_id
		WHERE r.proposal_id = ANY($1::integer[])
	`, pq.Array(proposalIDs))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var receipts []domain.Receipt
	for rows.Next() {
		var rec domain.Receipt
		if err := rows.Scan(
			&rec.ID, &rec.ProposalID, &rec.ProposalNumber,
			&rec.InstallmentNumber, &rec.PaymentStatus,
			&rec.DownloadedValue, &rec.DischargeDate,
			&rec.ReceiptStatus,
			&rec.InstallmentPercentage, &rec.AmountToPay,
			&rec.CreatedAt,
		); err != nil {
			return nil, err
		}
		receipts = append(receipts, rec)
	}
	return receipts, rows.Err()
}

func (r *ReceiptRepository) FetchActiveReceiptLinksByReceiptIDs(ctx context.Context, receiptIDs []string) ([]domain.AdvanceReportReceipt, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT advance_report_id::text, receipt_id::text, is_active
		FROM advance_report_receipts
		WHERE receipt_id::text = ANY($1)
		  AND is_active = true
	`, pq.Array(receiptIDs))
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

// Help the Rule-003
func (r *ReceiptRepository) FetchFalseDelinquentProposalIDs(ctx context.Context) ([]string, error) {
	rows, err := r.db.QueryContext(ctx, `
		WITH PaidMax AS (
			SELECT proposal_id, MAX(installment_number) AS max_paid
			FROM receipts
			WHERE payment_status = 'PAGO'
			GROUP BY proposal_id
		)
		SELECT DISTINCT r.proposal_id::text
		FROM receipts r
		JOIN PaidMax pm ON r.proposal_id = pm.proposal_id
		WHERE r.payment_status NOT IN ('PAGO', 'canceled_duplicate')
		  AND r.installment_number < pm.max_paid
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}
