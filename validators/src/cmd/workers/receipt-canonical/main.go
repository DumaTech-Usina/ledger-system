package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/schollz/progressbar/v3"

	"validators/src/internal/application/jobs"
	"validators/src/internal/engine"
	infraConfig "validators/src/internal/infrastructure/config"
	infraMongo "validators/src/internal/infrastructure/mongodb"
	infraPostgres "validators/src/internal/infrastructure/postgres"
	receiptRules "validators/src/internal/rules/receipts"
)

const (
	batchSize      = 100
	checkpointFile = ".receipt_canonical.checkpoint"
)

type checkpoint struct {
	LastProposalID string `json:"last_proposal_id"`
	Processed      int    `json:"processed"`
}

func readCheckpoint() checkpoint {
	data, err := os.ReadFile(checkpointFile)
	if err != nil {
		return checkpoint{}
	}
	var cp checkpoint
	if err := json.Unmarshal(data, &cp); err != nil {
		return checkpoint{}
	}
	return cp
}

func writeCheckpoint(cp checkpoint) error {
	data, err := json.Marshal(cp)
	if err != nil {
		return err
	}
	return os.WriteFile(checkpointFile, data, 0644)
}

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

	proposalReader := infraMongo.NewCanonicalProposalReader(conns.MongoDB)
	receiptRepo := infraPostgres.NewReceiptRepository(conns.Postgres)
	canonicalRepo := infraMongo.NewAspiantReceiptCanonicalRepository(conns.MongoDB)

	ruleRegistry := engine.NewRegistry()
	ruleRegistry.MustRegister(receiptRules.NewRule001())
	eng := engine.NewValidationEngine(ruleRegistry, engine.Parallel)

	job := jobs.NewReceiptCanonicalJob(proposalReader, receiptRepo, canonicalRepo, eng, batchSize)

	total, err := proposalReader.CountClean(ctx)
	if err != nil {
		log.Fatal("failed to count CLEAN proposals:", err)
	}
	if total == 0 {
		fmt.Println("no CLEAN proposals found — nothing to process")
		return
	}

	cp := readCheckpoint()
	if cp.Processed > 0 {
		fmt.Printf("resuming from checkpoint: last_proposal_id=%q processed=%d/%d\n",
			cp.LastProposalID, cp.Processed, total)
	}

	bar := progressbar.NewOptions(total,
		progressbar.OptionSetDescription("canonicalizing receipts"),
		progressbar.OptionShowCount(),
		progressbar.OptionSetWidth(50),
		progressbar.OptionSetTheme(progressbar.Theme{
			Saucer:        "=",
			SaucerHead:    ">",
			SaucerPadding: " ",
			BarStart:      "[",
			BarEnd:        "]",
		}),
	)
	if cp.Processed > 0 {
		_ = bar.Add(cp.Processed)
	}

	onBatch := func(result jobs.BatchResult) {
		cp.LastProposalID = result.Anchor
		cp.Processed += result.Count
		if err := writeCheckpoint(cp); err != nil {
			log.Printf("warning: checkpoint write failed: %v", err)
		}
		_ = bar.Add(result.Count)
	}

	if _, err := job.Run(ctx, cp.LastProposalID, onBatch); err != nil {
		fmt.Println()
		log.Fatal(err)
	}

	fmt.Println()

	if err := os.Remove(checkpointFile); err != nil && !os.IsNotExist(err) {
		log.Printf("warning: could not remove checkpoint file: %v", err)
	}

	fmt.Printf("done — %d proposals processed\n", cp.Processed)
}
