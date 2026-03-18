package domain

type Cluster struct {
	ID          string
	BlockingKey string
	Proposals   []string
	Numbers     []string
	Reasons     []string
}
