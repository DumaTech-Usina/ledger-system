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
	"golang.org/x/sync/errgroup"

	"validators/src/internal/domain"
	"validators/src/internal/engine"
	infraConfig "validators/src/internal/infrastructure/config"
	infraMongo "validators/src/internal/infrastructure/mongodb"
	infraPostgres "validators/src/internal/infrastructure/postgres"
	"validators/src/internal/rules"
	receiptRules "validators/src/internal/rules/receipts"
)

const (
	batchSize      = 100
	checkpointFile = ".receipt_canonical.checkpoint"
)

var (
	metaClean      = map[string]string{"receiptValidationStatus": "CLEAN"}
	metaSuspicious = map[string]string{"receiptValidationStatus": "SUSPICIOUS"}
)

type checkpoint struct {
	LastProposalID string `json:"last_proposal_id"`
	Processed      int    `json:"processed"`
}

type proposalBatch struct {
	anchor    string
	count     int
	proposals []domain.CanonicalProposal
}

type enrichedBatch struct {
	anchor        string
	proposalCount int
	receipts      []domain.Receipt
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

func buildCanonicals(receipts []domain.Receipt, results []rules.RuleResult) []domain.AspiantReceiptCanonical {
	flagged := make(map[string]string)
	for _, r := range results {
		for receiptID, reason := range r.FlaggedProposals {
			flagged[receiptID] = reason
		}
	}

	canonicals := make([]domain.AspiantReceiptCanonical, 0, len(receipts))
	for _, rec := range receipts {
		meta := metaClean
		if _, suspicious := flagged[rec.ID]; suspicious {
			meta = metaSuspicious
		}
		canonicals = append(canonicals, domain.AspiantReceiptCanonical{
			ReceiptID:         rec.ID,
			ProposalID:        rec.ProposalID,
			InstallmentNumber: rec.InstallmentNumber,
			DownloadedValue:   receiptRules.NormalizeDownloadedValue(rec.DownloadedValue),
			DischargeDate:     rec.DischargeDate,
			ReceiptStatus:     rec.ReceiptStatus,
			Metadata:          meta,
		})
	}
	return canonicals
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

	proposalCh := make(chan proposalBatch, 1)
	receiptCh := make(chan enrichedBatch, 1)

	g, gctx := errgroup.WithContext(ctx)

	// Stage 1: read proposal batches from MongoDB.
	g.Go(func() error {
		defer close(proposalCh)
		anchor := cp.LastProposalID
		for {
			proposals, err := proposalReader.FetchCleanBatch(gctx, anchor, batchSize)
			if err != nil {
				return fmt.Errorf("batch fetch failed (anchor=%q): %w", anchor, err)
			}
			if len(proposals) == 0 {
				return nil
			}
			anchor = proposals[len(proposals)-1].ProposalID
			select {
			case proposalCh <- proposalBatch{anchor: anchor, count: len(proposals), proposals: proposals}:
			case <-gctx.Done():
				return gctx.Err()
			}
		}
	})

	// Stage 2: fetch receipts from Postgres for each proposal batch.
	g.Go(func() error {
		defer close(receiptCh)
		for batch := range proposalCh {
			ids := make([]string, len(batch.proposals))
			for i, p := range batch.proposals {
				ids[i] = p.ProposalID
			}
			receipts, err := receiptRepo.FetchAllByProposalIDs(gctx, ids)
			if err != nil {
				return fmt.Errorf("receipt fetch failed (anchor=%q): %w", batch.anchor, err)
			}
			select {
			case receiptCh <- enrichedBatch{anchor: batch.anchor, proposalCount: batch.count, receipts: receipts}:
			case <-gctx.Done():
				return gctx.Err()
			}
		}
		return nil
	})

	// Stage 3: validate, build canonicals, and write to MongoDB.
	// Checkpoint is advanced only after a confirmed write.
	g.Go(func() error {
		for batch := range receiptCh {
			vctx := rules.NewValidationContext()
			vctx.CanonicalReceipts = batch.receipts
			results := eng.Run(gctx, vctx)
			canonicals := buildCanonicals(batch.receipts, results)
			if err := canonicalRepo.SaveAll(gctx, canonicals); err != nil {
				return fmt.Errorf("write failed (anchor=%q): %w — checkpoint NOT advanced, retry is safe", batch.anchor, err)
			}
			cp.LastProposalID = batch.anchor
			cp.Processed += batch.proposalCount
			if err := writeCheckpoint(cp); err != nil {
				log.Printf("warning: checkpoint write failed: %v", err)
			}
			_ = bar.Add(batch.proposalCount)
		}
		return nil
	})

	if err := g.Wait(); err != nil {
		fmt.Println()
		log.Fatal(err)
	}

	fmt.Println()

	if err := os.Remove(checkpointFile); err != nil && !os.IsNotExist(err) {
		log.Printf("warning: could not remove checkpoint file: %v", err)
	}

	fmt.Printf("done — %d proposals processed\n", cp.Processed)
}
