.PHONY: build run docker-build docker-run docker-clean test

# Go build variables
BINARY_NAME=pdf-decrypt-server
GO_BUILD_FLAGS=-ldflags="-w -s"

# Docker variables
DOCKER_IMAGE_NAME=pdf-decrypt-server
DOCKER_CONTAINER_NAME=pdf-decrypt-server

# Build the Go binary
build:
	@echo "Building Go binary..."
	go build $(GO_BUILD_FLAGS) -o bin/$(BINARY_NAME) ./cmd/server

# Run the Go binary locally
run: build
	@echo "Starting server..."
	./bin/$(BINARY_NAME)

# Run in development mode with hot reload (requires air)
dev:
	@if command -v air > /dev/null; then \
		air; \
	else \
		echo "Installing air for hot reload..."; \
		go install github.com/cosmtrek/air@latest; \
		air; \
	fi

# Build Docker image
docker-build:
	@echo "Building Docker image..."
	docker build -t $(DOCKER_IMAGE_NAME) .

# Run Docker container
docker-run: docker-build
	@echo "Starting Docker container..."
	docker run -d \
		--name $(DOCKER_CONTAINER_NAME) \
		-p 8080:8080 \
		-v pdf-uploads:/app/uploads \
		-v pdf-outputs:/app/outputs \
		$(DOCKER_IMAGE_NAME)

# Run Docker container with docker-compose
docker-compose-up:
	@echo "Starting services with docker-compose..."
	docker-compose up -d

# Stop Docker container
docker-stop:
	@echo "Stopping Docker container..."
	-docker stop $(DOCKER_CONTAINER_NAME)
	-docker rm $(DOCKER_CONTAINER_NAME)

# Stop docker-compose services
docker-compose-down:
	@echo "Stopping docker-compose services..."
	docker-compose down

# Clean Docker resources
docker-clean: docker-stop docker-compose-down
	@echo "Cleaning Docker volumes..."
	-docker volume rm pdf-uploads pdf-outputs

# Run tests
test:
	@echo "Running tests..."
	go test ./...

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	rm -rf bin/
	rm -rf uploads/
	rm -rf outputs/

# Install dependencies
deps:
	@echo "Installing dependencies..."
	go mod download

# Show help
help:
	@echo "Available targets:"
	@echo "  build           - Build Go binary"
	@echo "  run             - Build and run locally"
	@echo "  dev             - Run with hot reload (requires air)"
	@echo "  docker-build    - Build Docker image"
	@echo "  docker-run      - Build and run Docker container"
	@echo "  docker-compose-up - Start services with docker-compose"
	@echo "  docker-stop     - Stop Docker container"
	@echo "  docker-compose-down - Stop docker-compose services"
	@echo "  docker-clean    - Clean all Docker resources"
	@echo "  test           - Run tests"
	@echo "  clean          - Clean build artifacts"
	@echo "  deps           - Install dependencies"
	@echo "  help           - Show this help"