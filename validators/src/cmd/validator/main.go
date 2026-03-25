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
	"validators/src/internal/pipelines/proposals"
	proposalRules "validators/src/internal/rules/proposals"
)

func main() {
	ctx := context.Background()

	conns, err := infraConfig.Connect(
		"postgres://developer:postgres@localhost:5432/usina?sslmode=disable",
		"mongodb://root:rootpassword@localhost:27017",
		"rules_engine_v3",
	)
	if err != nil {
		log.Fatal("failed to connect:", err)
	}

	// Infrastructure adapters
	proposalRepo := infraPostgres.NewProposalRepository(conns.Postgres)
	receiptRepo := infraPostgres.NewReceiptRepository(conns.Postgres)
	auditRepo := infraMongo.NewAuditRepository(conns.MongoDB)

	// Rule registry
	ruleRegistry := engine.NewRegistry()
	ruleRegistry.MustRegister(proposalRules.NewRule001())
	ruleRegistry.MustRegister(proposalRules.NewRule002())
	ruleRegistry.MustRegister(proposalRules.NewRule003())
	ruleRegistry.MustRegister(proposalRules.NewRule004())

	eng := engine.NewValidationEngine(ruleRegistry, engine.Sequential)

	// Build and register the proposal pipeline
	proposalRunner := proposals.Build(proposals.Deps{
		ProposalRepo: proposalRepo,
		ReceiptRepo:  receiptRepo,
		AuditRepo:    auditRepo,
		Engine:       eng,
	})

	pipelineRegistry := pipeline.NewRegistry()
	pipelineRegistry.MustRegister("proposals", proposalRunner)

	// Execute
	if err := usecase.NewRunValidation(proposalRunner).Execute(ctx); err != nil {
		log.Fatal("pipeline failed:", err)
	}

	fmt.Println("=================================================================")
	fmt.Println("AUDIT EXECUTIVE SUMMARY")
	fmt.Println("=================================================================")
	for _, r := range proposalRunner.Results() {
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
