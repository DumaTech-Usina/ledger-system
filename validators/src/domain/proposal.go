package domain

// TODO - Criar uma interface que busca dados externos
// e trata-os no nível de Staging para serem consumidos
// pelo Ledger posteriormente
type Proposal struct {
	ID     string
	Number string
}