package rules

import (
	"context"
	"runtime"
	"strings"
	"sync"
	"time"

	"validators/src/domain"

	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/mongo"
)

const (
	RuleID      = "RULE-001"
	RuleVersion = "1.0"
	batchSize   = 1000
)

/* type Proposal struct {
	ID     string
	Number string
} */

//Registro de execução da regra

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

// Marca uma proposta como suspeita
type Decision struct {
	RunID       string    `bson:"run_id"`
	ProposalID  string    `bson:"proposal_id"`
	BlockingKey string    `bson:"blocking_key"`
	Decision    string    `bson:"decision"`
	ClusterID   string    `bson:"cluster_id,omitempty"`
	Reason      string    `bson:"reason"`
	CreatedAt   time.Time `bson:"created_at"`
}

// Guarda por que o sistema achou que A é igual a B
type MatchEvidence struct {
	RunID       string    `bson:"run_id"`
	ProposalA   string    `bson:"proposal_a"`
	ProposalB   string    `bson:"proposal_b"`
	NumberA     string    `bson:"number_a"`
	NumberB     string    `bson:"number_b"`
	Distance    int       `bson:"levenshtein_distance"`
	Substring   bool      `bson:"substring_match"`
	LengthDelta int       `bson:"length_delta"`
	CreatedAt   time.Time `bson:"created_at"`
}

// Agrupa os IDs que pertencem ao mesmo grupo de duplicados.
type Cluster struct {
	RunID       string    `bson:"run_id"`
	ClusterID   string    `bson:"cluster_id"`
	BlockingKey string    `bson:"blocking_key"`
	Proposals   []string  `bson:"proposals"`
	CreatedAt   time.Time `bson:"created_at"`
}

// Remove espaços e zeros à esquerda (ex: "00123" vira "123").
func normalize(number string) string {
	n := strings.TrimSpace(number)
	n = strings.TrimLeft(n, "0")
	return n
}

// Ela cria uma "chave de bloqueio" pegando os 2 primeiros e os 2 últimos dígitos (ex: "123456" vira "12|56").
func blockingKey(number string) string {

	if len(number) <= 4 {
		return number
	}

	return number[:2] + "|" + number[len(number)-2:]
}

// como ela funciona?
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

// A regra de negócio. Ela decide se dois números são "iguais o suficiente"
func similar(a, b string) (bool, int, bool, int) {

	lengthDelta := abs(len(a) - len(b))

	if lengthDelta > 1 {
		return false, 0, false, lengthDelta
	}

	substring := strings.Contains(a, b) || strings.Contains(b, a)

	if substring {
		return true, 0, true, lengthDelta
	}

	distance := levenshtein(a, b)

	if distance > 1 {
		return false, distance, false, lengthDelta
	}

	return true, distance, false, lengthDelta
}

// Esta função processa cada "balde" (grupo) de propostas que possuem a mesma blockingKey.
func processGroup(
	ctx context.Context,
	group []domain.Proposal,
	key string,
	runID string,
	now time.Time,
	matchCol *mongo.Collection,
	clusterCol *mongo.Collection,
	decisionCol *mongo.Collection,
	clusterCount *int64,
	mutex *sync.Mutex,
) error {

	if len(group) < 2 {
		return nil
	}

	clusterID := uuid.New().String()

	proposalSet := map[string]struct{}{}

	var evidences []interface{}
	var decisions []interface{}

	for i := 0; i < len(group); i++ {

		for j := i + 1; j < len(group); j++ {

			a := group[i]
			b := group[j]

			ok, dist, sub, delta := similar(a.Number, b.Number)

			if !ok {
				continue
			}

			proposalSet[a.ID] = struct{}{}
			proposalSet[b.ID] = struct{}{}

			evidences = append(evidences, MatchEvidence{
				RunID:       runID,
				ProposalA:   a.ID,
				ProposalB:   b.ID,
				NumberA:     a.Number,
				NumberB:     b.Number,
				Distance:    dist,
				Substring:   sub,
				LengthDelta: delta,
				CreatedAt:   now,
			})

			if len(evidences) >= batchSize {
				_, err := matchCol.InsertMany(ctx, evidences)
				if err != nil {
					return err
				}
				evidences = evidences[:0]
			}
		}
	}

	if len(evidences) > 0 {
		_, err := matchCol.InsertMany(ctx, evidences)
		if err != nil {
			return err
		}
	}

	if len(proposalSet) == 0 {
		return nil
	}

	cluster := Cluster{
		RunID:       runID,
		ClusterID:   clusterID,
		BlockingKey: key,
		CreatedAt:   now,
	}

	for id := range proposalSet {
		cluster.Proposals = append(cluster.Proposals, id)

		decisions = append(decisions, Decision{
			RunID:       runID,
			ProposalID:  id,
			BlockingKey: key,
			Decision:    "SUSPICIOUS",
			ClusterID:   clusterID,
			Reason:      "fuzzy_number_similarity",
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

	buckets := make(map[string][]domain.Proposal, 10000)

	var scanned int

	for rows.Next() {

		var p domain.Proposal

		err := rows.Scan(&p.ID, &p.Number)
		if err != nil {
			return err
		}

		scanned++

		norm := normalize(p.Number)
		key := blockingKey(norm)

		buckets[key] = append(buckets[key], domain.Proposal{
			ID:     p.ID,
			Number: norm,
		})
	}

	matchCol := mongoDB.Collection("rule001_matches")
	clusterCol := mongoDB.Collection("rule001_clusters")
	decisionCol := mongoDB.Collection("rule001_decisions")

	workers := runtime.NumCPU()

	ch := make(chan struct {
		key   string
		group []domain.Proposal
	})

	var wg sync.WaitGroup
	var clustersFound int64
	var mutex sync.Mutex

	for w := 0; w < workers; w++ {

		wg.Add(1)

		go func() {

			defer wg.Done()

			for item := range ch {

				_ = processGroup(
					ctx,
					item.group,
					item.key,
					runID,
					now,
					matchCol,
					clusterCol,
					decisionCol,
					&clustersFound,
					&mutex,
				)
			}

		}()
	}

	for key, group := range buckets {
		ch <- struct {
			key   string
			group []domain.Proposal
		}{key, group}
	}

	close(ch)

	wg.Wait()

	run := RuleRun{
		RunID:          runID,
		RuleID:         RuleID,
		RuleVersion:    RuleVersion,
		Description:    "Detecta propostas com números semelhantes usando substring e distância de edição",
		StartedAt:      start,
		FinishedAt:     time.Now(),
		RecordsScanned: scanned,
		ClustersFound:  int(clustersFound),
	}

	_, err := mongoDB.Collection("rule_runs").InsertOne(ctx, run)

	return err
}
