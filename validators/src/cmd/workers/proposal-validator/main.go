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
	"validators/src/internal/engine"
	infraConfig "validators/src/internal/infrastructure/config"
	infraMongo "validators/src/internal/infrastructure/mongodb"
	infraPostgres "validators/src/internal/infrastructure/postgres"
	"validators/src/internal/pipelines/proposals"
	proposalRules "validators/src/internal/rules/proposals"
)

const pollInterval = 30 * time.Second

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	conns, err := infraConfig.Connect(
		"postgres://developer:postgres@localhost:5432/usina?sslmode=disable",
		"mongodb://root:rootpassword@localhost:27017",
		"rules_engine_v3",
	)
	if err != nil {
		log.Fatal("failed to connect:", err)
	}

	if err := infraMongo.EnsureIndexes(ctx, conns.MongoDB); err != nil {
		log.Fatal("[proposal-validator] failed to ensure indexes:", err)
	}

	proposalRepo := infraPostgres.NewProposalRepository(conns.Postgres)
	receiptRepo := infraPostgres.NewReceiptRepository(conns.Postgres)
	auditRepo := infraMongo.NewAuditRepository(conns.MongoDB)

	ruleRegistry := engine.NewRegistry()
	ruleRegistry.MustRegister(proposalRules.NewRule001())
	ruleRegistry.MustRegister(proposalRules.NewRule002())
	ruleRegistry.MustRegister(proposalRules.NewRule003())
	ruleRegistry.MustRegister(proposalRules.NewRule004())
	eng := engine.NewValidationEngine(ruleRegistry, engine.Sequential)

	runner := proposals.Build(proposals.Deps{
		ProposalRepo: proposalRepo,
		ReceiptRepo:  receiptRepo,
		AuditRepo:    auditRepo,
		Engine:       eng,
	})

	job := jobs.NewProposalValidatorJob(runner)

	log.Printf("[proposal-validator] starting — polling every %s", pollInterval)

	if err := job.StartPolling(ctx, pollInterval); err != nil && !errors.Is(err, context.Canceled) {
		log.Fatal("[proposal-validator] fatal:", err)
	}

	log.Println("[proposal-validator] shutting down")
}
