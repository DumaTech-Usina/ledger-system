package jobs

import (
	"context"
	"fmt"
	"log"
	"maps"
	"time"

	"golang.org/x/sync/errgroup"

	"validators/src/internal/application/ports"
	"validators/src/internal/domain"
	"validators/src/internal/engine"
	"validators/src/internal/rules"
	receiptRules "validators/src/internal/rules/receipts"
)

// BatchResult reports progress after each confirmed write.
// Callers use it to advance a checkpoint or update a progress bar.
type BatchResult struct {
	Anchor string // ProposalID of the last proposal in the batch
	Count  int    // number of proposals in the batch
}

// ReceiptCanonicalJob streams CLEAN canonical proposals in batches,
// fetches their receipts, validates them, and writes canonical records.
//
// The three stages run as concurrent goroutines connected by channels so
// I/O latency on one stage overlaps with processing on the next — at most
// two batches are in flight at any time, never a full table scan.
type ReceiptCanonicalJob struct {
	proposalReader ports.CanonicalProposalReader
	receiptRepo    ports.ReceiptRepository
	canonicalRepo  ports.AspiantReceiptCanonicalRepository
	engine         *engine.ValidationEngine
	batchSize      int
}

func NewReceiptCanonicalJob(
	proposalReader ports.CanonicalProposalReader,
	receiptRepo ports.ReceiptRepository,
	canonicalRepo ports.AspiantReceiptCanonicalRepository,
	eng *engine.ValidationEngine,
	batchSize int,
) *ReceiptCanonicalJob {
	return &ReceiptCanonicalJob{
		proposalReader: proposalReader,
		receiptRepo:    receiptRepo,
		canonicalRepo:  canonicalRepo,
		engine:         eng,
		batchSize:      batchSize,
	}
}

// Run processes all CLEAN proposals starting from startAnchor (pass "" for a full scan).
// onBatch is called only after each batch is confirmed written, so callers can safely
// advance a checkpoint or progress bar inside the callback. Pass nil to skip.
// Returns the total number of proposals processed.
func (j *ReceiptCanonicalJob) Run(ctx context.Context, startAnchor string, onBatch func(BatchResult)) (int, error) {
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

	proposalCh := make(chan proposalBatch, 1)
	receiptCh := make(chan enrichedBatch, 1)

	g, gctx := errgroup.WithContext(ctx)

	// Stage 1: page through CLEAN canonical proposals from MongoDB.
	g.Go(func() error {
		defer close(proposalCh)
		anchor := startAnchor
		for {
			batch, err := j.proposalReader.FetchCleanBatch(gctx, anchor, j.batchSize)
			if err != nil {
				return fmt.Errorf("proposal fetch failed (anchor=%q): %w", anchor, err)
			}
			if len(batch) == 0 {
				return nil
			}
			anchor = batch[len(batch)-1].ProposalID
			select {
			case proposalCh <- proposalBatch{anchor: anchor, count: len(batch), proposals: batch}:
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
			receipts, err := j.receiptRepo.FetchAllByProposalIDs(gctx, ids)
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
	// onBatch fires only after a confirmed write — checkpoint is safe to advance there.
	var processed int
	g.Go(func() error {
		for batch := range receiptCh {
			vctx := rules.NewValidationContext()
			vctx.CanonicalReceipts = batch.receipts
			results := j.engine.Run(gctx, vctx)
			canonicals := buildReceiptCanonicals(batch.receipts, results)
			if err := j.canonicalRepo.SaveAll(gctx, canonicals); err != nil {
				return fmt.Errorf("write failed (anchor=%q): %w — checkpoint NOT advanced, retry is safe", batch.anchor, err)
			}
			processed += batch.proposalCount
			if onBatch != nil {
				onBatch(BatchResult{Anchor: batch.anchor, Count: batch.proposalCount})
			}
		}
		return nil
	})

	if err := g.Wait(); err != nil {
		return processed, err
	}
	return processed, nil
}

// StartPolling runs the job repeatedly at the given interval until ctx is cancelled.
// Each iteration performs a full scan from the beginning (anchor = "").
// Errors on individual runs are logged but do not stop the loop.
func (j *ReceiptCanonicalJob) StartPolling(ctx context.Context, interval time.Duration, onBatch func(BatchResult)) error {
	for {
		if _, err := j.Run(ctx, "", onBatch); err != nil {
			log.Printf("[ReceiptCanonicalJob] run error: %v", err)
		}
		select {
		case <-time.After(interval):
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

func buildReceiptCanonicals(receipts []domain.Receipt, results []rules.RuleResult) []domain.AspiantReceiptCanonical {
	flagged := make(map[string]string)
	for _, r := range results {
		maps.Copy(flagged, r.FlaggedProposals)
	}

	canonicals := make([]domain.AspiantReceiptCanonical, 0, len(receipts))
	for _, rec := range receipts {
		status := "CLEAN"
		if _, suspicious := flagged[rec.ID]; suspicious {
			status = "SUSPICIOUS"
		}
		canonicals = append(canonicals, domain.AspiantReceiptCanonical{
			ReceiptID:         rec.ID,
			ProposalID:        rec.ProposalID,
			InstallmentNumber: rec.InstallmentNumber,
			DownloadedValue:   receiptRules.NormalizeDownloadedValue(rec.DownloadedValue),
			DischargeDate:     rec.DischargeDate,
			ReceiptStatus:     rec.ReceiptStatus,
			Metadata:          map[string]string{"receiptValidationStatus": status},
		})
	}
	return canonicals
}
