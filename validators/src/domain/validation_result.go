package domain

type ValidationResult struct {
    RuleID     string
    Score      float64
    Triggered  bool
    Reason     string
    Confidence float64
}