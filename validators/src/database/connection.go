package client

import (
	"context"
	"database/sql"
	"log"
	"time"

	_ "github.com/lib/pq"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type Connection struct {
	Postgres *sql.DB
	Mongo    *mongo.Database
}

func NewConnection() *Connection {

	pgConn := "postgres://developer:postgres@localhost:5454/usina?sslmode=disable"

	pg, err := sql.Open("postgres", pgConn)
	if err != nil {
		log.Fatal(err)
	}

	err = pg.Ping()
	if err != nil {
		log.Fatal(err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	mongoClient, err := mongo.Connect(
		ctx,
		options.Client().ApplyURI("mongodb://root:rootpassword@localhost:27017"),
	)
	if err != nil {
		log.Fatal(err)
	}

	db := mongoClient.Database("rules_engine")

	return &Connection{
		Postgres: pg,
		Mongo:    db,
	}
}
