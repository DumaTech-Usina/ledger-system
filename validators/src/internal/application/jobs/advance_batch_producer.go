package jobs

import (
	"context"
	"crypto/sha256"
	"fmt"
	"log"
	"sort"
	"time"

	"github.com/google/uuid"

	"validators/src/internal/application/ports"
	"validators/src/internal/messaging/messages"
)

const advanceBatchRoutingKey = "validation.advances.batch"

// AdvanceBatchProducer pages through advance_reports (tenant_id = 1 in lab mode)
// and publishes one AdvanceBatch message per page. All messages in a single scan
// cycle share the same RunID so rule-run audit records can be correlated.
//
// BatchID = SHA-256(sorted advance_report_ids) is deterministic and safe to replay
// because the consumer's writes to aspirant_advance_canonical are upserts keyed
// on advance_report_id.
type AdvanceBatchProducer struct {
	advanceRepo ports.AdvanceReportRepository
	publisher   ports.MessagePublisher
	batchSize   int
}

func NewAdvanceBatchProducer(
	advanceRepo ports.AdvanceReportRepository,
	publisher ports.MessagePublisher,
	batchSize int,
) *AdvanceBatchProducer {
	return &AdvanceBatchProducer{
		advanceRepo: advanceRepo,
		publisher:   publisher,
		batchSize:   batchSize,
	}
}

// Run pages through all advance reports and publishes one message per page.
// Returns the total number of advance reports dispatched.
// Stops and returns an error if a fetch or publish fails — the caller retries
// on the next polling interval.
func (p *AdvanceBatchProducer) Run(ctx context.Context) (int, error) {
	runID := uuid.New().String()
	anchor := ""
	total := 0

	for {
		batch, err := p.advanceRepo.FetchBatch(ctx, anchor, p.batchSize)
		if err != nil {
			return total, fmt.Errorf("fetch batch (anchor=%q): %w", anchor, err)
		}
		if len(batch) == 0 {
			return total, nil
		}

		ids := make([]string, len(batch))
		for i, ar := range batch {
			ids[i] = ar.ID
		}
		anchor = batch[len(batch)-1].ID

		msg := messages.AdvanceBatch{
			RunID:            runID,
			BatchID:          computeAdvanceBatchID(ids),
			Anchor:           anchor,
			AdvanceReportIDs: ids,
		}
		if err := p.publisher.Publish(ctx, advanceBatchRoutingKey, msg); err != nil {
			return total, fmt.Errorf("publish batch (anchor=%q): %w", anchor, err)
		}
		total += len(batch)
	}
}

// StartPolling runs a full scan every interval until ctx is cancelled.
// Errors on individual runs are logged but do not stop the loop.
func (p *AdvanceBatchProducer) StartPolling(ctx context.Context, interval time.Duration) error {
	for {
		if _, err := p.Run(ctx); err != nil {
			log.Printf("[AdvanceBatchProducer] run error: %v", err)
		}
		select {
		case <-time.After(interval):
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

// computeAdvanceBatchID returns a deterministic SHA-256 fingerprint of the sorted
// advance report IDs. The null-byte separator prevents hash collisions between
// ID sets that share a common concatenation.
func computeAdvanceBatchID(ids []string) string {
	sorted := make([]string, len(ids))
	copy(sorted, ids)
	sort.Strings(sorted)
	h := sha256.New()
	for _, id := range sorted {
		h.Write([]byte(id))
		h.Write([]byte{0})
	}
	return fmt.Sprintf("%x", h.Sum(nil))
}
