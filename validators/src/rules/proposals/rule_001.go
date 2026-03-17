package rules

import (
	"context"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/mongo"
)

const (
	RuleID      = "RULE-001"
	RuleVersion = "2.0"
	batchSize   = 1000
)

type Proposal struct {
	ID            string
	Number        string
	Value         float64
	ClientID      string
	PlanID        string
	EffectiveDate string
}

type RuleRun struct {
	RunID          string    `bson:"run_id"`
	RuleID         string    `bson:"rule_id"`
	RuleVersion    string    `bson:"rule_version"`
	Description    string    `bson:"description"`
	StartedAt      time.Time `bson:"started_at"`
	FinishedAt     time.Time `bson:"finished_at"`
	RecordsScanned int       `bson:"records_scanned"`
	ClustersFound  int       `bson:"clusters_found"`
}

type Decision struct {
	RunID       string    `bson:"run_id"`
	ProposalID  string    `bson:"proposal_id"`
	BlockingKey string    `bson:"blocking_key"`
	Decision    string    `bson:"decision"`
	ClusterID   string    `bson:"cluster_id,omitempty"`
	Reasons     []string  `bson:"reasons"`
	CreatedAt   time.Time `bson:"created_at"`
}

type Cluster struct {
	RunID       string    `bson:"run_id"`
	ClusterID   string    `bson:"cluster_id"`
	BlockingKey string    `bson:"blocking_key"`
	Proposals   []string  `bson:"proposals"`
	Numbers     []string  `bson:"numbers"`
	Reasons     []string  `bson:"reasons"`
	CreatedAt   time.Time `bson:"created_at"`
}

func normalize(number string) string {
	n := strings.TrimSpace(number)
	n = strings.TrimLeft(n, "0")
	return n
}

func blockingKey(number string) string {
	if len(number) <= 4 {
		return number
	}
	return number[:2] + "|" + number[len(number)-2:]
}

func levenshtein(a, b string) int {
	if a == b {
		return 0
	}
	la := len(a)
	lb := len(b)
	if la == 0 {
		return lb
	}
	if lb == 0 {
		return la
	}
	prev := make([]int, lb+1)
	curr := make([]int, lb+1)
	for j := 0; j <= lb; j++ {
		prev[j] = j
	}
	for i := 1; i <= la; i++ {
		curr[0] = i
		for j := 1; j <= lb; j++ {
			cost := 0
			if a[i-1] != b[j-1] {
				cost = 1
			}
			del := prev[j] + 1
			ins := curr[j-1] + 1
			sub := prev[j-1] + cost
			curr[j] = min(del, ins, sub)
		}
		prev, curr = curr, prev
	}
	return prev[lb]
}

