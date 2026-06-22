package domain

import "time"

type Receipt struct {
	ID                    string
	ProposalID            string
	ProposalNumber        string
	InstallmentNumber     int
	PaymentStatus         string
	DownloadedValue       string
	DischargeDate         *time.Time // nullable — not all receipts have a discharge date
	ReceiptStatus         string
	InstallmentPercentage float64
	AmountToPay           float64
	CreatedAt             time.Time
}
