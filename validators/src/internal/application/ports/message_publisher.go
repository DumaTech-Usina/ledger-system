package ports

import "context"

// MessagePublisher sends a payload to a message broker under a routing key.
// The payload is serialized by the implementation (typically JSON).
// Implemented by rabbitmq.Publisher; test doubles use MockMessagePublisher.
type MessagePublisher interface {
	Publish(ctx context.Context, routingKey string, payload any) error
}
