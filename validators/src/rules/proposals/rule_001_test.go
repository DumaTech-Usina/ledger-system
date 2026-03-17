package rules

import (
	"context"
	"testing"

	"go.mongodb.org/mongo-driver/mongo/integration/mtest"
)

type MockRows struct {
	Proposals []Proposal
	index     int
}

func (m *MockRows) Next() bool {
	if m.index < len(m.Proposals) {
		return true
	}
	return false
}

func (m *MockRows) Scan(dest ...any) error {
	p := m.Proposals[m.index]
	*dest[0].(*string) = p.ID
	*dest[1].(*string) = p.Number
	*dest[2].(*float64) = p.Value
	*dest[3].(*string) = p.ClientID
	*dest[4].(*string) = p.PlanID
	*dest[5].(*string) = p.EffectiveDate
	m.index++
	return nil
}

func TestRule001_RunRule001Stream(t *testing.T) {
	mt := mtest.New(t, mtest.NewOptions().ClientType(mtest.Mock))

	mt.Run("Cenario 1: Nenhuma duplicata encontrada", func(mt *mtest.T) {
		fakeRows := &MockRows{
			Proposals: []Proposal{
				{ID: "p1", Number: "123", Value: 1000, ClientID: "c1", PlanID: "pl1", EffectiveDate: "2026-01-01"},
				{ID: "p2", Number: "999", Value: 5000, ClientID: "c2", PlanID: "pl2", EffectiveDate: "2026-02-01"},
			},
		}

		mt.AddMockResponses(mtest.CreateSuccessResponse())

		err := RunRule001Stream(context.Background(), fakeRows, mt.DB)

		if err != nil {
			t.Errorf("Não esperava erro, recebeu: %v", err)
		}
	})

	mt.Run("Cenario 2: Duplicata Multidimensional Encontrada", func(mt *mtest.T) {
		fakeRows := &MockRows{
			Proposals: []Proposal{
				{ID: "p1", Number: "123", Value: 1000, ClientID: "c1", PlanID: "pl1", EffectiveDate: "2026-01-01"},
				{ID: "p2", Number: "0123", Value: 1000, ClientID: "c1", PlanID: "pl2", EffectiveDate: "2026-02-01"},
			},
		}

		mt.AddMockResponses(
			mtest.CreateSuccessResponse(),
			mtest.CreateSuccessResponse(),
			mtest.CreateSuccessResponse(),
		)

		err := RunRule001Stream(context.Background(), fakeRows, mt.DB)

		if err != nil {
			t.Errorf("Não esperava erro ao salvar duplicatas, recebeu: %v", err)
		}
	})

	mt.Run("Cenario 3: Ignorar propostas em branco", func(mt *mtest.T) {
		fakeRows := &MockRows{
			Proposals: []Proposal{
				{ID: "p1", Number: "   ", Value: 100, ClientID: "c1"},
				{ID: "p2", Number: "000", Value: 100, ClientID: "c1"},
			},
		}

		mt.AddMockResponses(mtest.CreateSuccessResponse())

		err := RunRule001Stream(context.Background(), fakeRows, mt.DB)

		if err != nil {
			t.Errorf("Erro ao processar brancos: %v", err)
		}
	})
}
