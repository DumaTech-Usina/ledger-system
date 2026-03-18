package main

import (
	"context"
	"fmt"
	"log"

	"validators/src/internal/application/usecase"
	"validators/src/internal/engine"
	infraConfig "validators/src/internal/infrastructure/config"
	infraMongo "validators/src/internal/infrastructure/mongodb"
	infraPostgres "validators/src/internal/infrastructure/postgres"
	"validators/src/internal/pipeline"
	"validators/src/internal/pipeline/stages"
	"validators/src/internal/rules/proposals"
)

func main() {
	ctx := context.Background()

	conns, err := infraConfig.Connect(
		"postgres://developer:postgres@localhost:5432/usina?sslmode=disable",
		"mongodb://root:rootpassword@localhost:27017",
		"rules_engine_v2",
	)
	if err != nil {
		log.Fatal("failed to connect:", err)
	}

	// Infrastructure adapters
	proposalRepo := infraPostgres.NewProposalRepository(conns.Postgres)
	receiptRepo := infraPostgres.NewReceiptRepository(conns.Postgres)
	auditRepo := infraMongo.NewAuditRepository(conns.MongoDB)

	// Rule registry — add rules here without touching any other file
	registry := engine.NewRegistry()
	registry.MustRegister(proposals.NewRule001())
	registry.MustRegister(proposals.NewRule002())
	registry.MustRegister(proposals.NewRule003())
	registry.MustRegister(proposals.NewRule004())

	eng := engine.NewValidationEngine(registry, engine.Sequential)

	// Pipeline assembly
	p := pipeline.New(
		stages.NewIngestionStage(proposalRepo),
		stages.NewEnrichmentStage(proposalRepo, receiptRepo),
		stages.NewValidationStage(eng),
		stages.NewAggregationStage(auditRepo),
	)

	results, err := usecase.NewRunValidation(p).Execute(ctx)
	if err != nil {
		log.Fatal("pipeline failed:", err)
	}

	fmt.Println("=================================================================")
	fmt.Println("AUDIT EXECUTIVE SUMMARY")
	fmt.Println("=================================================================")
	for _, r := range results {
		status := "CLEAN"
		if r.Triggered {
			status = "TRIGGERED"
		}
		fmt.Printf("[%s] %-10s  scanned=%d  issues=%d\n",
			r.RuleName, status, r.RecordsScanned, r.IssuesFound)
		for _, d := range r.Details {
			fmt.Printf("   • %s\n", d)
		}
	}
	fmt.Println("=================================================================")
}
