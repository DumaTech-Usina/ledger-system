package rules

import (
	"context"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"go.mongodb.org/mongo-driver/mongo/integration/mtest"
)

func TestRule004_Execute(t *testing.T) {
	mt := mtest.New(t, mtest.NewOptions().ClientType(mtest.Mock))

	mt.Run("Cenario 1: Sucesso - Sem nenhuma proposta invalida", func(mt *mtest.T) {
		db, mock, err := sqlmock.New()
		if err != nil {
			t.Fatalf("Erro ao criar mock do banco: %v", err)
		}
		defer db.Close()

		rule := Rule004{
			Postgres: db,
			MongoDB:  mt.DB,
		}

		mock.ExpectQuery("SELECT COUNT\\(\\*\\) FROM proposals").
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(100))

		mock.ExpectQuery("SELECT COUNT\\(\\*\\) FROM proposals WHERE").
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))

		mt.AddMockResponses(mtest.CreateSuccessResponse())

		allReads, totalInconsistencias, err := rule.Execute(context.Background())

		if err != nil {
			t.Errorf("Não era esperado nenhum erro, mas retornou: %v", err)
		}
		if allReads != 100 {
			t.Errorf("Esperava 100 lidas, retornou %d", allReads)
		}
		if totalInconsistencias != 0 {
			t.Errorf("Esperava 0 inconsistências, retornou %d", totalInconsistencias)
		}

		if err := mock.ExpectationsWereMet(); err != nil {
			t.Errorf("Nem todas as expectativas do banco foram atendidas: %v", err)
		}
	})

	mt.Run("Cenario 2: Sucesso - Propostas com numero zerado encontradas", func(mt *mtest.T) {
		db, mock, err := sqlmock.New()
		if err != nil {
			t.Fatalf("Erro ao criar mock do banco: %v", err)
		}
		defer db.Close()

		rule := Rule004{
			Postgres: db,
			MongoDB:  mt.DB,
		}

		mock.ExpectQuery("SELECT COUNT\\(\\*\\) FROM proposals").
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(50))

		mock.ExpectQuery("SELECT COUNT\\(\\*\\) FROM proposals WHERE").
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(5))

		mt.AddMockResponses(mtest.CreateSuccessResponse())

		allReads, totalInconsistency, err := rule.Execute(context.Background())

		if err != nil {
			t.Errorf("Não era esperado nenhum erro, mas retornou: %v", err)
		}
		if allReads != 50 {
			t.Errorf("Esperava 50 lidas, retornou %d", allReads)
		}
		if totalInconsistency != 5 {
			t.Errorf("Esperava 5 inconsistências, retornou %d", totalInconsistency)
		}
	})
}
