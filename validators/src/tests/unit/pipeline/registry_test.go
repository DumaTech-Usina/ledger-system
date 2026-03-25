package pipeline_test

import (
	"context"
	"errors"
	"testing"

	"validators/src/internal/pipeline"
)

type stubRunner struct {
	called bool
	err    error
}

func (r *stubRunner) Run(_ context.Context) error {
	r.called = true
	return r.err
}

func TestRegistry_RegisterAndRun(t *testing.T) {
	reg := pipeline.NewRegistry()
	r := &stubRunner{}

	if err := reg.Register("foo", r); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if err := reg.Run(context.Background(), "foo"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !r.called {
		t.Error("runner was not called")
	}
}

func TestRegistry_DuplicateRegistration(t *testing.T) {
	reg := pipeline.NewRegistry()
	reg.MustRegister("foo", &stubRunner{})

	err := reg.Register("foo", &stubRunner{})
	if err == nil {
		t.Fatal("expected error for duplicate name, got nil")
	}
}

func TestRegistry_MustRegister_Panics(t *testing.T) {
	reg := pipeline.NewRegistry()
	reg.MustRegister("foo", &stubRunner{})

	defer func() {
		if recover() == nil {
			t.Error("expected panic for duplicate MustRegister, got none")
		}
	}()
	reg.MustRegister("foo", &stubRunner{})
}

func TestRegistry_RunUnknownPipeline(t *testing.T) {
	reg := pipeline.NewRegistry()
	err := reg.Run(context.Background(), "nonexistent")
	if err == nil {
		t.Fatal("expected error for unknown pipeline, got nil")
	}
}

func TestRegistry_RunPropagatesError(t *testing.T) {
	boom := errors.New("runner failed")
	reg := pipeline.NewRegistry()
	reg.MustRegister("bad", &stubRunner{err: boom})

	err := reg.Run(context.Background(), "bad")
	if !errors.Is(err, boom) {
		t.Errorf("expected wrapped boom error, got: %v", err)
	}
}

func TestRegistry_Names(t *testing.T) {
	reg := pipeline.NewRegistry()
	reg.MustRegister("a", &stubRunner{})
	reg.MustRegister("b", &stubRunner{})

	names := reg.Names()
	if len(names) != 2 {
		t.Fatalf("expected 2 names, got %d", len(names))
	}
}
