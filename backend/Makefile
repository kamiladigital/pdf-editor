.PHONY: run build clean

run:
	@echo "Starting PDF decryption backend server..."
	@go run cmd/server/main.go

build:
	@echo "Building PDF decryption backend..."
	@go build -o bin/pdf-decrypt-server cmd/server/main.go

clean:
	@echo "Cleaning up..."
	@rm -rf bin/ uploads/ outputs/

install-deps:
	@echo "Installing dependencies..."
	@go mod download

test:
	@echo "Running tests..."
	@go test ./...

dev:
	@echo "Starting development server with air..."
	@if command -v air > /dev/null; then \
		air; \
	else \
		echo "Air not installed. Installing..."; \
		go install github.com/cosmtrek/air@latest; \
		air; \
	fi