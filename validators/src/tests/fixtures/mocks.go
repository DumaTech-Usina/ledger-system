package fixtures

import (
	"context"
	"encoding/json"
	"fmt"

	"validators/src/internal/domain"
)

// PublishedMessage records a single Publish call on MockMessagePublisher.
type PublishedMessage struct {
	RoutingKey string
	Body       []byte
}

// MockMessagePublisher satisfies ports.MessagePublisher.
// It captures every published message so tests can assert routing key and payload.
type MockMessagePublisher struct {
	Published []PublishedMessage
	Err       error
}

func (m *MockMessagePublisher) Publish(_ context.Context, routingKey string, payload any) error {
	if m.Err != nil {
		return m.Err
	}
	body, _ := json.Marshal(payload)
	m.Published = append(m.Published, PublishedMessage{RoutingKey: routingKey, Body: body})
	return nil
}

// MockProposalRepository satisfies ports.ProposalRepository.
type MockProposalRepository struct {
	Proposals      []domain.Proposal
	TotalCount     int
	InvalidCount   int
	BlockingKeys   []string
	ProposalsByKey map[string][]domain.Proposal

	// Err is the fallback error for all methods except FetchByBlockingKey.
	Err error
	// ErrFetchByKey overrides Err for FetchByBlockingKey only, allowing tests to
	// set Err on aggregate-stat methods while keeping the fetch path clean.
	ErrFetchByKey error
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

func (m *MockProposalRepository) FetchDistinctBlockingKeys(_ context.Context) ([]string, error) {
	return m.BlockingKeys, m.Err
}

func (m *MockProposalRepository) FetchByBlockingKey(_ context.Context, key string) ([]domain.Proposal, error) {
	if m.ErrFetchByKey != nil {
		return nil, m.ErrFetchByKey
	}
	if m.ProposalsByKey != nil {
		return m.ProposalsByKey[key], nil
	}
	return m.Proposals, nil
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

func (m *MockReceiptRepository) FetchAllByProposalIDs(_ context.Context, _ []string) ([]domain.Receipt, error) {
	return m.Receipts, m.Err
}

// MockCanonicalProposalReader satisfies ports.CanonicalProposalReader.
type MockCanonicalProposalReader struct {
	Proposals []domain.CanonicalProposal
	Err       error
}

func (m *MockCanonicalProposalReader) FetchClean(_ context.Context) ([]domain.CanonicalProposal, error) {
	return m.Proposals, m.Err
}

func (m *MockCanonicalProposalReader) CountClean(_ context.Context) (int, error) {
	return len(m.Proposals), m.Err
}

func (m *MockCanonicalProposalReader) FetchCleanBatch(_ context.Context, afterID string, limit int) ([]domain.CanonicalProposal, error) {
	if m.Err != nil {
		return nil, m.Err
	}
	start := 0
	if afterID != "" {
		for i, p := range m.Proposals {
			if p.ProposalID == afterID {
				start = i + 1
				break
			}
		}
	}
	if start >= len(m.Proposals) {
		return nil, nil
	}
	end := start + limit
	if end > len(m.Proposals) {
		end = len(m.Proposals)
	}
	return m.Proposals[start:end], nil
}

// MockAspiantReceiptCanonicalRepository satisfies ports.AspiantReceiptCanonicalRepository.
type MockAspiantReceiptCanonicalRepository struct {
	Saved []domain.AspiantReceiptCanonical
	Err   error
}

func (m *MockAspiantReceiptCanonicalRepository) SaveAll(_ context.Context, records []domain.AspiantReceiptCanonical) error {
	m.Saved = append(m.Saved, records...)
	return m.Err
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
