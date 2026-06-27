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
	infraPostgres "validators/src/internal/infrastructure/postgres"
	"validators/src/internal/messaging/rabbitmq"
)

const (
	amqpURL      = "amqp://guest:guest@localhost:5672/"
	pollInterval = 1 * time.Minute
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
		log.Fatal("[proposal-batch-producer] failed to connect:", err)
	}

	proposalRepo := infraPostgres.NewProposalRepository(conns.Postgres)

	publisher := rabbitmq.NewPublisher(amqpURL)
	if err := publisher.Connect(); err != nil {
		log.Fatal("[proposal-batch-producer] failed to connect to RabbitMQ:", err)
	}
	defer publisher.Close()

	producer := jobs.NewProposalBatchProducer(proposalRepo, publisher)

	log.Printf("[proposal-batch-producer] starting — publishing blocking-key batches every %s", pollInterval)

	if err := producer.StartPolling(ctx, pollInterval); err != nil && !errors.Is(err, context.Canceled) {
		log.Fatal("[proposal-batch-producer] fatal:", err)
	}

	log.Println("[proposal-batch-producer] shutting down")
}
