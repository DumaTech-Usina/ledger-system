package main

import (
	"context"
	"errors"
	"log"
	"os"
	"os/signal"
	"syscall"

	"validators/src/internal/application/jobs"
	"validators/src/internal/engine"
	infraConfig "validators/src/internal/infrastructure/config"
	infraMongo "validators/src/internal/infrastructure/mongodb"
	infraPostgres "validators/src/internal/infrastructure/postgres"
	"validators/src/internal/messaging/rabbitmq"
	receiptRules "validators/src/internal/rules/receipts"
)

const amqpURL = "amqp://guest:guest@localhost:5672/"

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	conns, err := infraConfig.Connect(
		"postgres://developer:postgres@localhost:5432/usina?sslmode=disable",
		"mongodb://root:rootpassword@localhost:27017",
		"rules_engine_v3",
	)
	if err != nil {
		log.Fatal("[receipt-consumer] failed to connect to databases:", err)
	}

	if err := infraMongo.EnsureIndexes(ctx, conns.MongoDB); err != nil {
		log.Fatal("[receipt-consumer] failed to ensure indexes:", err)
	}

	receiptRepo := infraPostgres.NewReceiptRepository(conns.Postgres)
	canonicalRepo := infraMongo.NewAspiantReceiptCanonicalRepository(conns.MongoDB)

	ruleRegistry := engine.NewRegistry()
	ruleRegistry.MustRegister(receiptRules.NewRule001())
	ruleRegistry.MustRegister(receiptRules.NewRule002())
	eng := engine.NewValidationEngine(ruleRegistry, engine.Parallel)

	handler := jobs.NewReceiptCanonicalHandler(receiptRepo, canonicalRepo, eng)

	worker := rabbitmq.NewWorker(amqpURL, rabbitmq.WorkerConfig{
		Queue:      "validators.receipts",
		RoutingKey: "validation.receipts",
		DLQueue:    "validators.receipts.dead",
	}, handler)

	log.Println("[receipt-consumer] starting — waiting for receipt batches")

	if err := worker.Start(ctx); err != nil && !errors.Is(err, context.Canceled) {
		log.Fatal("[receipt-consumer] fatal:", err)
	}

	log.Println("[receipt-consumer] shutting down")
}
