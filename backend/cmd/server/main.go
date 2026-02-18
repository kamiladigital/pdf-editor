package main

import (
	"log"
	"net/http"
	"os"

	"github.com/habibiefaried/pdf-editor/internal/handler"
	"github.com/rs/cors"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	uploadDir := os.Getenv("UPLOAD_DIR")
	if uploadDir == "" {
		uploadDir = "./uploads"
	}

	outputDir := os.Getenv("OUTPUT_DIR")
	if outputDir == "" {
		outputDir = "./outputs"
	}

	// Ensure directories exist
	os.MkdirAll(uploadDir, 0755)
	os.MkdirAll(outputDir, 0755)

	h := handler.New(uploadDir, outputDir)

	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/upload", h.UploadPDF)
	mux.HandleFunc("POST /api/process", h.ProcessPDF)
	mux.HandleFunc("GET /api/download/{id}", h.DownloadPDF)
	mux.HandleFunc("GET /api/pdf-info/{id}", h.GetPDFInfo)

	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"*"},
		AllowCredentials: true,
	})

	log.Printf("PDF Editor backend starting on port %s", port)
	log.Fatal(http.ListenAndServe(":"+port, c.Handler(mux)))
}
