package rules

import (
	"context"
	"database/sql"
	"log"
	"time"
	"validators/src/domain"

	"github.com/lib/pq"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

type Rule002 struct {
	MongoDB  *mongo.Database
	Postgres *sql.DB
}

func (r Rule002) RuleID() string      { return "RULE-002" }
func (r Rule002) RuleVersion() string { return "1.0" }
func (r Rule002) BatchSize() int      { return 1000 }
func (r Rule002) Description() string {
	return "Identifica parcelas pagas em propostas duplicadas (Double Payment) e aplica Fix Strategy"
}

func (r Rule002) Execute(ctx context.Context, input []domain.Proposal) error {

	clusterCol := r.MongoDB.Collection("rule001_clusters")
	cursor, err := clusterCol.Find(ctx, bson.M{})
	if err != nil {
		return err
	}
	defer cursor.Close(ctx)

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

		err = r.processDuplicatedReceipts(ctx, cluster.ClusterID, cluster.Proposals)
		if err != nil {
			log.Printf("Erro ao processar recibos do cluster %s: %v", cluster.ClusterID, err)
		}
	}

	return nil
}

type ReceiptInfo struct {
	ReceiptID         string
	ProposalID        string
	InstallmentNumber int
	ProposalCreatedAt time.Time
}

func (r Rule002) processDuplicatedReceipts(ctx context.Context, clusterID string, proposalIDs []string) error {
	query := `
		SELECT r.id, r.proposal_id, r.installment_number, p.created_at
		FROM receipts r
		JOIN proposals p ON p.id = r.proposal_id
		WHERE r.payment_status = 'paid' 
		  AND r.proposal_id = ANY($1)
	`
	rows, err := r.Postgres.QueryContext(ctx, query, pq.Array(proposalIDs))
	if err != nil {
		return err
	}
	defer rows.Close()

	installmentBuckets := make(map[int][]ReceiptInfo)

	for rows.Next() {
		var info ReceiptInfo
		if err := rows.Scan(&info.ReceiptID, &info.ProposalID, &info.InstallmentNumber, &info.ProposalCreatedAt); err != nil {
			continue
		}
		installmentBuckets[info.InstallmentNumber] = append(installmentBuckets[info.InstallmentNumber], info)
	}

	for installmentNumber, paidReceipts := range installmentBuckets {
		if len(paidReceipts) > 1 {
			log.Printf("🚨 RULE-002: Duplo pagamento detectado! Parcela %d paga %d vezes (Cluster: %s)",
				installmentNumber, len(paidReceipts), clusterID)

			canon := paidReceipts[0]
			for _, receitp := range paidReceipts {
				if receitp.ProposalCreatedAt.Before(canon.ProposalCreatedAt) {
					canon = receitp
				}
			}

			var receiptsToCancel []string
			for _, receipt := range paidReceipts {
				if receipt.ReceiptID != canon.ReceiptID {
					receiptsToCancel = append(receiptsToCancel, receipt.ReceiptID)
				}
			}

			if len(receiptsToCancel) > 0 {
				updateQuery := `UPDATE receipts SET payment_status = 'canceled_duplicate' WHERE id = ANY($1)`

				_, err := r.Postgres.ExecContext(ctx, updateQuery, pq.Array(receiptsToCancel))
				if err != nil {
					log.Printf("Erro ao aplicar Fix Strategy nos recibos: %v", err)
				} else {
					log.Printf("✅ FIX_STRATEGY Aplicada: Recibos %v marcados como 'canceled_duplicate'. Canônica mantida: %s",
						receiptsToCancel, canon.ReceiptID)
				}
			}
		}
	}

	return nil
}
