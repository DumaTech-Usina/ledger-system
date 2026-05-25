.PHONY: dev dev-polling migrate test build

# Full RabbitMQ-based stack: proposal producer+consumer + receipt producer+consumer.
# Requires: docker compose up -d (Postgres, MongoDB, RabbitMQ).
# Ctrl-C stops all four processes cleanly.
dev:
	@trap 'kill 0' SIGINT SIGTERM; \
	go run ./src/cmd/workers/proposal-producer/ & \
	go run ./src/cmd/workers/proposal-consumer/ & \
	go run ./src/cmd/workers/receipt-producer/ & \
	go run ./src/cmd/workers/receipt-consumer/ & \
	wait

# Polling-based stack (no RabbitMQ required): proposal validator + receipt canonical.
# Useful for development without a running broker.
dev-polling:
	@trap 'kill 0' SIGINT SIGTERM; \
	go run ./src/cmd/workers/proposal-validator/ & \
	go run ./src/cmd/workers/receipt-canonical/ & \
	wait

migrate:
	go run ./src/cmd/migrate/

test:
	go test ./src/tests/...

build:
	go build ./...
