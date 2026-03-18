package pipeline

import "validators/src/domain"

func Aggregate(results []domain.ValidationResult) float64 {
    product := 1.0

    for _, r := range results {
        if r.Triggered {
            product *= (1 - r.Score)
        }
    }

    return 1 - product
}