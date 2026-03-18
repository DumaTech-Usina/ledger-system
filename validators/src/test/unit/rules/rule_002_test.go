package rules

import (
	"context"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/lib/pq"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/integration/mtest"
)

func TestRule002_Execute(t *testing.T) {
	mt := mtest.New(t, mtest.NewOptions().ClientType(mtest.Mock))

	mt.Run("Cenario 1: Sem clusters no Mongo (Retorno Antecipado)", func(mt *mtest.T) {
		db, _, err := sqlmock.New()
		if err != nil {
			t.Fatalf("Erro mock Postgres: %v", err)
		}
		defer db.Close()

		rule := Rule002{Postgres: db, MongoDB: mt.DB}

		firstBatch := mtest.CreateCursorResponse(0, "rule_engine.rule001_clusters", mtest.FirstBatch)
		mt.AddMockResponses(firstBatch)

		mt.AddMockResponses(mtest.CreateSuccessResponse())

		read, found, _, err := rule.Execute(context.Background())

		if err != nil {
			t.Errorf("Erro inesperado: %v", err)
		}
		if read != 0 || found != 0 {
			t.Errorf("Esperava 0 read e 0 found, veio %d e %d", read, found)
		}
	})

	mt.Run("Cenario 2: Duplo pagamento encontrado com sucesso", func(mt *mtest.T) {
		db, mock, err := sqlmock.New()
		if err != nil {
			t.Fatalf("Erro mock Postgres: %v", err)
		}
		defer db.Close()

		rule := Rule002{Postgres: db, MongoDB: mt.DB}

		clusterDoc := bson.D{
			{Key: "cluster_id", Value: "cluster-123"},
			{Key: "proposals", Value: bson.A{"prop-1", "prop-2"}},
		}
		firstBatch := mtest.CreateCursorResponse(1, "rule_engine.rule001_clusters", mtest.FirstBatch, clusterDoc)
		killCursors := mtest.CreateCursorResponse(0, "rule_engine.rule001_clusters", mtest.NextBatch)
		mt.AddMockResponses(firstBatch, killCursors)

		rows := sqlmock.NewRows([]string{"id", "proposal_id", "proposal_number", "installment_number", "created_at"}).
			AddRow("rec-1", "prop-1", "123", 1, time.Now()).
			AddRow("rec-2", "prop-2", "0123", 1, time.Now())

		mock.ExpectQuery("SELECT r.id::text, r.proposal_id::text, p.proposal_number").
			WithArgs(pq.Array([]string{"prop-1", "prop-2"})).
			WillReturnRows(rows)

		mt.AddMockResponses(mtest.CreateSuccessResponse())

		read, found, _, err := rule.Execute(context.Background())

		if err != nil {
			t.Errorf("Erro inesperado: %v", err)
		}
		if read != 2 {
			t.Errorf("Esperava 2 propostas read do Mongo, veio %d", read)
		}
		if found != 1 {
			t.Errorf("Esperava achar 1 duplo pagamento, veio %d", found)
		}
	})
}
