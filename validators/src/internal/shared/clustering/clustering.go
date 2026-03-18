package clustering

import (
	"strings"

	"github.com/google/uuid"

	"validators/src/internal/domain"
)

// ComputeClusters groups proposals into clusters of potential duplicates
// using blocking keys (prefix+suffix) followed by pairwise similarity scoring.
// This is a pure, stateless function — safe to call concurrently.
func ComputeClusters(proposals []domain.Proposal) []domain.Cluster {
	buckets := make(map[string][]domain.Proposal, len(proposals))
	for _, p := range proposals {
		norm := normalize(p.Number)
		if norm == "" {
			continue
		}
		key := blockingKey(norm)
		buckets[key] = append(buckets[key], domain.Proposal{
			ID:            p.ID,
			Number:        norm,
			Value:         p.Value,
			ClientID:      p.ClientID,
			PlanID:        p.PlanID,
			EffectiveDate: p.EffectiveDate,
		})
	}

	var clusters []domain.Cluster
	for key, group := range buckets {
		if c, ok := buildCluster(group, key); ok {
			clusters = append(clusters, c)
		}
	}
	return clusters
}

func buildCluster(group []domain.Proposal, key string) (domain.Cluster, bool) {
	if len(group) < 2 {
		return domain.Cluster{}, false
	}

	proposalSet := make(map[string]string) // id → normalised number
	reasonSet := make(map[string]struct{})

	for i := 0; i < len(group); i++ {
		for j := i + 1; j < len(group); j++ {
			if isDup, reasons := evaluateDuplicate(group[i], group[j]); isDup {
				proposalSet[group[i].ID] = group[i].Number
				proposalSet[group[j].ID] = group[j].Number
				for _, r := range reasons {
					reasonSet[r] = struct{}{}
				}
			}
		}
	}

	if len(proposalSet) == 0 {
		return domain.Cluster{}, false
	}

	var ids, numbers, reasons []string
	for id, number := range proposalSet {
		ids = append(ids, id)
		numbers = append(numbers, number)
	}
	for r := range reasonSet {
		reasons = append(reasons, r)
	}

	return domain.Cluster{
		ID:          uuid.New().String(),
		BlockingKey: key,
		Proposals:   ids,
		Numbers:     numbers,
		Reasons:     reasons,
	}, true
}

func evaluateDuplicate(a, b domain.Proposal) (bool, []string) {
	var score int
	var reasons []string

	if similar(a.Number, b.Number) {
		score++
		reasons = append(reasons, "similar number")
	}
	if a.Value > 0 && a.Value == b.Value {
		score++
		reasons = append(reasons, "same value")
	}
	if a.ClientID != "" && a.ClientID == b.ClientID {
		score++
		reasons = append(reasons, "same client")
	}
	if a.PlanID != "" && a.PlanID == b.PlanID {
		score++
		reasons = append(reasons, "same plan")
	}
	if a.EffectiveDate != "" && a.EffectiveDate == b.EffectiveDate {
		score++
		reasons = append(reasons, "same effective date")
	}

	return score >= 3, reasons
}

func normalize(number string) string {
	n := strings.TrimSpace(number)
	return strings.TrimLeft(n, "0")
}

func blockingKey(number string) string {
	if len(number) <= 4 {
		return number
	}
	return number[:2] + "|" + number[len(number)-2:]
}

func similar(a, b string) bool {
	if abs(len(a)-len(b)) > 1 {
		return false
	}
	if strings.Contains(a, b) || strings.Contains(b, a) {
		return true
	}
	return levenshtein(a, b) <= 1
}

func levenshtein(a, b string) int {
	if a == b {
		return 0
	}
	la, lb := len(a), len(b)
	if la == 0 {
		return lb
	}
	if lb == 0 {
		return la
	}
	prev := make([]int, lb+1)
	curr := make([]int, lb+1)
	for j := range prev {
		prev[j] = j
	}
	for i := 1; i <= la; i++ {
		curr[0] = i
		for j := 1; j <= lb; j++ {
			cost := 1
			if a[i-1] == b[j-1] {
				cost = 0
			}
			curr[j] = min3(prev[j]+1, curr[j-1]+1, prev[j-1]+cost)
		}
		prev, curr = curr, prev
	}
	return prev[lb]
}

func min3(a, b, c int) int {
	if a < b && a < c {
		return a
	}
	if b < c {
		return b
	}
	return c
}

func abs(x int) int {
	if x < 0 {
		return -x
	}
	return x
}
