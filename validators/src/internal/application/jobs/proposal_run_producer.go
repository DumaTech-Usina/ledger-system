package jobs

import (
	"context"
	"log"
	"time"

	"github.com/google/uuid"

	"validators/src/internal/application/ports"
	"validators/src/internal/messaging/messages"
)

const proposalRoutingKey = "validation.proposals"

// ProposalRunProducer publishes a ProposalRunTrigger to the broker on a polling
// interval. The consumer (ProposalValidationHandler) receives the trigger and runs
// the full pipeline — FetchAll → cluster → validate → aggregate.
//
// One trigger per interval is enough because the pipeline always scans the entire
// proposals table; there is no per-record batching at this stage.
type ProposalRunProducer struct {
	publisher ports.MessagePublisher
}

func NewProposalRunProducer(publisher ports.MessagePublisher) *ProposalRunProducer {
	return &ProposalRunProducer{publisher: publisher}
}

// Trigger publishes a single run trigger with a fresh UUID as the idempotency key.
func (p *ProposalRunProducer) Trigger(ctx context.Context) error {
	return p.publisher.Publish(ctx, proposalRoutingKey, messages.ProposalRunTrigger{
		RunID:       uuid.New().String(),
		TriggeredAt: time.Now(),
	})
}

// StartPolling publishes a trigger every interval until ctx is cancelled.
// Publish failures are logged but do not stop the loop.
func (p *ProposalRunProducer) StartPolling(ctx context.Context, interval time.Duration) error {
	for {
		if err := p.Trigger(ctx); err != nil {
			log.Printf("[ProposalRunProducer] failed to publish trigger: %v", err)
		}
		select {
		case <-time.After(interval):
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}
