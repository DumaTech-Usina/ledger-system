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
		  AND r.proposal_id::text = ANY($1)
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
