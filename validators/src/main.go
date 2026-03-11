package main

import (
	"context"
	"log"
	client "validators/src/database"
	"validators/src/domain"
	rules "validators/src/rules/proposals"
)

func main() {

	ctx := context.Background()

	clients := client.NewConnection()

	rows, err := clients.Postgres.Query(`
		SELECT id, proposal_number
		FROM proposals
	`)
	if err != nil {
		log.Fatal(err)
	}

	defer rows.Close()

	log.Println("🚀 Iniciando execução da RULE-001...")
	err = rules.RunRule001Stream(
		ctx,
		rows,
		clients.Mongo,
	)
	if err != nil {
		log.Fatal("Erro na RULE-001: ", err)
	}
	log.Println("✅ RULE-001 finalizada! Clusters gerados no MongoDB.")

	// ==========================================
	// EXECUÇÃO DA RULE-002
	// ==========================================
	log.Println("🚀 Iniciando execução da RULE-002...")

	// Instancia a nova regra passando os dois bancos que ela precisa
	regra002 := rules.Rule002{
		MongoDB:  clients.Mongo,
		Postgres: clients.Postgres, // A Rule002 precisa do Postgres para atualizar os recibos!
	}

	// Executa a regra.
	// Como a Rule002 lê direto do Mongo (os clusters), podemos passar um array vazio no input.
	err = regra002.Execute(ctx, []domain.Proposal{})
	if err != nil {
		log.Fatal("Erro na RULE-002: ", err)
	}

	log.Println("✅ RULE-002 finalizada! Recibos duplicados processados.")
	log.Println("🎉 Todo o processamento foi concluído com sucesso!")
}
