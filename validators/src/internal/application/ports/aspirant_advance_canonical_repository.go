package ports

import (
	"context"

	"validators/src/internal/domain"
)

// AspiantAdvanceCanonicalRepository persists the per-advance verdict to the
// aspirant_advance_canonical MongoDB collection after validation runs.
type AspiantAdvanceCanonicalRepository interface {
	SaveAll(ctx context.Context, records []domain.CanonicalAdvanceReport) error
}
