package config

import (
	"context"
	"database/sql"
	"time"

	_ "github.com/lib/pq"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type DBConnections struct {
	Postgres *sql.DB
	MongoDB  *mongo.Database
}

func Connect(postgresURL, mongoURL, mongoDBName string) (*DBConnections, error) {
	pg, err := sql.Open("postgres", postgresURL)
	if err != nil {
		return nil, err
	}
	if err := pg.Ping(); err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(mongoURL))
	if err != nil {
		return nil, err
	}

	return &DBConnections{
		Postgres: pg,
		MongoDB:  client.Database(mongoDBName),
	}, nil
}
