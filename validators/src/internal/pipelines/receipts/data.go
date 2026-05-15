package receipts

import (
	"validators/src/internal/domain"
	"validators/src/internal/rules"
)

// Data is the shared state flowing through the receipts pipeline stages.
type Data struct {
	Proposals     []domain.CanonicalProposal
	ValidationCtx *rules.ValidationContext
	Results       []rules.RuleResult
	Canonicals    []domain.AspiantReceiptCanonical
}
