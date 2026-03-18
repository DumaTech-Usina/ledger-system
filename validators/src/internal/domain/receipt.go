package domain

import "time"

type Receipt struct {
	ID                string
	ProposalID        string
	ProposalNumber    string
	InstallmentNumber int
	PaymentStatus     string
	CreatedAt         time.Time
}
