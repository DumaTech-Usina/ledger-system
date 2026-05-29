package domain

import "time"

// AdvanceReport is an advance payment instrument fetched from advance_reports.
type AdvanceReport struct {
	ID          string
	TenantID    int64
	IsPaid      bool
	IsCancelled bool
	AmountToPay float64 // advance_reports.amount_to_pay (ADV-001, ADV-006)
	AdvanceFee  float64 // advance_reports.advance_fee   (ADV-008)
	BrokerID    string  // advance_reports.broker_id      (ADV-009)
}

// AdvanceReportReceipt represents an active link in advance_report_receipts.
type AdvanceReportReceipt struct {
	AdvanceReportID string
	ReceiptID       string
	IsActive        bool
}

// AdvanceReceipt holds receipt fields required by the advance validation rules.
// It is a read-only projection — not the full receipts row.
type AdvanceReceipt struct {
	ID          string
	ProposalID  string
	Amount      float64 // receipts.amount       (ADV-006: sum check)
	AmountToPay float64 // receipts.amount_to_pay (ADV-003: residual check)
	BrokerID    string  // receipts.broker_id     (ADV-009: broker mismatch)
}

// AdvanceReportStatus is the verdict assigned to an advance report.
type AdvanceReportStatus string

const (
	AdvanceReportStatusClean      AdvanceReportStatus = "CLEAN"
	AdvanceReportStatusSuspicious AdvanceReportStatus = "SUSPICIOUS"
)

// AdvanceViolation records a single rule's finding against an advance report.
type AdvanceViolation struct {
	Rule   string
	Reason string
}

// CanonicalAdvanceReport is the authoritative read-model for an advance report's
// validation status. Written to the aspirant_advance_canonical MongoDB collection
// at the end of every validation run.
type CanonicalAdvanceReport struct {
	AdvanceReportID string
	TenantID        int64
	Status          AdvanceReportStatus
	Violations      []AdvanceViolation
	CreatedAt       time.Time
}
