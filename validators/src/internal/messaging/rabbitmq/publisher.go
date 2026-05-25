package rabbitmq

import (
	"context"
	"encoding/json"
	"fmt"

	amqp "github.com/rabbitmq/amqp091-go"
)

const exchange = "validators"

// Publisher sends JSON messages to the validators exchange.
// Call Connect() once before publishing. If the connection drops,
// Publish returns an error and the caller's polling loop retries next interval.
type Publisher struct {
	amqpURL string
	conn    *amqp.Connection
	ch      *amqp.Channel
}

func NewPublisher(amqpURL string) *Publisher {
	return &Publisher{amqpURL: amqpURL}
}

func (p *Publisher) Connect() error {
	conn, err := amqp.Dial(p.amqpURL)
	if err != nil {
		return fmt.Errorf("dial: %w", err)
	}
	ch, err := conn.Channel()
	if err != nil {
		conn.Close()
		return fmt.Errorf("channel: %w", err)
	}
	if err := ch.ExchangeDeclare(exchange, "direct", true, false, false, false, nil); err != nil {
		ch.Close()
		conn.Close()
		return fmt.Errorf("exchange declare: %w", err)
	}
	p.conn = conn
	p.ch = ch
	return nil
}

// Publish marshals payload to JSON and sends it as a persistent message.
func (p *Publisher) Publish(_ context.Context, routingKey string, payload any) error {
	if p.ch == nil {
		return fmt.Errorf("publisher not connected: call Connect() first")
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal payload: %w", err)
	}
	return p.ch.Publish(exchange, routingKey, false, false, amqp.Publishing{
		ContentType:  "application/json",
		DeliveryMode: amqp.Persistent,
		Body:         body,
	})
}

func (p *Publisher) Close() {
	if p.ch != nil {
		p.ch.Close()
	}
	if p.conn != nil {
		p.conn.Close()
	}
}
