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

func WithReceiptCreatedAt(t time.Time) func(*domain.Receipt) {
	return func(r *domain.Receipt) { r.CreatedAt = t }
}

func WithInstallmentNumber(n int) func(*domain.Receipt) {
	return func(r *domain.Receipt) { r.InstallmentNumber = n }
}

func WithProposalNumber(n string) func(*domain.Receipt) {
	return func(r *domain.Receipt) { r.ProposalNumber = n }
}

func WithDownloadedValue(v string) func(*domain.Receipt) {
	return func(r *domain.Receipt) { r.DownloadedValue = v }
}

func WithReceiptStatus(s string) func(*domain.Receipt) {
	return func(r *domain.Receipt) { r.ReceiptStatus = s }
}

func WithReceiptAmountToPay(v float64) func(*domain.Receipt) {
	return func(r *domain.Receipt) { r.AmountToPay = v }
}

func WithReceiptInstallmentPercentage(p float64) func(*domain.Receipt) {
	return func(r *domain.Receipt) { r.InstallmentPercentage = p }
}

// NewCanonicalProposal returns a CLEAN canonical proposal with sensible defaults.
func NewCanonicalProposal(opts ...func(*domain.CanonicalProposal)) domain.CanonicalProposal {
	p := domain.CanonicalProposal{
		RunID:      "run-1",
		ProposalID: "proposal-1",
		Number:     "123456",
		Value:      1000.00,
		ClientID:   "client-1",
		PlanID:     "plan-1",
		Status:     domain.ProposalStatusClean,
		Violations: []domain.Violation{},
	}
	for _, opt := range opts {
		opt(&p)
	}
	return p
}

func WithCanonicalProposalID(id string) func(*domain.CanonicalProposal) {
	return func(p *domain.CanonicalProposal) { p.ProposalID = id }
}

// CanonicalProposalList generates n CLEAN canonical proposals with distinct IDs.
func CanonicalProposalList(n int) []domain.CanonicalProposal {
	ps := make([]domain.CanonicalProposal, n)
	for i := range ps {
		ps[i] = NewCanonicalProposal(
			WithCanonicalProposalID(fmt.Sprintf("proposal-%d", i+1)),
		)
	}
	return ps
}

// ReceiptList generates n receipts with valid monetary format and distinct IDs.
func ReceiptList(n int) []domain.Receipt {
	rs := make([]domain.Receipt, n)
	for i := range rs {
		rs[i] = NewReceipt(
			WithReceiptID(fmt.Sprintf("receipt-%d", i+1)),
			WithProposalID(fmt.Sprintf("proposal-%d", i+1)),
			WithDownloadedValue("1000.00"),
			WithReceiptStatus("LIQUIDADO"),
		)
	}
	return rs
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

// NewAdvanceReport returns a valid advance report with sensible defaults.
func NewAdvanceReport(opts ...func(*domain.AdvanceReport)) domain.AdvanceReport {
	ar := domain.AdvanceReport{
		ID:          "advance-1",
		TenantID:    1,
		IsPaid:      true,
		IsCancelled: false,
		AmountToPay: 1000.00,
		AdvanceFee:  10.00,
		BrokerID:    "broker-1",
	}
	for _, opt := range opts {
		opt(&ar)
	}
	return ar
}

func WithAdvanceID(id string) func(*domain.AdvanceReport) {
	return func(ar *domain.AdvanceReport) { ar.ID = id }
}

func WithAdvanceCreatedAt(t time.Time) func(*domain.AdvanceReport) {
	return func(ar *domain.AdvanceReport) { ar.CreatedAt = t }
}

func WithIsPaid(v bool) func(*domain.AdvanceReport) {
	return func(ar *domain.AdvanceReport) { ar.IsPaid = v }
}

func WithIsCancelled(v bool) func(*domain.AdvanceReport) {
	return func(ar *domain.AdvanceReport) { ar.IsCancelled = v }
}

func WithAmountToPay(v float64) func(*domain.AdvanceReport) {
	return func(ar *domain.AdvanceReport) { ar.AmountToPay = v }
}

func WithAdvanceFee(v float64) func(*domain.AdvanceReport) {
	return func(ar *domain.AdvanceReport) { ar.AdvanceFee = v }
}

func WithAdvanceBrokerID(v string) func(*domain.AdvanceReport) {
	return func(ar *domain.AdvanceReport) { ar.BrokerID = v }
}

// AdvanceReportList generates n advance reports with distinct IDs.
func AdvanceReportList(n int) []domain.AdvanceReport {
	reports := make([]domain.AdvanceReport, n)
	for i := range reports {
		reports[i] = NewAdvanceReport(WithAdvanceID(fmt.Sprintf("advance-%d", i+1)))
	}
	return reports
}

// NewAdvanceReportReceipt returns an active link with sensible defaults.
func NewAdvanceReportReceipt(opts ...func(*domain.AdvanceReportReceipt)) domain.AdvanceReportReceipt {
	l := domain.AdvanceReportReceipt{
		AdvanceReportID: "advance-1",
		ReceiptID:       "receipt-1",
		IsActive:        true,
	}
	for _, opt := range opts {
		opt(&l)
	}
	return l
}

func WithLinkAdvanceID(id string) func(*domain.AdvanceReportReceipt) {
	return func(l *domain.AdvanceReportReceipt) { l.AdvanceReportID = id }
}

func WithLinkReceiptID(id string) func(*domain.AdvanceReportReceipt) {
	return func(l *domain.AdvanceReportReceipt) { l.ReceiptID = id }
}

func WithLinkIsActive(v bool) func(*domain.AdvanceReportReceipt) {
	return func(l *domain.AdvanceReportReceipt) { l.IsActive = v }
}

// NewAdvanceReceipt returns a receipt projection with sensible defaults.
func NewAdvanceReceipt(opts ...func(*domain.AdvanceReceipt)) domain.AdvanceReceipt {
	r := domain.AdvanceReceipt{
		ID:          "receipt-1",
		ProposalID:  "proposal-1",
		AmountToPay: 1000.00,
		BrokerID:    "broker-1",
	}
	for _, opt := range opts {
		opt(&r)
	}
	return r
}

func WithAdvReceiptID(id string) func(*domain.AdvanceReceipt) {
	return func(r *domain.AdvanceReceipt) { r.ID = id }
}

func WithAdvReceiptProposalID(pid string) func(*domain.AdvanceReceipt) {
	return func(r *domain.AdvanceReceipt) { r.ProposalID = pid }
}

func WithAdvReceiptAmount(v float64) func(*domain.AdvanceReceipt) {
	return func(r *domain.AdvanceReceipt) { r.AmountToPay = v }
}

func WithAdvReceiptAmountToPay(v float64) func(*domain.AdvanceReceipt) {
	return func(r *domain.AdvanceReceipt) { r.AmountToPay = v }
}

func WithAdvReceiptBrokerID(v string) func(*domain.AdvanceReceipt) {
	return func(r *domain.AdvanceReceipt) { r.BrokerID = v }
}

// AdvanceReceiptList generates n advance receipts with distinct IDs.
func AdvanceReceiptList(n int) []domain.AdvanceReceipt {
	rs := make([]domain.AdvanceReceipt, n)
	for i := range rs {
		rs[i] = NewAdvanceReceipt(
			WithAdvReceiptID(fmt.Sprintf("receipt-%d", i+1)),
			WithAdvReceiptProposalID(fmt.Sprintf("proposal-%d", i+1)),
		)
	}
	return rs
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
