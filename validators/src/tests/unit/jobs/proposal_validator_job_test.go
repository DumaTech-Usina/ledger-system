package jobs_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"validators/src/internal/application/jobs"
	"validators/src/internal/rules"
)

// mockPipelineRunner is a test double for jobs.PipelineRunner.
type mockPipelineRunner struct {
	results  []rules.RuleResult
	err      error
	runCount int
}

func (m *mockPipelineRunner) Run(_ context.Context) error {
	m.runCount++
	return m.err
}

func (m *mockPipelineRunner) Results() []rules.RuleResult { return m.results }

func TestProposalValidatorJob_Run_ReturnsResults(t *testing.T) {
	want := []rules.RuleResult{{RuleName: "RULE-001", RecordsScanned: 10}}
	mock := &mockPipelineRunner{results: want}

	job := jobs.NewProposalValidatorJob(mock)
	got, err := job.Run(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 1 || got[0].RuleName != "RULE-001" {
		t.Errorf("unexpected results: %+v", got)
	}
}

func TestProposalValidatorJob_Run_PropagatesError(t *testing.T) {
	boom := errors.New("database unavailable")
	mock := &mockPipelineRunner{err: boom}

	job := jobs.NewProposalValidatorJob(mock)
	_, err := job.Run(context.Background())
	if !errors.Is(err, boom) {
		t.Errorf("expected pipeline error to propagate, got: %v", err)
	}
}

func TestProposalValidatorJob_Run_ErrorYieldsNilResults(t *testing.T) {
	mock := &mockPipelineRunner{err: errors.New("fail")}

	job := jobs.NewProposalValidatorJob(mock)
	results, _ := job.Run(context.Background())
	if results != nil {
		t.Errorf("expected nil results on error, got: %+v", results)
	}
}

func TestProposalValidatorJob_StartPolling_StopsOnContextCancellation(t *testing.T) {
	mock := &mockPipelineRunner{results: []rules.RuleResult{}}
	job := jobs.NewProposalValidatorJob(mock)

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	err := job.StartPolling(ctx, 10*time.Millisecond)
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Errorf("expected DeadlineExceeded, got: %v", err)
	}
	if mock.runCount == 0 {
		t.Error("expected at least one run before cancellation")
	}
}

func TestProposalValidatorJob_StartPolling_ContinuesDespiteRunErrors(t *testing.T) {
	mock := &mockPipelineRunner{err: errors.New("transient error")}
	job := jobs.NewProposalValidatorJob(mock)

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Millisecond)
	defer cancel()

	_ = job.StartPolling(ctx, 10*time.Millisecond)

	if mock.runCount < 2 {
		t.Errorf("polling must continue despite run errors, ran only %d time(s)", mock.runCount)
	}
}
