package rules

import (
	"context"
	"database/sql"
	"time"

	"fmt"

	"github.com/lib/pq"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

type Rule002 struct {
	MongoDB  *mongo.Database
	Postgres *sql.DB
}

func (r Rule002) RuleID() string      { return "RULE-002" }
func (r Rule002) RuleVersion() string { return "2.0" }
func (r Rule002) BatchSize() int      { return 1000 }
func (r Rule002) Description() string {
	return "Modo Auditoria Silenciosa: Retorna apenas contagens analíticas"
}

type ReceiptInfo struct {
	ReceiptID         string
	ProposalID        string
	ProposalNumber    string
	InstallmentNumber int
	ProposalCreatedAt time.Time
}

// Agora a função retorna a quantidade de propostas lidas e os erros encontrados
func (r Rule002) Execute(ctx context.Context) (int, int, []string, error) {
	start := time.Now()
	clusterCol := r.MongoDB.Collection("rule001_clusters")
	cursor, err := clusterCol.Find(ctx, bson.M{})
	if err != nil {
		return 0, 0, nil, err
	}
	defer cursor.Close(ctx)

	proposalToCluster := make(map[string]string)
	var allProposalIDs []string

	for cursor.Next(ctx) {
		var cluster struct {
			ClusterID string   `bson:"cluster_id"`
			Proposals []string `bson:"proposals"`
		}
		if err := cursor.Decode(&cluster); err != nil {
			continue
		}

		if len(cluster.Proposals) < 2 {
			continue
		}

		for _, propID := range cluster.Proposals {
			proposalToCluster[propID] = cluster.ClusterID
			allProposalIDs = append(allProposalIDs, propID)
		}
	}

	if len(allProposalIDs) == 0 {
		return 0, 0, nil, nil
	}

	query := `
		SELECT r.id::text, r.proposal_id::text, p.proposal_number, r.installment_number, p.created_at
		FROM receipts r
		JOIN proposals p ON p.id = r.proposal_id
		WHERE r.payment_status = 'PAGO' 
		  AND r.proposal_id::text = ANY($1)
	`

	rows, err := r.Postgres.QueryContext(ctx, query, pq.Array(allProposalIDs))
	if err != nil {
		return 0, 0, nil, err
	}
	defer rows.Close()

	clusterBuckets := make(map[string]map[int][]ReceiptInfo)

	for rows.Next() {
		var info ReceiptInfo
		if err := rows.Scan(&info.ReceiptID, &info.ProposalID, &info.ProposalNumber, &info.InstallmentNumber, &info.ProposalCreatedAt); err != nil {
			continue
		}

		cID := proposalToCluster[info.ProposalID]
		if clusterBuckets[cID] == nil {
			clusterBuckets[cID] = make(map[int][]ReceiptInfo)
		}
		clusterBuckets[cID][info.InstallmentNumber] = append(clusterBuckets[cID][info.InstallmentNumber], info)
	}

	var totalEncontrados int
	var alertas []string

	for _, installments := range clusterBuckets {
		for instNum, receipts := range installments {
			if len(receipts) > 1 {
				totalEncontrados++

				var numerosPropostas []string
				for _, rec := range receipts {
					numerosPropostas = append(numerosPropostas, rec.ProposalNumber)
				}

				mensagem := fmt.Sprintf("Parcela %d paga %d vezes. Propostas agrupadas: %v",
					instNum, len(receipts), numerosPropostas)
				alertas = append(alertas, mensagem)
			}
		}
	}

	runData := bson.M{
		"rule_id":         r.RuleID(),
		"started_at":      start,
		"finished_at":     time.Now(),
		"records_scanned": len(allProposalIDs),
		"issues_found":    totalEncontrados,
	}
	_, _ = r.MongoDB.Collection("rule_runs").InsertOne(ctx, runData)

	return len(allProposalIDs), totalEncontrados, alertas, nil
}
