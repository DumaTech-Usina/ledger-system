package jobs

import (
	"context"
	"encoding/json"
	"fmt"

	"validators/src/internal/application/ports"
	"validators/src/internal/engine"
	"validators/src/internal/messaging/messages"
	"validators/src/internal/rules"
)

// ReceiptCanonicalHandler implements ports.MessageHandler for ReceiptCanonicalBatch
// messages. Each message carries a pre-determined page of canonical proposal IDs;
// the handler fetches receipts for those IDs, validates them, and upserts the
// canonical records keyed on receipt_id — safe to replay.
type ReceiptCanonicalHandler struct {
	receiptRepo   ports.ReceiptRepository
	canonicalRepo ports.AspiantReceiptCanonicalRepository
	eng           *engine.ValidationEngine
}

func NewReceiptCanonicalHandler(
	receiptRepo ports.ReceiptRepository,
	canonicalRepo ports.AspiantReceiptCanonicalRepository,
	eng *engine.ValidationEngine,
) *ReceiptCanonicalHandler {
	return &ReceiptCanonicalHandler{
		receiptRepo:   receiptRepo,
		canonicalRepo: canonicalRepo,
		eng:           eng,
	}
}

// Handle deserializes the batch, fetches receipts, validates, and upserts canonicals.
// A non-nil error causes the worker to nack the message to the DLQ.
func (h *ReceiptCanonicalHandler) Handle(ctx context.Context, body []byte) error {
	var batch messages.ReceiptCanonicalBatch
	if err := json.Unmarshal(body, &batch); err != nil {
		return fmt.Errorf("invalid batch payload: %w", err)
	}

	receipts, err := h.receiptRepo.FetchAllByProposalIDs(ctx, batch.ProposalIDs)
	if err != nil {
		return fmt.Errorf("batch_id=%s receipt fetch: %w", batch.BatchID, err)
	}

	vctx := rules.NewValidationContext()
	vctx.CanonicalReceipts = receipts
	results := h.eng.Run(ctx, vctx)
	canonicals := buildReceiptCanonicals(receipts, results)

	if err := h.canonicalRepo.SaveAll(ctx, canonicals); err != nil {
		return fmt.Errorf("batch_id=%s save: %w", batch.BatchID, err)
	}
	return nil
}
