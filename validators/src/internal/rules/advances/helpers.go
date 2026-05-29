package advances

import "fmt"

// buildDetails produces a Details slice from a FlaggedProposals map.
// label is the entity name used in the message (e.g. "advance", "receipt").
func buildDetails(flagged map[string]string, label string) []string {
	if len(flagged) == 0 {
		return nil
	}
	details := make([]string, 0, len(flagged))
	for id, reason := range flagged {
		details = append(details, fmt.Sprintf("%s %s: %s", label, id, reason))
	}
	return details
}
