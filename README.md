# PDF Editor

A web application for editing PDFs — upload a PDF, add text and images anywhere on the page, then generate and download a new PDF with those edits baked in.

## How It Works

### Overall Flow

```
[User uploads PDF] → [Backend stores file, returns ID + page count]
         ↓
[Frontend renders PDF pages using PDF.js]
         ↓
[User places text/images on the rendered pages by clicking]
         ↓
[User clicks "Generate PDF"]
         ↓
[Frontend sends overlay positions (as % of page) + text/image data to backend]
         ↓
[Backend uses pdfcpu to stamp text/images onto the original PDF as watermarks]
         ↓
[Backend returns a download URL for the new PDF]
```

### Frontend (React + Vite)

- **PDF.js** renders each page of the uploaded PDF onto an HTML `<canvas>`.
- An invisible overlay `<div>` sits on top of the canvas. When the user clicks with the "Add Text" tool active, a draggable text element is placed at that position.
- For images, a file picker (click or drag-and-drop) lets the user upload any image (PNG, JPG, GIF, WebP — up to 10 MB). The image is read as a base64 data URL and placed on the PDF as a draggable, resizable element.
- All element positions are stored as **percentages of the page dimensions** (0–100%), so they stay consistent regardless of zoom or display size.
- When the user clicks "Generate PDF," the frontend sends the overlay data (text content, font size, color, position %; image data, position %, size %) to the backend.

### Backend (Go)

- Receives the uploaded PDF and stores it in `./uploads/` with a UUID filename.
- Uses **pdfcpu** (a pure-Go PDF library) to read page count and dimensions.
- When processing, it copies the original PDF to `./outputs/` and applies each overlay as a **pdfcpu watermark/stamp**:
  - Text overlays become text watermarks (Helvetica font, configurable size/color).
  - Image overlays are decoded from base64 to temp files (PNG/JPG/GIF/WebP auto-detected), then applied as image watermarks.
- Percentage coordinates from the frontend are converted to absolute PDF points using the page dimensions.
- The Y-axis is flipped (frontend uses top-left origin; PDF uses bottom-left origin).
- The processed PDF is served for download via a simple file-serve endpoint.

## Prerequisites

- **Go** >= 1.23
- **Node.js** >= 18

## Development Setup

### 1. Start the Backend

```bash
cd backend
make dev
```

This runs `go run ./cmd/server`, which:
- Creates `./uploads/` and `./outputs/` directories
- Starts an HTTP server on **port 8080**

Environment variables (optional):
| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | Backend listen port |
| `UPLOAD_DIR` | `./uploads` | Where uploaded PDFs are stored |
| `OUTPUT_DIR` | `./outputs` | Where processed PDFs are saved |

### 2. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

This starts Vite dev server on **http://localhost:5173**.

### Configuring the Backend URL

The frontend uses a **relative path** (`/api`) for all API calls. During development, Vite proxies these to the backend. The proxy target is set in `frontend/vite.config.js`:

```js
server: {
  proxy: {
    "/api": {
      target: "http://localhost:8080",  // ← change this to point to your backend
      changeOrigin: true,
    },
  },
},
```

For production, you'd typically put both behind a reverse proxy (e.g., nginx) so `/api` routes to the Go backend and everything else serves the built frontend from `frontend/dist/`.

### 3. Build for Production

```bash
# Frontend
cd frontend && npm run build    # outputs to frontend/dist/

# Backend
cd backend && make build        # outputs to backend/bin/server
```

## Project Structure

```
pdf-editor/
├── backend/
│   ├── cmd/server/main.go          # Entry point, routes, CORS
│   ├── internal/
│   │   ├── handler/handler.go      # HTTP handlers (upload, process, download)
│   │   └── pdfutil/pdfutil.go      # PDF manipulation (pdfcpu watermarks)
│   ├── go.mod
│   ├── Makefile
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.jsx                 # Main app state & logic
│   │   ├── components/
│   │   │   ├── PDFUploader.jsx     # Drag-and-drop upload area
│   │   │   ├── PDFViewer.jsx       # PDF.js canvas + overlay layer
│   │   │   ├── Sidebar.jsx         # Tools, properties, element list
│   │   │   └── ImageUploader.jsx   # Image file picker (click or drag-drop)
│   │   ├── index.css
│   │   └── main.jsx
│   ├── vite.config.js              # Vite config with API proxy
│   └── package.json
├── scripts/
│   └── test_e2e.py                # End-to-end backend test
└── README.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload` | Upload a PDF file (multipart form, field: `pdf`) |
| GET | `/api/pdf-info/{id}` | Get page count and dimensions |
| POST | `/api/process` | Apply text/image overlays and generate output |
| GET | `/api/download/{id}` | Download the processed PDF |

### Process Request Body

```json
{
  "id": "upload-uuid",
  "texts": [
    {
      "text": "Hello World",
      "x": 10,
      "y": 15,
      "page": 1,
      "fontSize": 14,
      "color": "#000000"
    }
  ],
  "images": [
    {
      "imageData": "data:image/png;base64,...",
      "x": 50,
      "y": 80,
      "width": 20,
      "height": 10,
      "page": 1
    }
  ]
}
```

Coordinates (`x`, `y`, `width`, `height`) are **percentages of page dimensions** (0–100). The backend converts these to absolute PDF points using the actual page size from pdfcpu.

## Testing

An end-to-end test script is included in `scripts/test_e2e.py`. It creates a minimal PDF and a test PNG, exercises all four API endpoints, and verifies the output.

```bash
# Make sure the backend is running first
cd backend && make dev &

# Run the test
python3 scripts/test_e2e.py
```

You can override the backend URL via an environment variable:

```bash
BACKEND_URL=http://localhost:9090 python3 scripts/test_e2e.py
```
