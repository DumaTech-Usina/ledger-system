package ports

import "context"

// MessageHandler processes a raw message body received from the broker.
// Returning a non-nil error causes the worker to nack the message (→ DLQ).
// Returning nil causes the worker to ack and move on.
// Implemented by application-layer handlers; the broker worker calls this.
type MessageHandler interface {
	Handle(ctx context.Context, body []byte) error
}
