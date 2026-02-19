# PDF Editor

A web application for editing PDFs — upload a PDF, add text and images anywhere on the page, then generate and download a new PDF with those edits baked in. **All PDF processing happens client-side in the browser** using [pdf-lib](https://pdf-lib.js.org/) — no backend required.

## How It Works

### Overall Flow

```
[User opens the app in the browser]
         ↓
[User uploads a PDF file (stays in browser, never leaves the machine)]
         ↓
[PDF.js renders each page onto an HTML canvas]
         ↓
[User places text and images on pages by clicking / dragging]
         ↓
[User clicks "Generate PDF"]
         ↓
[pdf-lib loads the original PDF bytes, embeds text + images at exact positions]
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

## Prerequisites

- **Node.js** >= 18

## Development Setup

```bash
cd frontend
npm install
npm run dev
```

This starts Vite dev server on **http://localhost:5173**. That's it — everything runs in the browser.

### Build for Production

```bash
cd frontend
npm run build    # outputs to frontend/dist/
```

Deploy the contents of `frontend/dist/` to any static hosting (Netlify, Vercel, Cloudflare Pages, S3, GitHub Pages, etc.).

## Project Structure

```
pdf-editor/
├── frontend/
│   ├── src/
│   │   ├── App.jsx                 # Main app state & logic
│   │   ├── pdfGenerator.js         # pdf-lib: embed text + images into PDF
│   │   ├── components/
│   │   │   ├── PDFUploader.jsx     # Drag-and-drop PDF upload area
│   │   │   ├── PDFViewer.jsx       # PDF.js canvas + overlay layer
│   │   │   ├── Sidebar.jsx         # Tools, properties, element list
│   │   │   └── ImageUploader.jsx   # Image file picker (click or drag-drop)
│   │   ├── index.css
│   │   └── main.jsx
│   ├── vite.config.js
│   └── package.json
└── README.md
```

## How Coordinates Work

All overlay positions (`x`, `y`, `width`, `height`) are **percentages of page dimensions** (0–100).

- Frontend stores positions as **% from top-left** of the page.
- pdf-lib uses **bottom-left origin**, so the conversion is:
  - `pdfX = (x / 100) * pageWidth`
  - `pdfY = pageHeight - (y / 100) * pageHeight - drawHeight`
- This means what you see on screen is exactly what ends up in the PDF.
