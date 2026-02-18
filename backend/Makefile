.PHONY: build run clean tidy

build: tidy
	go build -o bin/server ./cmd/server

run: build
	./bin/server

tidy:
	go mod tidy

clean:
	rm -rf bin/ uploads/ outputs/

dev:
	go run ./cmd/server
