package main

import (
	"context"
	"log"
	"os"
	"time"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	infraMongo "validators/src/internal/infrastructure/mongodb"
)

func main() {
	mongoURL := envOr("MONGO_URL", "mongodb://root:rootpassword@localhost:27017")
	mongoDBName := envOr("MONGO_DB", "rules_engine_v3")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(mongoURL))
	if err != nil {
		log.Fatalf("mongo connect: %v", err)
	}
	defer client.Disconnect(context.Background())

	db := client.Database(mongoDBName)

	log.Println("creating indexes...")
	if err := infraMongo.EnsureIndexes(ctx, db); err != nil {
		log.Fatalf("EnsureIndexes: %v", err)
	}
	log.Println("indexes OK")
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
