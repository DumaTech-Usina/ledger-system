package rabbitmq

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"

	"validators/src/internal/application/ports"
)

const dlx = "validators.dlx"

// WorkerConfig describes the queue topology for a single consumer.
type WorkerConfig struct {
	Queue      string // main queue name
	RoutingKey string // routing key on the validators exchange
	DLQueue    string // dead-letter queue name
}

// Worker is a long-lived AMQP consumer that reconnects automatically.
// It mirrors the StagingWorker pattern from the ledger service:
//   - outer Start() loop handles reconnection after any connection-level error
//   - inner connect() blocks until the context is cancelled or the connection drops
//   - handler errors nack the message to the DLQ; success acks
type Worker struct {
	amqpURL string
	cfg     WorkerConfig
	handler ports.MessageHandler
}

func NewWorker(amqpURL string, cfg WorkerConfig, handler ports.MessageHandler) *Worker {
	return &Worker{amqpURL: amqpURL, cfg: cfg, handler: handler}
}

// Start blocks until ctx is cancelled, reconnecting after every connection failure.
func (w *Worker) Start(ctx context.Context) error {
	for {
		if err := w.connect(ctx); err != nil {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			log.Printf("[%s] disconnected, reconnecting in 5s: %v", w.cfg.Queue, err)
			select {
			case <-time.After(5 * time.Second):
			case <-ctx.Done():
				return ctx.Err()
			}
		}
	}
}

// connect opens a channel, declares the full queue topology, and consumes
// messages until the context is cancelled or a connection-level error occurs.
func (w *Worker) connect(ctx context.Context) error {
	conn, err := amqp.Dial(w.amqpURL)
	if err != nil {
		return err
	}
	defer conn.Close()

	ch, err := conn.Channel()
	if err != nil {
		return err
	}
	defer ch.Close()

	if err := w.declareTopology(ch); err != nil {
		return err
	}

	if err := ch.Qos(1, 0, false); err != nil {
		return fmt.Errorf("qos: %w", err)
	}

	msgs, err := ch.Consume(w.cfg.Queue, "", false, false, false, false, nil)
	if err != nil {
		return fmt.Errorf("consume: %w", err)
	}

	log.Printf("[%s] connected, waiting for messages", w.cfg.Queue)

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case msg, ok := <-msgs:
			if !ok {
				return errors.New("delivery channel closed")
			}
			if err := w.handler.Handle(ctx, msg.Body); err != nil {
				log.Printf("[%s] handler error, sending to DLQ: %v", w.cfg.Queue, err)
				_ = msg.Nack(false, false)
			} else {
				_ = msg.Ack(false)
			}
		}
	}
}

func (w *Worker) declareTopology(ch *amqp.Channel) error {
	if err := ch.ExchangeDeclare(dlx, "direct", true, false, false, false, nil); err != nil {
		return fmt.Errorf("dlx declare: %w", err)
	}
	if _, err := ch.QueueDeclare(w.cfg.DLQueue, true, false, false, false, nil); err != nil {
		return fmt.Errorf("dlq declare: %w", err)
	}
	if err := ch.QueueBind(w.cfg.DLQueue, w.cfg.RoutingKey, dlx, false, nil); err != nil {
		return fmt.Errorf("dlq bind: %w", err)
	}
	if err := ch.ExchangeDeclare(exchange, "direct", true, false, false, false, nil); err != nil {
		return fmt.Errorf("exchange declare: %w", err)
	}
	if _, err := ch.QueueDeclare(w.cfg.Queue, true, false, false, false, amqp.Table{
		"x-dead-letter-exchange": dlx,
	}); err != nil {
		return fmt.Errorf("queue declare: %w", err)
	}
	if err := ch.QueueBind(w.cfg.Queue, w.cfg.RoutingKey, exchange, false, nil); err != nil {
		return fmt.Errorf("queue bind: %w", err)
	}
	return nil
}
