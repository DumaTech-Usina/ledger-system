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
	// Metadata holds derived validation properties.
	// Required key: "receiptValidationStatus" — "CLEAN" or "SUSPICIOUS".
	Metadata map[string]string
}
