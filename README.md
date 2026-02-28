# PDF Editor

A web application for editing PDFs — upload a PDF, add text and images anywhere on the page, then generate and download a new PDF with those edits baked in. Supports **password-protected PDFs** via a Go backend.

## Architecture Overview

The application uses a hybrid architecture:
- **Frontend**: React application for PDF rendering and editing (client-side)
- **Backend**: Go server for decrypting password-protected PDFs (server-side)
- **PDF Editing**: All PDF editing (adding text/images) happens client-side using pdf-lib
- **PDF Decryption**: Password-protected PDFs are sent to the Go backend for decryption

### Overall Flow

```
[User opens the app in the browser]
         ↓
[User uploads a PDF file]
         ↓
[If PDF is encrypted → password dialog appears]
         ↓
[Encrypted PDF + password sent to Go backend]
         ↓
[Backend decrypts PDF using pdfcpu library]
         ↓
[Decrypted PDF returned to frontend]
         ↓
[PDF.js renders each page onto an HTML canvas]
         ↓
[User places text and images on pages by clicking / dragging]
         ↓
[User clicks "Generate PDF"]
         ↓
[pdf-lib loads the decrypted PDF bytes, embeds text + images at exact positions]
         ↓
[Browser creates a blob URL → user downloads the new PDF directly]
```

### How It Works Under the Hood

- **PDF.js** renders each page of the uploaded PDF onto an HTML `<canvas>`.
- An invisible overlay `<div>` sits on top of the canvas. When the user clicks with the "Add Text" tool active, a draggable text element is placed at that position.
- For images, a file picker (click or drag-and-drop) lets the user upload any image (PNG, JPG, GIF, WebP — up to 10 MB). Images are normalized to PNG via an HTML canvas before embedding.
- All element positions are stored as **percentages of the page dimensions** (0–100%), so they stay consistent regardless of zoom or display size.
- When the user clicks "Generate PDF," **pdf-lib** loads the original PDF bytes client-side, draws text (Helvetica font, configurable size/color) and embeds images at the exact positions the user placed them, then saves the result as a downloadable blob.
- Coordinate conversion: positions are stored as % of page size. pdf-lib uses bottom-left origin, so `pdfY = pageHeight - topY - elementHeight`.
- **Password-protected PDFs**: When a password-protected PDF is detected, it's sent to the Go backend along with the password. The backend uses the `pdfcpu` library to decrypt the PDF and returns the decrypted version to the frontend.

## Prerequisites

- **Node.js** >= 18 (for frontend)
- **Go** >= 1.21 (for backend, optional - only needed for password-protected PDFs)

## Development Setup

### Frontend Only (No Password-Protected PDF Support)

If you only need to edit non-password-protected PDFs, you can run just the frontend:

```bash
cd frontend
npm install
npm run dev
```

This starts Vite dev server on **http://localhost:5173**.

### Full Setup (With Password-Protected PDF Support)

For full functionality including password-protected PDF decryption:

1. **Start the Go backend**:
   ```bash
   cd backend
   go mod download
   go run cmd/server/main.go
   ```
   The backend will start on **http://localhost:8080**

2. **Start the frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   The frontend will start on **http://localhost:5173**

3. **Configure environment variable** (optional):
   Create a `.env` file in the `frontend` directory:
   ```
   VITE_BACKEND_URL=http://localhost:8080
   ```
   Or set it when starting the dev server:
   ```bash
   VITE_BACKEND_URL=http://localhost:8080 npm run dev
   ```

### Build for Production

```bash
cd frontend
npm run build    # outputs to frontend/dist/
```

Deploy the contents of `frontend/dist/` to any static hosting (Netlify, Vercel, Cloudflare Pages, S3, GitHub Pages, etc.).

## Project Structure

```
pdf-editor/
├── backend/
│   ├── cmd/
│   │   └── server/
│   │       └── main.go            # Go backend server for PDF decryption
│   ├── go.mod                     # Go module dependencies
│   ├── go.sum                     # Go dependency checksums
│   └── Makefile                  # Build and run commands
├── frontend/
│   ├── src/
│   │   ├── App.jsx               # Main app state & logic with backend integration
│   │   ├── pdfGenerator.js       # pdf-lib: embed text + images into PDF
│   │   ├── components/
│   │   │   ├── PDFUploader.jsx    # Drag-and-drop PDF upload area
│   │   │   ├── PDFViewer.jsx     # PDF.js canvas + overlay layer
│   │   │   ├── Sidebar.jsx       # Tools, properties, element list
│   │   │   └── ImageUploader.jsx # Image file picker (click or drag-drop)
│   │   ├── index.css
│   │   └── main.jsx
│   ├── vite.config.js
│   └── package.json
└── README.md
```

## Backend API

The Go backend provides a single endpoint for PDF decryption:

### `POST /api/pdf/decrypt`

**Request**: Multipart form data with:
- `pdf`: The password-protected PDF file
- `password`: The password to decrypt the PDF

**Response**:
```json
{
  "success": true,
  "message": "PDF decrypted successfully",
  "file_url": "/outputs/decrypted_filename.pdf"
}
```

**Error Response**:
```json
{
  "success": false,
  "message": "Failed to decrypt PDF",
  "error": "wrong password"
}
```

## Security Considerations

1. **Local Processing**: For non-password-protected PDFs, all processing happens client-side in the browser.
2. **Password-Protected PDFs**: Encrypted PDFs are sent to the backend for decryption. The decrypted PDF is returned to the frontend for editing.
3. **Temporary Files**: Backend stores uploaded files temporarily in `uploads/` directory and outputs decrypted files to `outputs/` directory. These are cleaned up after processing.
4. **CORS**: Backend is configured with CORS headers to allow requests from the frontend.

## How Coordinates Work

All overlay positions (`x`, `y`, `width`, `height`) are **percentages of page dimensions** (0–100).

- Frontend stores positions as **% from top-left** of the page.
- pdf-lib uses **bottom-left origin**, so the conversion is:
  - `pdfX = (x / 100) * pageWidth`
  - `pdfY = pageHeight - (y / 100) * pageHeight - drawHeight`
- This means what you see on screen is exactly what ends up in the PDF.
