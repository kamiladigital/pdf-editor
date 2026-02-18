package pdfutil

import (
	"encoding/base64"
	"fmt"
	"os"
	"strings"

	"github.com/pdfcpu/pdfcpu/pkg/api"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/types"
)

// TextOverlay represents text to place on a PDF page
type TextOverlay struct {
	Text     string  `json:"text"`
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
	Page     int     `json:"page"`
	FontSize float64 `json:"fontSize"`
	Color    string  `json:"color"`
}

// ImageOverlay represents an image to place on a PDF page
type ImageOverlay struct {
	ImageData string  `json:"imageData"`
	X         float64 `json:"x"`
	Y         float64 `json:"y"`
	Width     float64 `json:"width"`
	Height    float64 `json:"height"`
	Page      int     `json:"page"`
}

// PDFInfo contains information about a PDF document
type PDFInfo struct {
	Pages       int       `json:"pages"`
	PageWidths  []float64 `json:"pageWidths"`
	PageHeights []float64 `json:"pageHeights"`
}

// GetPageCount returns the number of pages in a PDF file
func GetPageCount(path string) (int, error) {
	ctx, err := api.ReadContextFile(path)
	if err != nil {
		return 0, fmt.Errorf("failed to read PDF: %w", err)
	}

	if err := ctx.EnsurePageCount(); err != nil {
		return 0, fmt.Errorf("failed to get page count: %w", err)
	}

	return ctx.PageCount, nil
}

// GetPDFInfo returns page count and dimensions for each page
func GetPDFInfo(path string) (*PDFInfo, error) {
	ctx, err := api.ReadContextFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read PDF: %w", err)
	}

	if err := ctx.EnsurePageCount(); err != nil {
		return nil, fmt.Errorf("failed to get page count: %w", err)
	}

	info := &PDFInfo{
		Pages:       ctx.PageCount,
		PageWidths:  make([]float64, ctx.PageCount),
		PageHeights: make([]float64, ctx.PageCount),
	}

	dims, err := ctx.PageDims()
	if err != nil {
		// Default all pages to A4
		for i := 0; i < ctx.PageCount; i++ {
			info.PageWidths[i] = 595.0
			info.PageHeights[i] = 842.0
		}
	} else {
		for i, d := range dims {
			if i >= ctx.PageCount {
				break
			}
			info.PageWidths[i] = d.Width
			info.PageHeights[i] = d.Height
		}
	}

	return info, nil
}

// ProcessPDF creates a new PDF with text and image overlays applied
func ProcessPDF(inputPath, outputPath string, texts []TextOverlay, images []ImageOverlay) error {
	info, err := GetPDFInfo(inputPath)
	if err != nil {
		return fmt.Errorf("failed to get PDF info: %w", err)
	}

	// Copy input to output
	inputData, err := os.ReadFile(inputPath)
	if err != nil {
		return fmt.Errorf("failed to read input PDF: %w", err)
	}
	if err := os.WriteFile(outputPath, inputData, 0644); err != nil {
		return fmt.Errorf("failed to write output PDF: %w", err)
	}

	// Add text overlays
	for _, t := range texts {
		if err := addTextOverlay(outputPath, t, info); err != nil {
			return fmt.Errorf("failed to add text overlay: %w", err)
		}
	}

	// Add image overlays
	for i, img := range images {
		if err := addImageOverlay(outputPath, img, info, i); err != nil {
			return fmt.Errorf("failed to add image overlay: %w", err)
		}
	}

	return nil
}

func addTextOverlay(pdfPath string, t TextOverlay, info *PDFInfo) error {
	if t.Page < 1 || t.Page > info.Pages {
		return fmt.Errorf("invalid page number: %d", t.Page)
	}

	pageWidth := info.PageWidths[t.Page-1]
	pageHeight := info.PageHeights[t.Page-1]

	// Frontend sends coordinates as percentage of page dimensions
	absX := t.X / 100.0 * pageWidth
	absY := t.Y / 100.0 * pageHeight

	fontSize := t.FontSize
	if fontSize == 0 {
		fontSize = 12
	}

	color := t.Color
	if color == "" {
		color = "#000000"
	}

	// Convert from top-left Y (frontend) to bottom-left Y (PDF coordinate system)
	bottomY := pageHeight - absY

	desc := fmt.Sprintf("font:Helvetica, points:%d, color:%s, pos:bl, off:%.1f %.1f, scale:1 abs, rot:0, opacity:1.0",
		int(fontSize), color, absX, bottomY)

	pages := []string{fmt.Sprintf("%d", t.Page)}

	wm, err := api.TextWatermark(t.Text, desc, true, false, types.POINTS)
	if err != nil {
		return fmt.Errorf("failed to create text watermark: %w", err)
	}

	if err := api.AddWatermarksFile(pdfPath, pdfPath, pages, wm, nil); err != nil {
		return fmt.Errorf("failed to add text watermark: %w", err)
	}

	return nil
}

func addImageOverlay(pdfPath string, img ImageOverlay, info *PDFInfo, index int) error {
	if img.Page < 1 || img.Page > info.Pages {
		return fmt.Errorf("invalid page number: %d", img.Page)
	}

	// Decode base64 image
	imgData, ext, err := decodeBase64Image(img.ImageData)
	if err != nil {
		return fmt.Errorf("failed to decode image: %w", err)
	}

	tmpFile := fmt.Sprintf("/tmp/pdf_editor_img_%d%s", index, ext)
	if err := os.WriteFile(tmpFile, imgData, 0644); err != nil {
		return fmt.Errorf("failed to write temp image: %w", err)
	}
	defer os.Remove(tmpFile)

	pageWidth := info.PageWidths[img.Page-1]
	pageHeight := info.PageHeights[img.Page-1]

	absX := img.X / 100.0 * pageWidth
	absY := img.Y / 100.0 * pageHeight

	// Convert from top-left Y to bottom-left Y
	bottomY := pageHeight - absY

	// Use relative scale: img.Width is percentage of page width (0-100)
	// pdfcpu rel scale is 0.0-1.0 fraction of page width
	relScale := img.Width / 100.0
	if relScale <= 0 {
		relScale = 0.2
	}
	if relScale > 1.0 {
		relScale = 1.0
	}

	desc := fmt.Sprintf("pos:bl, off:%.1f %.1f, scale:%.4f rel, rot:0, opacity:1.0",
		absX, bottomY, relScale)

	pages := []string{fmt.Sprintf("%d", img.Page)}

	wm, err := api.ImageWatermark(tmpFile, desc, true, false, types.POINTS)
	if err != nil {
		return fmt.Errorf("failed to create image watermark: %w", err)
	}

	if err := api.AddWatermarksFile(pdfPath, pdfPath, pages, wm, nil); err != nil {
		return fmt.Errorf("failed to add image watermark: %w", err)
	}

	return nil
}

func decodeBase64Image(dataURL string) ([]byte, string, error) {
	parts := strings.SplitN(dataURL, ",", 2)
	var b64Data string
	ext := ".png" // default extension
	if len(parts) == 2 {
		b64Data = parts[1]
		// Detect image type from data URL header
		header := strings.ToLower(parts[0])
		if strings.Contains(header, "image/jpeg") || strings.Contains(header, "image/jpg") {
			ext = ".jpg"
		} else if strings.Contains(header, "image/webp") {
			ext = ".webp"
		} else if strings.Contains(header, "image/gif") {
			ext = ".gif"
		}
	} else {
		b64Data = dataURL
	}
	data, err := base64.StdEncoding.DecodeString(b64Data)
	return data, ext, err
}
