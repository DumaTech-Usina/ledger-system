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
	advanceRules "validators/src/internal/rules/advances"
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
		log.Fatal("[advance-batch-consumer] failed to connect:", err)
	}

	if err := infraMongo.EnsureIndexes(ctx, conns.MongoDB); err != nil {
		log.Fatal("[advance-batch-consumer] failed to ensure indexes:", err)
	}

	advanceRepo := infraPostgres.NewAdvanceReportRepository(conns.Postgres)
	canonicalRepo := infraMongo.NewAspiantAdvanceCanonicalRepository(conns.MongoDB)
	statusChecker := infraMongo.NewCanonicalProposalReader(conns.MongoDB)
	auditRepo := infraMongo.NewAuditRepository(conns.MongoDB)

	ruleRegistry := engine.NewRegistry()
	ruleRegistry.MustRegister(advanceRules.NewRuleAdv001())
	ruleRegistry.MustRegister(advanceRules.NewRuleAdv002())
	ruleRegistry.MustRegister(advanceRules.NewRuleAdv003())
	ruleRegistry.MustRegister(advanceRules.NewRuleAdv004())
	ruleRegistry.MustRegister(advanceRules.NewRuleAdv005())
	ruleRegistry.MustRegister(advanceRules.NewRuleAdv006())
	ruleRegistry.MustRegister(advanceRules.NewRuleAdv007())
	ruleRegistry.MustRegister(advanceRules.NewRuleAdv008())
	ruleRegistry.MustRegister(advanceRules.NewRuleAdv009())
	ruleRegistry.MustRegister(advanceRules.NewRuleAdv010())
	eng := engine.NewValidationEngine(ruleRegistry, engine.Sequential)

	handler := jobs.NewAdvanceBatchHandler(advanceRepo, canonicalRepo, statusChecker, auditRepo, eng)

	worker := rabbitmq.NewWorker(amqpURL, rabbitmq.WorkerConfig{
		Queue:      "validators.advances.batch",
		RoutingKey: "validation.advances.batch",
		DLQueue:    "validators.advances.batch.dead",
	}, handler)

	log.Println("[advance-batch-consumer] starting — waiting for advance report batches")

	if err := worker.Start(ctx); err != nil && !errors.Is(err, context.Canceled) {
		log.Fatal("[advance-batch-consumer] fatal:", err)
	}

	log.Println("[advance-batch-consumer] shutting down")
}
