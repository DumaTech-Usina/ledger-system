package domain

// TODO - Criar uma interface que busca dados externos
// e trata-os no nível de Staging para serem consumidos
// pelo Ledger posteriormente
type Proposal struct {
	ID           string
	Number       string
	Value        float64
	Installments []Installment
	Client       Client
	Broker       Broker
}

type Installment struct {
	Number            int
	Value             float64
	DueDate           string
	ProposalID        string
	InstallmentNumber int
	PaymentStatus     string
}

type Client struct {
	ID   string
	Name string
}

type Broker struct {
	ID   string
	Name string
}
