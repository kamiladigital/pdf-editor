package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/gorilla/mux"
	"github.com/pdfcpu/pdfcpu/pkg/api"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/model"
)

const (
	maxUploadSize = 50 * 1024 * 1024 // 50MB
	uploadPath    = "./uploads"
	outputPath    = "./outputs"
)

type DecryptRequest struct {
	Password string `json:"password"`
}

type DecryptResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	FileURL string `json:"file_url,omitempty"`
	Error   string `json:"error,omitempty"`
}

type HealthResponse struct {
	Status  string `json:"status"`
	Version string `json:"version"`
}

func main() {
	// Create necessary directories
	if err := os.MkdirAll(uploadPath, 0755); err != nil {
		log.Fatal("Failed to create upload directory:", err)
	}
	if err := os.MkdirAll(outputPath, 0755); err != nil {
		log.Fatal("Failed to create output directory:", err)
	}

	r := mux.NewRouter()

	// Health check endpoint
	r.HandleFunc("/api/health", healthHandler).Methods("GET")
	
	// PDF decryption endpoint
	r.HandleFunc("/api/pdf/decrypt", decryptPDFHandler).Methods("POST")
	
	// Serve static files (for decrypted PDFs)
	r.PathPrefix("/outputs/").Handler(http.StripPrefix("/outputs/", http.FileServer(http.Dir(outputPath))))

	// CORS middleware
	corsMiddleware := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE")
			w.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization")
			
			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}
			
			next.ServeHTTP(w, r)
		})
	}

	// Start server
	port := ":8080"
	log.Printf("Starting PDF decryption server on port %s", port)
	log.Fatal(http.ListenAndServe(port, corsMiddleware(r)))
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(HealthResponse{
		Status:  "healthy",
		Version: "1.0.0",
	})
}

func decryptPDFHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Parse multipart form
	if err := r.ParseMultipartForm(maxUploadSize); err != nil {
		json.NewEncoder(w).Encode(DecryptResponse{
			Success: false,
			Message: "Failed to parse form",
			Error:   err.Error(),
		})
		return
	}

	// Get PDF file
	file, header, err := r.FormFile("pdf")
	if err != nil {
		json.NewEncoder(w).Encode(DecryptResponse{
			Success: false,
			Message: "Failed to get PDF file",
			Error:   err.Error(),
		})
		return
	}
	defer file.Close()

	// Get password
	password := r.FormValue("password")
	if password == "" {
		json.NewEncoder(w).Encode(DecryptResponse{
			Success: false,
			Message: "Password is required",
			Error:   "no password provided",
		})
		return
	}

	// Create unique filename
	timestamp := time.Now().UnixNano()
	filename := fmt.Sprintf("%d_%s", timestamp, header.Filename)
	inputPath := filepath.Join(uploadPath, filename)
	outputFilename := fmt.Sprintf("decrypted_%s", filename)
	outputPath := filepath.Join(outputPath, outputFilename)

	// Save uploaded file
	out, err := os.Create(inputPath)
	if err != nil {
		json.NewEncoder(w).Encode(DecryptResponse{
			Success: false,
			Message: "Failed to save uploaded file",
			Error:   err.Error(),
		})
		return
	}
	defer out.Close()

	_, err = io.Copy(out, file)
	if err != nil {
		json.NewEncoder(w).Encode(DecryptResponse{
			Success: false,
			Message: "Failed to write uploaded file",
			Error:   err.Error(),
		})
		return
	}

	// Try to decrypt PDF using pdfcpu
	// Create a configuration with the password
	config := model.NewDefaultConfiguration()
	config.UserPW = password
	
	// Try to decrypt
	err = api.DecryptFile(inputPath, outputPath, config)
	if err != nil {
		// Check if error is due to wrong password or not encrypted
		errorMsg := err.Error()
		if errorMsg == "invalid password" || errorMsg == "PDF is not encrypted" {
			json.NewEncoder(w).Encode(DecryptResponse{
				Success: false,
				Message: "Failed to decrypt PDF",
				Error:   errorMsg,
			})
		} else {
			json.NewEncoder(w).Encode(DecryptResponse{
				Success: false,
				Message: "Failed to process PDF",
				Error:   errorMsg,
			})
		}
		return
	}

	// Clean up uploaded file
	os.Remove(inputPath)

	json.NewEncoder(w).Encode(DecryptResponse{
		Success: true,
		Message: "PDF decrypted successfully",
		FileURL: fmt.Sprintf("/outputs/%s", outputFilename),
	})
}