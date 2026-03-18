package pipeline_test

import (
	"context"
	"errors"
	"testing"

	"validators/src/internal/pipeline"
)

type mockStage struct {
	name   string
	called bool
	err    error
}

func (m *mockStage) Name() string { return m.name }
func (m *mockStage) Process(_ context.Context, _ *pipeline.PipelineContext) error {
	m.called = true
	return m.err
}

func TestPipeline_RunsAllStages(t *testing.T) {
	s1 := &mockStage{name: "s1"}
	s2 := &mockStage{name: "s2"}
	s3 := &mockStage{name: "s3"}

	p := pipeline.New(s1, s2, s3)
	if err := p.Run(context.Background(), pipeline.NewPipelineContext()); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	for _, s := range []*mockStage{s1, s2, s3} {
		if !s.called {
			t.Errorf("stage %q was not called", s.name)
		}
	}
}

func TestPipeline_StopsOnFirstError(t *testing.T) {
	s1 := &mockStage{name: "s1"}
	s2 := &mockStage{name: "s2", err: errors.New("boom")}
	s3 := &mockStage{name: "s3"}

	p := pipeline.New(s1, s2, s3)
	err := p.Run(context.Background(), pipeline.NewPipelineContext())

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
	s := &mockStage{name: "failing-stage", err: boom}
	p := pipeline.New(s)

	err := p.Run(context.Background(), pipeline.NewPipelineContext())

	if !errors.Is(err, boom) {
		t.Errorf("expected wrapped original error, got: %v", err)
	}
}

func TestPipeline_EmptyPipeline(t *testing.T) {
	p := pipeline.New()
	if err := p.Run(context.Background(), pipeline.NewPipelineContext()); err != nil {
		t.Fatalf("empty pipeline should not error, got: %v", err)
	}
}
