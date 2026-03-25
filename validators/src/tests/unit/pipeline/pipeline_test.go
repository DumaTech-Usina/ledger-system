package pipeline_test

import (
	"context"
	"errors"
	"testing"

	"validators/src/internal/pipeline"
)

// stubStage is a minimal Stage[string] for testing pipeline mechanics.
type stubStage struct {
	name   string
	called bool
	err    error
}

func (s *stubStage) Name() string { return s.name }
func (s *stubStage) Execute(_ context.Context, _ *pipeline.Context[string]) error {
	s.called = true
	return s.err
}

func newCtx() *pipeline.Context[string] {
	return pipeline.NewContext("initial")
}

func TestPipeline_RunsAllStages(t *testing.T) {
	s1 := &stubStage{name: "s1"}
	s2 := &stubStage{name: "s2"}
	s3 := &stubStage{name: "s3"}

	p := pipeline.New[string](s1, s2, s3)
	if err := p.Run(context.Background(), newCtx()); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	for _, s := range []*stubStage{s1, s2, s3} {
		if !s.called {
			t.Errorf("stage %q was not called", s.name)
		}
	}
}

func TestPipeline_StopsOnFirstError(t *testing.T) {
	s1 := &stubStage{name: "s1"}
	s2 := &stubStage{name: "s2", err: errors.New("boom")}
	s3 := &stubStage{name: "s3"}

	p := pipeline.New[string](s1, s2, s3)
	err := p.Run(context.Background(), newCtx())

	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if !s1.called {
		t.Error("s1 should have been called")
	}
	if !s2.called {
		t.Error("s2 should have been called")
	}
	if s3.called {
		t.Error("s3 must NOT be called after s2 failed")
	}
}

func TestPipeline_ErrorWrapsStage(t *testing.T) {
	boom := errors.New("original error")
	s := &stubStage{name: "failing-stage", err: boom}
	p := pipeline.New[string](s)

	err := p.Run(context.Background(), newCtx())

	if !errors.Is(err, boom) {
		t.Errorf("expected wrapped original error, got: %v", err)
	}
}

func TestPipeline_EmptyPipeline(t *testing.T) {
	p := pipeline.New[string]()
	if err := p.Run(context.Background(), newCtx()); err != nil {
		t.Fatalf("empty pipeline should not error, got: %v", err)
	}
}

func TestPipeline_StageCanMutateData(t *testing.T) {
	mutator := &mutatingStage{appendVal: " world"}
	p := pipeline.New[string](mutator)
	pctx := pipeline.NewContext("hello")

	if err := p.Run(context.Background(), pctx); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if pctx.Data != "hello world" {
		t.Errorf("expected %q, got %q", "hello world", pctx.Data)
	}
}

type mutatingStage struct{ appendVal string }

func (m *mutatingStage) Name() string { return "mutator" }
func (m *mutatingStage) Execute(_ context.Context, pctx *pipeline.Context[string]) error {
	pctx.Data += m.appendVal
	return nil
}
