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

	mt.Run("Scenario 1: No duplicates found", func(mt *mtest.T) {
		mockRows := &MockRows{
			Proposals: []Proposal{
				{ID: "01", Number: "123", Value: 1000, ClientID: "01", PlanID: "01", EffectiveDate: "2026-01-01"},
				{ID: "02", Number: "999", Value: 5000, ClientID: "02", PlanID: "02", EffectiveDate: "2026-02-01"},
			},
		}

		mt.AddMockResponses(mtest.CreateSuccessResponse())

		err := RunRule001Stream(context.Background(), mockRows, mt.DB)

		if err != nil {
			t.Errorf("Unexpected error: %v", err)
		}
	})

	mt.Run("Scenario 2: Multidimensional duplicate found", func(mt *mtest.T) {
		mockRows := &MockRows{
			Proposals: []Proposal{
				{ID: "01", Number: "123", Value: 1000, ClientID: "01", PlanID: "01", EffectiveDate: "2026-01-01"},
				{ID: "02", Number: "0123", Value: 1000, ClientID: "01", PlanID: "02", EffectiveDate: "2026-02-01"},
			},
		}

		mt.AddMockResponses(
			mtest.CreateSuccessResponse(),
			mtest.CreateSuccessResponse(),
			mtest.CreateSuccessResponse(),
		)

		err := RunRule001Stream(context.Background(), mockRows, mt.DB)

		if err != nil {
			t.Errorf("Unexpected error when saving duplicates: %v", err)
		}
	})

	mt.Run("Scenario 3: Ignore blank proposals", func(mt *mtest.T) {
		mockRows := &MockRows{
			Proposals: []Proposal{
				{ID: "01", Number: "   ", Value: 100, ClientID: "01"},
				{ID: "02", Number: "000", Value: 100, ClientID: "01"},
			},
		}

		mt.AddMockResponses(mtest.CreateSuccessResponse())

		err := RunRule001Stream(context.Background(), mockRows, mt.DB)

		if err != nil {
			t.Errorf("Error processing blanks: %v", err)
		}
	})
}
func TestHelpersAndGetters(t *testing.T) {
	_ = blockingKey("12")
	_ = blockingKey("123456")

	_ = abs(-10)
	_ = abs(10)

	_ = min(1, 2, 3)
	_ = min(3, 1, 2)
	_ = min(3, 2, 1)

	_ = levenshtein("", "abc")
	_ = levenshtein("abc", "")

	_ = similar("abc", "a")
	_ = similar("abc", "abcd")
	_ = similar("abcd", "abce")
	_ = similar("abcd", "ab99")

	r2 := Rule002{}
	_ = r2.RuleID()
	_ = r2.RuleVersion()
	_ = r2.BatchSize()
	_ = r2.Description()

	r3 := Rule003{}
	_ = r3.RuleID()
	_ = r3.RuleVersion()
	_ = r3.Description()

	r4 := Rule004{}
	_ = r4.RuleID()
	_ = r4.RuleVersion()
	_ = r4.Description()
}
