package stages

import (
	"context"

	"validators/src/internal/application/ports"
	"validators/src/internal/pipeline"
)

// IngestionStage fetches all proposals from the repository and stores them
// in the ValidationContext. No business logic lives here.
type IngestionStage struct {
	proposalRepo ports.ProposalRepository
}

func NewIngestionStage(proposalRepo ports.ProposalRepository) *IngestionStage {
	return &IngestionStage{proposalRepo: proposalRepo}
}

func (s *IngestionStage) Name() string { return "IngestionStage" }

func (s *IngestionStage) Process(ctx context.Context, pctx *pipeline.PipelineContext) error {
	proposals, err := s.proposalRepo.FetchAll(ctx)
	if err != nil {
		return err
	}
	pctx.ValidationCtx.Proposals = proposals
	return nil
}
