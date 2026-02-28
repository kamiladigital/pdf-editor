# PDF Editor Backend

Go backend server for decrypting password-protected PDFs in the PDF Editor application.

## Overview

This backend service handles password-protected PDF decryption using the `pdfcpu` library. When the frontend detects an encrypted PDF, it sends the file and password to this backend, which decrypts it and returns the decrypted PDF for editing.

## Features

- **PDF Decryption**: Decrypts password-protected PDFs using the `pdfcpu` Go library
- **REST API**: Simple HTTP API for PDF decryption
- **CORS Support**: Configured to accept requests from the frontend
- **File Management**: Temporarily stores uploaded files in `uploads/` directory and outputs decrypted files to `outputs/` directory
- **Error Handling**: Proper error responses for wrong passwords, non-encrypted PDFs, and processing errors

## API Endpoints

### `GET /api/health`
Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0"
}
```

### `POST /api/pdf/decrypt`
Decrypts a password-protected PDF.

**Request:** Multipart form data
- `pdf`: PDF file (multipart/form-data)
- `password`: Password string

**Success Response:**
```json
{
  "success": true,
  "message": "PDF decrypted successfully",
  "file_url": "/outputs/decrypted_<timestamp>_<filename>.pdf"
}
```

**Error Responses:**
```json
{
  "success": false,
  "message": "Failed to decrypt PDF",
  "error": "invalid password"
}
```

```json
{
  "success": false,
  "message": "PDF is not encrypted",
  "error": "pdf is not password protected"
}
```

## Setup

### Prerequisites
- Go 1.21 or higher

### Installation
```bash
cd backend
go mod download
```

### Running the Server
```bash
go run cmd/server/main.go
```

The server will start on `http://localhost:8080`.

### Building
```bash
go build -o bin/pdf-decrypt-server cmd/server/main.go
```

### Running with Make
```bash
make run      # Run the server
make build    # Build binary
make clean    # Clean up binaries and temporary files
make dev      # Run with hot reload (requires air)
```

## Project Structure

```
backend/
├── cmd/
│   └── server/
│       └── main.go          # Main server application
├── go.mod                   # Go module dependencies
├── go.sum                   # Dependency checksums
├── Makefile                 # Build and run commands
└── README.md               # This file
```

## Configuration

The server creates two directories on startup:
- `uploads/`: Temporary storage for uploaded PDFs (cleaned up after processing)
- `outputs/`: Storage for decrypted PDFs (served statically at `/outputs/`)

## Integration with Frontend

The frontend is configured to use this backend via the `VITE_BACKEND_URL` environment variable (default: `http://localhost:8080`).

When a password-protected PDF is detected:
1. Frontend shows password dialog
2. User enters password
3. Frontend sends PDF + password to `/api/pdf/decrypt`
4. Backend decrypts PDF and returns download URL
5. Frontend downloads decrypted PDF and loads it for editing

## Security Considerations

1. **Temporary Files**: Uploaded files are stored temporarily and deleted after processing
2. **CORS**: Configured to allow requests from any origin (`*`) - adjust for production
3. **File Size Limit**: 50MB maximum upload size
4. **No Persistent Storage**: Decrypted files are served but not permanently stored

## Development

### Testing
```bash
# Run tests (if any)
make test

# Start development server with hot reload
make dev
```

### Dependencies
- `github.com/pdfcpu/pdfcpu`: PDF processing library
- `github.com/gorilla/mux`: HTTP router

## Deployment

For production deployment:
1. Build the binary: `make build`
2. Set appropriate CORS origins
3. Configure file cleanup (cron job to clean `outputs/` directory periodically)
4. Consider adding rate limiting
5. Add authentication if needed