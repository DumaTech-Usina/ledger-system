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
	infraConfig "validators/src/internal/infrastructure/config"
	infraMongo "validators/src/internal/infrastructure/mongodb"
	"validators/src/internal/messaging/rabbitmq"
)

const (
	amqpURL      = "amqp://guest:guest@localhost:5672/"
	batchSize    = 100
	pollInterval = 5 * time.Minute
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	conns, err := infraConfig.Connect(
		"postgres://developer:postgres@localhost:5432/usina?sslmode=disable",
		"mongodb://root:rootpassword@localhost:27017",
		"rules_engine_v3",
	)
	if err != nil {
		log.Fatal("[receipt-producer] failed to connect to databases:", err)
	}

	proposalReader := infraMongo.NewCanonicalProposalReader(conns.MongoDB)

	publisher := rabbitmq.NewPublisher(amqpURL)
	if err := publisher.Connect(); err != nil {
		log.Fatal("[receipt-producer] failed to connect to RabbitMQ:", err)
	}
	defer publisher.Close()

	producer := jobs.NewReceiptBatchProducer(proposalReader, publisher, batchSize)

	log.Printf("[receipt-producer] starting — publishing batches every %s", pollInterval)

	if err := producer.StartPolling(ctx, pollInterval); err != nil && !errors.Is(err, context.Canceled) {
		log.Fatal("[receipt-producer] fatal:", err)
	}

	log.Println("[receipt-producer] shutting down")
}
