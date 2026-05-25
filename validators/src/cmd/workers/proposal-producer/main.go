package main

import (
	"context"
	"errors"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"validators/src/internal/application/jobs"
	"validators/src/internal/messaging/rabbitmq"
)

const (
	amqpURL      = "amqp://guest:guest@localhost:5672/"
	pollInterval = 30 * time.Minute
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	publisher := rabbitmq.NewPublisher(amqpURL)
	if err := publisher.Connect(); err != nil {
		log.Fatal("[proposal-producer] failed to connect to RabbitMQ:", err)
	}
	defer publisher.Close()

	producer := jobs.NewProposalRunProducer(publisher)

	log.Printf("[proposal-producer] starting — publishing trigger every %s", pollInterval)

	if err := producer.StartPolling(ctx, pollInterval); err != nil && !errors.Is(err, context.Canceled) {
		log.Fatal("[proposal-producer] fatal:", err)
	}

	log.Println("[proposal-producer] shutting down")
}
