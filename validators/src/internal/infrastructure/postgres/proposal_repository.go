package postgres

import (
	"context"
	"database/sql"

	"validators/src/internal/domain"
)

type ProposalRepository struct {
	db *sql.DB
}

func NewProposalRepository(db *sql.DB) *ProposalRepository {
	return &ProposalRepository{db: db}
}

func (r *ProposalRepository) FetchAll(ctx context.Context) ([]domain.Proposal, error) {
	query := `
		SELECT
			id::text,
			proposal_number,
			COALESCE(proposal_value, 0)::numeric,
			COALESCE(client_id::text, ''),
			COALESCE(plan_id::text, ''),
			COALESCE(effective_date::text, '')
		FROM proposals
		WHERE proposal_number IS NOT NULL
		  AND TRIM(proposal_number) != ''
	`
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var proposals []domain.Proposal
	for rows.Next() {
		var p domain.Proposal
		if err := rows.Scan(&p.ID, &p.Number, &p.Value, &p.ClientID, &p.PlanID, &p.EffectiveDate); err != nil {
			return nil, err
		}
		proposals = append(proposals, p)
	}
	return proposals, rows.Err()
}

func (r *ProposalRepository) CountTotal(ctx context.Context) (int, error) {
	var count int
	err := r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM proposals`).Scan(&count)
	return count, err
}

func (r *ProposalRepository) CountInvalidNumbers(ctx context.Context) (int, error) {
	var count int
	err := r.db.QueryRowContext(ctx, `
		SELECT COUNT(*)
		FROM proposals
		WHERE proposal_number IS NULL
		   OR TRIM(proposal_number) = ''
		   OR proposal_number ~ '^0+$'
	`).Scan(&count)
	return count, err
}

func (r *ProposalRepository) FetchInvalidNumberProposalIDs(ctx context.Context) ([]string, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id::text
		FROM proposals
		WHERE proposal_number IS NULL
		   OR TRIM(proposal_number) = ''
		   OR proposal_number ~ '^0+$'
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
