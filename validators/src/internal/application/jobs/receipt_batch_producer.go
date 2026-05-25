package jobs

import (
	"context"
	"crypto/sha256"
	"fmt"
	"log"
	"sort"
	"time"

	"validators/src/internal/application/ports"
	"validators/src/internal/messaging/messages"
)

const receiptRoutingKey = "validation.receipts"

// ReceiptBatchProducer pages through CLEAN canonical proposals and publishes
// one ReceiptCanonicalBatch message per page. Each batch carries a deterministic
// BatchID (SHA-256 of sorted proposal IDs) so re-delivering the same batch is safe:
// the consumer's upsert-by-receipt_id writes are idempotent.
type ReceiptBatchProducer struct {
	reader    ports.CanonicalProposalReader
	publisher ports.MessagePublisher
	batchSize int
}

func NewReceiptBatchProducer(
	reader ports.CanonicalProposalReader,
	publisher ports.MessagePublisher,
	batchSize int,
) *ReceiptBatchProducer {
	return &ReceiptBatchProducer{reader: reader, publisher: publisher, batchSize: batchSize}
}

// Run pages through all CLEAN proposals, publishing one message per page.
// Returns the total number of proposals dispatched.
// Stops and returns an error if a fetch or publish fails — the caller retries on the next interval.
func (p *ReceiptBatchProducer) Run(ctx context.Context) (int, error) {
	anchor := ""
	total := 0
	for {
		batch, err := p.reader.FetchCleanBatch(ctx, anchor, p.batchSize)
		if err != nil {
			return total, fmt.Errorf("fetch batch (anchor=%q): %w", anchor, err)
		}
		if len(batch) == 0 {
			return total, nil
		}

		ids := make([]string, len(batch))
		for i, prop := range batch {
			ids[i] = prop.ProposalID
		}
		anchor = batch[len(batch)-1].ProposalID

		msg := messages.ReceiptCanonicalBatch{
			BatchID:     computeBatchID(ids),
			Anchor:      anchor,
			ProposalIDs: ids,
		}
		if err := p.publisher.Publish(ctx, receiptRoutingKey, msg); err != nil {
			return total, fmt.Errorf("publish batch (anchor=%q): %w", anchor, err)
		}
		total += len(batch)
	}
}

// StartPolling runs a full scan every interval until ctx is cancelled.
// Errors on individual runs are logged but do not stop the loop.
func (p *ReceiptBatchProducer) StartPolling(ctx context.Context, interval time.Duration) error {
	for {
		if _, err := p.Run(ctx); err != nil {
			log.Printf("[ReceiptBatchProducer] run error: %v", err)
		}
		select {
		case <-time.After(interval):
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

// computeBatchID returns a deterministic SHA-256 fingerprint of the sorted
// proposal IDs. The null-byte separator prevents hash collisions between
// ID sets that share a common concatenation (e.g. ["ab","c"] vs ["a","bc"]).
func computeBatchID(proposalIDs []string) string {
	sorted := make([]string, len(proposalIDs))
	copy(sorted, proposalIDs)
	sort.Strings(sorted)
	h := sha256.New()
	for _, id := range sorted {
		h.Write([]byte(id))
		h.Write([]byte{0})
	}
	return fmt.Sprintf("%x", h.Sum(nil))
}
