package jobs

import (
	"context"
	"crypto/sha256"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"

	"validators/src/internal/application/ports"
	"validators/src/internal/messaging/messages"
)

const proposalBatchRoutingKey = "validation.proposals.batch"

// ProposalBatchProducer enumerates every distinct blocking key from Postgres and
// publishes one ProposalBlockBatch message per key. All messages in a single Run
// share the same RunID so consumers can link their canonical records to the same
// scan cycle.
//
// Coverage guarantee: the full key list is fetched in one query before any
// message is published, so no key is skipped regardless of consumer throughput.
type ProposalBatchProducer struct {
	proposalRepo ports.ProposalRepository
	publisher    ports.MessagePublisher
}

func NewProposalBatchProducer(
	proposalRepo ports.ProposalRepository,
	publisher ports.MessagePublisher,
) *ProposalBatchProducer {
	return &ProposalBatchProducer{proposalRepo: proposalRepo, publisher: publisher}
}

// Run fetches all distinct blocking keys and publishes one message per key.
// Returns the total number of keys dispatched.
// Stops immediately if a fetch or publish fails — the caller retries on the next interval.
func (p *ProposalBatchProducer) Run(ctx context.Context) (int, error) {
	keys, err := p.proposalRepo.FetchDistinctBlockingKeys(ctx)
	if err != nil {
		return 0, fmt.Errorf("fetch blocking keys: %w", err)
	}
	if len(keys) == 0 {
		return 0, nil
	}

	runID := uuid.New().String()
	for _, key := range keys {
		msg := messages.ProposalBlockBatch{
			RunID:       runID,
			BatchID:     computeBlockBatchID(key),
			BlockingKey: key,
		}
		if err := p.publisher.Publish(ctx, proposalBatchRoutingKey, msg); err != nil {
			return 0, fmt.Errorf("publish blocking key %q: %w", key, err)
		}
	}
	return len(keys), nil
}

// StartPolling runs a full scan every interval until ctx is cancelled.
// Errors on individual runs are logged but do not stop the loop.
func (p *ProposalBatchProducer) StartPolling(ctx context.Context, interval time.Duration) error {
	for {
		if _, err := p.Run(ctx); err != nil {
			log.Printf("[ProposalBatchProducer] run error: %v", err)
		}
		select {
		case <-time.After(interval):
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

// computeBlockBatchID returns a deterministic SHA-256 fingerprint of the blocking key.
func computeBlockBatchID(blockingKey string) string {
	h := sha256.New()
	h.Write([]byte(blockingKey))
	return fmt.Sprintf("%x", h.Sum(nil))
}
