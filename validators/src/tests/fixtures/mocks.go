package fixtures

import (
	"context"
	"fmt"

	"validators/src/internal/domain"
)

// MockProposalRepository satisfies ports.ProposalRepository.
type MockProposalRepository struct {
	Proposals    []domain.Proposal
	TotalCount   int
	InvalidCount int
	Err          error
}

func (m *MockProposalRepository) FetchAll(_ context.Context) ([]domain.Proposal, error) {
	return m.Proposals, m.Err
}

func (m *MockProposalRepository) CountTotal(_ context.Context) (int, error) {
	return m.TotalCount, m.Err
}

func (m *MockProposalRepository) CountInvalidNumbers(_ context.Context) (int, error) {
	return m.InvalidCount, m.Err
}

func (m *MockProposalRepository) FetchInvalidNumberProposalIDs(_ context.Context) ([]string, error) {
	ids := make([]string, m.InvalidCount)
	for i := range ids {
		ids[i] = fmt.Sprintf("invalid-number-%d", i+1)
	}
	return ids, m.Err
}

// MockReceiptRepository satisfies ports.ReceiptRepository.
type MockReceiptRepository struct {
	Receipts             []domain.Receipt
	DistinctPaidCount    int
	FalseDelinquentCount int
	Err                  error
}

func (m *MockReceiptRepository) FetchPaidByProposalIDs(_ context.Context, _ []string) ([]domain.Receipt, error) {
	return m.Receipts, m.Err
}

func (m *MockReceiptRepository) CountDistinctPaidProposals(_ context.Context) (int, error) {
	return m.DistinctPaidCount, m.Err
}

func (m *MockReceiptRepository) CountFalseDelinquents(_ context.Context) (int, error) {
	return m.FalseDelinquentCount, m.Err
}

func (m *MockReceiptRepository) FetchFalseDelinquentProposalIDs(_ context.Context) ([]string, error) {
	ids := make([]string, m.FalseDelinquentCount)
	for i := range ids {
		ids[i] = fmt.Sprintf("false-delinquent-%d", i+1)
	}
	return ids, m.Err
}

// MockAuditRepository satisfies ports.AuditRepository.
type MockAuditRepository struct {
	SavedClusters   []domain.Cluster
	SavedRuns       []domain.RuleRunResult
	SavedCanonical  []domain.CanonicalProposal
	Err             error
}

func (m *MockAuditRepository) SaveClusters(_ context.Context, clusters []domain.Cluster) error {
	m.SavedClusters = append(m.SavedClusters, clusters...)
	return m.Err
}

func (m *MockAuditRepository) SaveRuleRun(_ context.Context, result domain.RuleRunResult) error {
	m.SavedRuns = append(m.SavedRuns, result)
	return m.Err
}

func (m *MockAuditRepository) SaveCanonicalProposals(_ context.Context, proposals []domain.CanonicalProposal) error {
	m.SavedCanonical = append(m.SavedCanonical, proposals...)
	return m.Err
}
