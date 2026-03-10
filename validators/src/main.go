package main

import (
	"context"
	"log"
	client "validators/src/database"
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

	err = rules.RunRule001Stream(
		ctx,
		rows,
		clients.Mongo,
	)

	if err != nil {
		log.Fatal(err)
	}

	log.Println("RULE-001 stream execution complete")
}
