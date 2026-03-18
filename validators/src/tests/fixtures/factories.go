package fixtures

import (
	"fmt"
	"time"

	"validators/src/internal/domain"
)

// NewProposal returns a valid proposal with sensible defaults.
// Use functional options to override specific fields.
func NewProposal(opts ...func(*domain.Proposal)) domain.Proposal {
	p := domain.Proposal{
		ID:            "proposal-1",
		Number:        "123456",
		Value:         1000.00,
		ClientID:      "client-1",
		PlanID:        "plan-1",
		EffectiveDate: "2026-01-01",
	}
	for _, opt := range opts {
		opt(&p)
	}
	return p
}

func WithID(id string) func(*domain.Proposal) {
	return func(p *domain.Proposal) { p.ID = id }
}

func WithNumber(number string) func(*domain.Proposal) {
	return func(p *domain.Proposal) { p.Number = number }
}

func WithValue(value float64) func(*domain.Proposal) {
	return func(p *domain.Proposal) { p.Value = value }
}

func WithClientID(clientID string) func(*domain.Proposal) {
	return func(p *domain.Proposal) { p.ClientID = clientID }
}

// NewReceipt returns a paid receipt with sensible defaults.
func NewReceipt(opts ...func(*domain.Receipt)) domain.Receipt {
	r := domain.Receipt{
		ID:                "receipt-1",
		ProposalID:        "proposal-1",
		ProposalNumber:    "123456",
		InstallmentNumber: 1,
		PaymentStatus:     "PAGO",
		CreatedAt:         time.Now(),
	}
	for _, opt := range opts {
		opt(&r)
	}
	return r
}

func WithReceiptID(id string) func(*domain.Receipt) {
	return func(r *domain.Receipt) { r.ID = id }
}

func WithProposalID(pid string) func(*domain.Receipt) {
	return func(r *domain.Receipt) { r.ProposalID = pid }
}

func WithInstallmentNumber(n int) func(*domain.Receipt) {
	return func(r *domain.Receipt) { r.InstallmentNumber = n }
}

func WithProposalNumber(n string) func(*domain.Receipt) {
	return func(r *domain.Receipt) { r.ProposalNumber = n }
}

// NewCluster returns a cluster containing two proposals by default.
func NewCluster(opts ...func(*domain.Cluster)) domain.Cluster {
	c := domain.Cluster{
		ID:          "cluster-1",
		BlockingKey: "12|56",
		Proposals:   []string{"proposal-1", "proposal-2"},
		Numbers:     []string{"123456", "0123456"},
		Reasons:     []string{"similar number", "same value"},
	}
	for _, opt := range opts {
		opt(&c)
	}
	return c
}

// ProposalList generates n proposals with distinct IDs and numbers.
func ProposalList(n int) []domain.Proposal {
	ps := make([]domain.Proposal, n)
	for i := range ps {
		ps[i] = NewProposal(
			WithID(fmt.Sprintf("proposal-%d", i+1)),
			WithNumber(fmt.Sprintf("%06d", i+1)),
		)
	}
	return ps
}
