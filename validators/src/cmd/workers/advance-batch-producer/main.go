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
	batchSize    = 100
	pollInterval = 30 * time.Minute
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
		log.Fatal("[advance-batch-producer] failed to connect:", err)
	}

	advanceRepo := infraPostgres.NewAdvanceReportRepository(conns.Postgres)

	publisher := rabbitmq.NewPublisher(amqpURL)
	if err := publisher.Connect(); err != nil {
		log.Fatal("[advance-batch-producer] failed to connect to RabbitMQ:", err)
	}
	defer publisher.Close()

	producer := jobs.NewAdvanceBatchProducer(advanceRepo, publisher, batchSize)

	log.Printf("[advance-batch-producer] starting — publishing batches of %d every %s", batchSize, pollInterval)

	if err := producer.StartPolling(ctx, pollInterval); err != nil && !errors.Is(err, context.Canceled) {
		log.Fatal("[advance-batch-producer] fatal:", err)
	}

	log.Println("[advance-batch-producer] shutting down")
}
