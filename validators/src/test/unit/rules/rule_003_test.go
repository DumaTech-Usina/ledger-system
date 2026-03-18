package rules

import (
	"context"
	"errors"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"go.mongodb.org/mongo-driver/mongo/integration/mtest"
)

func TestRule003_Execute(t *testing.T) {
	mt := mtest.New(t, mtest.NewOptions().ClientType(mtest.Mock))

	mt.Run("Cenario 1: Sucesso - Sem falsos inadimplentes", func(mt *mtest.T) {
		db, mock, err := sqlmock.New()
		if err != nil {
			t.Fatalf("Erro ao criar mock do banco: %v", err)
		}
		defer db.Close()

		rule := Rule003{Postgres: db, MongoDB: mt.DB}

		mock.ExpectQuery("SELECT COUNT\\(DISTINCT proposal_id\\)").
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(200))

		mock.ExpectQuery("WITH PaidMax AS").
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))

		mt.AddMockResponses(mtest.CreateSuccessResponse())

		analyzed, found, err := rule.Execute(context.Background())

		if err != nil {
			t.Errorf("Erro inesperado: %v", err)
		}
		if analyzed != 200 {
			t.Errorf("Esperado 200, veio %d", analyzed)
		}
		if found != 0 {
			t.Errorf("Esperado 0, veio %d", found)
		}
	})

	mt.Run("Cenario 2: Sucesso - Com falsos inadimplentes", func(mt *mtest.T) {
		db, mock, err := sqlmock.New()
		if err != nil {
			t.Fatalf("Erro mock: %v", err)
		}
		defer db.Close()

		rule := Rule003{Postgres: db, MongoDB: mt.DB}

		mock.ExpectQuery("SELECT COUNT\\(DISTINCT proposal_id\\)").
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(150))

		mock.ExpectQuery("WITH PaidMax AS").
			WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(12))

		mt.AddMockResponses(mtest.CreateSuccessResponse())

		analyzed, found, err := rule.Execute(context.Background())

		if err != nil {
			t.Errorf("Erro inesperado: %v", err)
		}
		if analyzed != 150 {
			t.Errorf("Esperado 150, veio %d", analyzed)
		}
		if found != 12 {
			t.Errorf("Esperado 12, veio %d", found)
		}
	})

	mt.Run("Cenario 3: Erro no banco de dados Postgres", func(mt *mtest.T) {
		db, mock, err := sqlmock.New()
		if err != nil {
			t.Fatalf("Erro mock: %v", err)
		}
		defer db.Close()

		rule := Rule003{Postgres: db, MongoDB: mt.DB}

		mock.ExpectQuery("SELECT COUNT\\(DISTINCT proposal_id\\)").
			WillReturnError(errors.New("conexão com Postgres perdida"))

		_, _, err = rule.Execute(context.Background())

		if err == nil {
			t.Errorf("Esperava um erro de banco, mas a função passou direto")
		}
	})
}
