package ports

import (
	"context"

	"validators/src/internal/domain"
)

// AspiantReceiptCanonicalRepository persists canonicalized receipt records
// to the aspirant_receipt_canonical MongoDB collection.
type AspiantReceiptCanonicalRepository interface {
	SaveAll(ctx context.Context, records []domain.AspiantReceiptCanonical) error
}
