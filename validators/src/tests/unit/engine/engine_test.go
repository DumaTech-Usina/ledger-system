package engine_test

import (
	"context"
	"testing"

	"validators/src/internal/engine"
	"validators/src/internal/rules"
	"validators/src/tests/fixtures"
)

// stubRule is a minimal Rule implementation for engine testing.
type stubRule struct {
	name   string
	result rules.RuleResult
}

func (s *stubRule) Name() string                                  { return s.name }
func (s *stubRule) Description() string                           { return "stub" }
func (s *stubRule) Execute(_ *rules.ValidationContext) rules.RuleResult { return s.result }

func newStub(name string, issues int) *stubRule {
	return &stubRule{
		name:   name,
		result: rules.RuleResult{RuleName: name, IssuesFound: issues, Triggered: issues > 0},
	}
}

func TestRegistry_RegisterAndRetrieve(t *testing.T) {
	reg := engine.NewRegistry()
	reg.MustRegister(newStub("R1", 0))
	reg.MustRegister(newStub("R2", 1))

	retrieved := reg.Rules()
	if len(retrieved) != 2 {
		t.Fatalf("expected 2 rules, got %d", len(retrieved))
	}
	if retrieved[0].Name() != "R1" || retrieved[1].Name() != "R2" {
		t.Error("rules must be returned in registration order")
	}
}

func TestRegistry_DuplicateNamePanics(t *testing.T) {
	reg := engine.NewRegistry()
	reg.MustRegister(newStub("R1", 0))

	defer func() {
		if r := recover(); r == nil {
			t.Error("expected panic on duplicate rule name")
		}
	}()
	reg.MustRegister(newStub("R1", 0))
}

func TestEngine_Sequential_CollectsAllResults(t *testing.T) {
	reg := engine.NewRegistry()
	reg.MustRegister(newStub("R1", 0))
	reg.MustRegister(newStub("R2", 3))
	reg.MustRegister(newStub("R3", 0))

	eng := engine.NewValidationEngine(reg, engine.Sequential)
	ctx := fixtures.NewValidationContextBuilder().Build()

	results := eng.Run(context.Background(), ctx)

	if len(results) != 3 {
		t.Fatalf("expected 3 results, got %d", len(results))
	}
	if results[1].IssuesFound != 3 {
		t.Errorf("expected R2 to report 3 issues, got %d", results[1].IssuesFound)
	}
}

func TestEngine_Parallel_CollectsAllResults(t *testing.T) {
	reg := engine.NewRegistry()
	for i := 0; i < 10; i++ {
		reg.MustRegister(newStub(string(rune('A'+i)), i))
	}

	eng := engine.NewValidationEngine(reg, engine.Parallel)
	ctx := fixtures.NewValidationContextBuilder().Build()

	results := eng.Run(context.Background(), ctx)

	if len(results) != 10 {
		t.Fatalf("expected 10 results, got %d", len(results))
	}
}
