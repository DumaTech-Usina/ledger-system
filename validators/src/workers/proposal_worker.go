package workers

import (
	"fmt"
	"validators/src/domain"
	"validators/src/pipeline"
)

type ProposalWorker struct {
    Engine *pipeline.Engine
}

func (w *ProposalWorker) Process(p domain.Proposal) {
    results, finalScore := w.Engine.Run(p)

    fmt.Println("Proposal:", p.ID)
    fmt.Println("Final Score:", finalScore)

    for _, r := range results {
        if r.Triggered {
            fmt.Println(" -", r.RuleID, r.Reason, r.Score)
        }
    }
}