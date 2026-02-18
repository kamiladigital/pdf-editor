package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/google/uuid"
	"github.com/habibiefaried/pdf-editor/internal/pdfutil"
)

type Handler struct {
	uploadDir string
	outputDir string
}

func New(uploadDir, outputDir string) *Handler {
	return &Handler{
		uploadDir: uploadDir,
		outputDir: outputDir,
	}
}

type UploadResponse struct {
	ID       string `json:"id"`
	Filename string `json:"filename"`
	Pages    int    `json:"pages"`
}

type ProcessRequest struct {
	ID     string                 `json:"id"`
	Texts  []pdfutil.TextOverlay  `json:"texts"`
	Images []pdfutil.ImageOverlay `json:"images"`
}

type ProcessResponse struct {
	DownloadURL string `json:"downloadUrl"`
	ID          string `json:"id"`
}

type ErrorResponse struct {
	Error string `json:"error"`
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, ErrorResponse{Error: msg})
}

// UploadPDF handles PDF file upload
func (h *Handler) UploadPDF(w http.ResponseWriter, r *http.Request) {
	r.ParseMultipartForm(50 << 20)

	file, fileHeader, err := r.FormFile("pdf")
	if err != nil {
		writeError(w, http.StatusBadRequest, "No PDF file provided")
		return
	}
	defer file.Close()

	if filepath.Ext(fileHeader.Filename) != ".pdf" {
		writeError(w, http.StatusBadRequest, "Only PDF files are allowed")
		return
	}

	id := uuid.New().String()
	uploadPath := filepath.Join(h.uploadDir, id+".pdf")

	dst, err := os.Create(uploadPath)
	if err != nil {
		log.Printf("Error creating file: %v", err)
		writeError(w, http.StatusInternalServerError, "Failed to save file")
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		log.Printf("Error copying file: %v", err)
		writeError(w, http.StatusInternalServerError, "Failed to save file")
		return
	}

	pages, err := pdfutil.GetPageCount(uploadPath)
	if err != nil {
		log.Printf("Error reading PDF: %v", err)
		writeError(w, http.StatusBadRequest, "Invalid PDF file")
		return
	}

	writeJSON(w, http.StatusOK, UploadResponse{
		ID:       id,
		Filename: fileHeader.Filename,
		Pages:    pages,
	})
}

// GetPDFInfo returns PDF page dimensions
func (h *Handler) GetPDFInfo(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	uploadPath := filepath.Join(h.uploadDir, id+".pdf")

	if _, err := os.Stat(uploadPath); os.IsNotExist(err) {
		writeError(w, http.StatusNotFound, "PDF not found")
		return
	}

	info, err := pdfutil.GetPDFInfo(uploadPath)
	if err != nil {
		log.Printf("Error getting PDF info: %v", err)
		writeError(w, http.StatusInternalServerError, "Failed to read PDF info")
		return
	}

	writeJSON(w, http.StatusOK, info)
}

// ProcessPDF applies text and signature overlays to the PDF
func (h *Handler) ProcessPDF(w http.ResponseWriter, r *http.Request) {
	var req ProcessRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	uploadPath := filepath.Join(h.uploadDir, req.ID+".pdf")
	if _, err := os.Stat(uploadPath); os.IsNotExist(err) {
		writeError(w, http.StatusNotFound, "PDF not found. Please upload first.")
		return
	}

	outputID := uuid.New().String()
	outputPath := filepath.Join(h.outputDir, outputID+".pdf")

	err := pdfutil.ProcessPDF(uploadPath, outputPath, req.Texts, req.Images)
	if err != nil {
		log.Printf("Error processing PDF: %v", err)
		writeError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to process PDF: %v", err))
		return
	}

	writeJSON(w, http.StatusOK, ProcessResponse{
		DownloadURL: fmt.Sprintf("/api/download/%s", outputID),
		ID:          outputID,
	})
}

// DownloadPDF serves the processed PDF for download
func (h *Handler) DownloadPDF(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	outputPath := filepath.Join(h.outputDir, id+".pdf")

	if _, err := os.Stat(outputPath); os.IsNotExist(err) {
		writeError(w, http.StatusNotFound, "File not found")
		return
	}

	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"edited-%s.pdf\"", id[:8]))
	http.ServeFile(w, r, outputPath)
}
