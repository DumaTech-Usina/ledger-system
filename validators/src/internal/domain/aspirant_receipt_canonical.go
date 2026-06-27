package domain

import "time"

// AspiantReceiptCanonical is the output record written to the
// `aspirant_receipt_canonical` MongoDB collection after the
// receipts pipeline runs.
type AspiantReceiptCanonical struct {
	ReceiptID         string
	ProposalID        string
	InstallmentNumber int
	DownloadedValue   string
	DischargeDate     *time.Time // nil when the source row has no discharge date
	ReceiptStatus     string
	// CreatedAt is the receipt's creation timestamp (true ABERTA-start). The ledger
	// dates the commission accrual (COMMISSION_EXPECTED) by this value.
	CreatedAt time.Time
	// Metadata holds derived validation properties.
	// Required key: "receiptValidationStatus" — "CLEAN" or "SUSPICIOUS".
	Metadata map[string]string
}
