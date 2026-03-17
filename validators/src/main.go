package main

import (
	"context"
	"fmt"
	"log"
	client "validators/src/database"
	rules "validators/src/rules/proposals"

	"go.mongodb.org/mongo-driver/bson"
)

func main() {
	ctx := context.Background()

	log.Println("🔄 Conectando aos bancos de dados...")
	clients := client.NewConnection()

	log.Println("🧹 Limpando cache de auditorias anteriores...")
	_ = clients.Mongo.Collection("rule001_clusters").Drop(ctx)
	_ = clients.Mongo.Collection("rule001_matches").Drop(ctx)
	_ = clients.Mongo.Collection("rule001_decisions").Drop(ctx)
	_ = clients.Mongo.Collection("rule_runs").Drop(ctx)

	log.Println("📥 Lendo base de dados multidimensional...")

	query := `
		SELECT 
			id::text, 
			proposal_number,
			COALESCE(proposal_value, 0)::numeric,
			COALESCE(client_id::text, ''),
			COALESCE(plan_id::text, ''),
			COALESCE(effective_date::text, '')
		FROM proposals
		WHERE proposal_number IS NOT NULL 
		  AND TRIM(proposal_number) != ''
	`
	rows, err := clients.Postgres.Query(query)
	if err != nil {
		log.Fatal("Erro na Query principal: ", err)
	}
	defer rows.Close()

	log.Println("⚙️  Executando RULE-001 (Motor de Agrupamento)...")
	err = rules.RunRule001Stream(ctx, rows, clients.Mongo)
	if err != nil {
		log.Fatal("Erro na RULE-001: ", err)
	}

	var runData struct {
		RecordsScanned int `bson:"records_scanned"`
	}
	_ = clients.Mongo.Collection("rule_runs").FindOne(ctx, bson.M{"rule_id": "RULE-001"}).Decode(&runData)
	totalScannedRule1 := runData.RecordsScanned

	cursor, err := clients.Mongo.Collection("rule001_clusters").Find(ctx, bson.M{})
	if err != nil {
		log.Fatal("Erro ao ler Mongo: ", err)
	}
	defer cursor.Close(ctx)

	var totalClustersRule1 int
	var totalSuspiciousProposals int

	for cursor.Next(ctx) {
		var cluster struct {
			Proposals []string `bson:"proposals"`
		}
		if err := cursor.Decode(&cluster); err == nil && len(cluster.Proposals) > 1 {
			totalClustersRule1++
			totalSuspiciousProposals += len(cluster.Proposals)
		}
	}

	log.Println("⚙️  Executando RULE-002 (Motor de Pagamentos)...")
	rule002 := rules.Rule002{
		MongoDB:  clients.Mongo,
		Postgres: clients.Postgres,
	}

	totalScannedRule2, totalInconsistenciesRule2, _, err := rule002.Execute(ctx)
	if err != nil {
		log.Fatal("Erro na RULE-002: ", err)
	}

	log.Println("⚙️  Executando RULE-003 (Motor de Falsos Inadimplentes)...")
	rule003 := rules.Rule003{
		MongoDB:  clients.Mongo,
		Postgres: clients.Postgres,
	}

	totalScannedRule3, totalInconsistenciesRule3, err := rule003.Execute(ctx)
	if err != nil {
		log.Fatal("Erro na RULE-003: ", err)
	}

	log.Println("⚙️  Executando RULE-004 (Motor de Numeração Inválida)...")
	rule004 := rules.Rule004{
		MongoDB:  clients.Mongo,
		Postgres: clients.Postgres,
	}

	totalScannedRule4, totalInconsistenciesRule4, err := rule004.Execute(ctx)
	if err != nil {
		log.Fatal("Erro na RULE-004: ", err)
	}

	log.Println("✅ Processamento concluído!\n")

	fmt.Println("=================================================================")
	fmt.Println("📊 RESUMO EXECUTIVO DE AUDITORIA")
	fmt.Println("=================================================================")

	fmt.Printf("🔍 RULE-001 (Propostas Duplicadas):\n")
	fmt.Printf("   - Total de propostas analisadas  : %d\n", totalScannedRule1)
	fmt.Printf("   - Propostas suspeitas (total)    : %d\n", totalSuspiciousProposals)
	fmt.Printf("   - Grupos de duplicatas criados   : %d\n", totalClustersRule1)
	fmt.Println()

	fmt.Printf("💸 RULE-002 (Duplo Pagamento Sistêmico):\n")
	fmt.Printf("   - Propostas em risco analisadas  : %d\n", totalScannedRule2)
	fmt.Printf("   - Pagamentos duplos confirmados  : %d\n", totalInconsistenciesRule2)
	fmt.Println()

	fmt.Printf("🚨 RULE-003 (Falsos Inadimplentes):\n")
	fmt.Printf("   - Propostas com rec. pagos lidas : %d\n", totalScannedRule3)
	fmt.Printf("   - Parcelas abertas suspeitas     : %d\n", totalInconsistenciesRule3)
	fmt.Println()

	fmt.Printf("⚠️  RULE-004 (Numeração Inválida):\n")
	fmt.Printf("   - Propostas totais analisadas    : %d\n", totalScannedRule4)
	fmt.Printf("   - Propostas com número inválido  : %d\n", totalInconsistenciesRule4)
	fmt.Println("=================================================================\n")
}