func min(a, b, c int) int {
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

func similar(a, b string) bool {
	lengthDelta := abs(len(a) - len(b))
	if lengthDelta > 1 {
		return false
	}
	substring := strings.Contains(a, b) || strings.Contains(b, a)
	if substring {
		return true
	}
	distance := levenshtein(a, b)
	if distance > 1 {
		return false
	}
	return true
}

func evaluateDuplicate(a, b Proposal) (bool, []string) {
	var matches int
	var reasons []string

	if similar(a.Number, b.Number) {
		matches++
		reasons = append(reasons, "Número similar")
	}
	if a.Value > 0 && a.Value == b.Value {
		matches++
		reasons = append(reasons, "Valores iguais")
	}
	if a.ClientID != "" && a.ClientID == b.ClientID {
		matches++
		reasons = append(reasons, "Cliente igual")
	}
	if a.PlanID != "" && a.PlanID == b.PlanID {
		matches++
		reasons = append(reasons, "Plano igual")
	}
	if a.EffectiveDate != "" && a.EffectiveDate == b.EffectiveDate {
		matches++
		reasons = append(reasons, "Data de vigência igual")
	}

	return matches >= 3, reasons
}

func processGroup(
	ctx context.Context, group []Proposal, key string, runID string, now time.Time,
	clusterCol *mongo.Collection, decisionCol *mongo.Collection, clusterCount *int64, mutex *sync.Mutex,
) error {
	if len(group) < 2 {
		return nil
	}

	clusterID := uuid.New().String()
	proposalSet := map[string]string{}
	uniqueReasons := make(map[string]struct{})
	var decisions []interface{}

	for i := 0; i < len(group); i++ {
		for j := i + 1; j < len(group); j++ {
			a := group[i]
			b := group[j]

			isDup, reasons := evaluateDuplicate(a, b)

			if !isDup {
				continue
			}

			proposalSet[a.ID] = a.Number
			proposalSet[b.ID] = b.Number

			for _, r := range reasons {
				uniqueReasons[r] = struct{}{}
			}
		}
	}

	if len(proposalSet) == 0 {
		return nil
	}

	var finalReasons []string
	for r := range uniqueReasons {
		finalReasons = append(finalReasons, r)
	}

	cluster := Cluster{
		RunID:       runID,
		ClusterID:   clusterID,
		BlockingKey: key,
		Reasons:     finalReasons,
		CreatedAt:   now,
	}

	for id, number := range proposalSet {
		cluster.Proposals = append(cluster.Proposals, id)
		cluster.Numbers = append(cluster.Numbers, number)

		decisions = append(decisions, Decision{
			RunID:       runID,
			ProposalID:  id,
			BlockingKey: key,
			Decision:    "SUSPICIOUS",
			ClusterID:   clusterID,
			Reasons:     finalReasons,
			CreatedAt:   now,
		})
	}

	_, err := clusterCol.InsertOne(ctx, cluster)
	if err != nil {
		return err
	}

	if len(decisions) > 0 {
		_, err := decisionCol.InsertMany(ctx, decisions)
		if err != nil {
			return err
		}
	}

	mutex.Lock()
	*clusterCount++
	mutex.Unlock()

	return nil
}

func RunRule001Stream(
	ctx context.Context,
	rows interface {
		Next() bool
		Scan(dest ...any) error
	},
	mongoDB *mongo.Database,
) error {
	runID := uuid.New().String()
	start := time.Now()
	now := time.Now()

	buckets := make(map[string][]Proposal, 10000)
	var scanned int

	for rows.Next() {
		var p Proposal
		err := rows.Scan(&p.ID, &p.Number, &p.Value, &p.ClientID, &p.PlanID, &p.EffectiveDate)
		if err != nil {
			return err
		}

		scanned++
		norm := normalize(p.Number)
		if norm == "" {
			continue
		}

		key := blockingKey(norm)
		buckets[key] = append(buckets[key], Proposal{
			ID:            p.ID,
			Number:        norm,
			Value:         p.Value,
			ClientID:      p.ClientID,
			PlanID:        p.PlanID,
			EffectiveDate: p.EffectiveDate,
		})
	}

	clusterCol := mongoDB.Collection("rule001_clusters")
	decisionCol := mongoDB.Collection("rule001_decisions")

	workers := runtime.NumCPU()
	ch := make(chan struct {
		key   string
		group []Proposal
	})

	var wg sync.WaitGroup
	var clustersFound int64
	var mutex sync.Mutex

	for w := 0; w < workers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for item := range ch {
				_ = processGroup(ctx, item.group, item.key, runID, now, clusterCol, decisionCol, &clustersFound, &mutex)
			}
		}()
	}

	for key, group := range buckets {
		ch <- struct {
			key   string
			group []Proposal
		}{key, group}
	}
	close(ch)
	wg.Wait()

	run := RuleRun{
		RunID:          runID,
		RuleID:         RuleID,
		RuleVersion:    RuleVersion,
		Description:    "Deteção rigorosa de duplicatas baseada no PDF: Número, Valor, Cliente, Plano, Data de Vigência",
		StartedAt:      start,
		FinishedAt:     time.Now(),
		RecordsScanned: scanned,
		ClustersFound:  int(clustersFound),
	}

	_, err := mongoDB.Collection("rule_runs").InsertOne(ctx, run)
	return err
}
