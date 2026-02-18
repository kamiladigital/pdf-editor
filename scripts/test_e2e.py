#!/usr/bin/env python3
"""
End-to-end test for the PDF Editor backend.
Requires the backend to be running on http://localhost:8080.

Usage:
    cd pdf-editor
    python3 scripts/test_e2e.py
"""

import urllib.request
import json
import base64
import struct
import zlib
import subprocess
import os
import sys
import tempfile

BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8080")

def create_test_pdf(path):
    """Create a minimal valid single-page PDF."""
    pdf = b"""%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj
xref
0 4
0000000000 65535 f 
0000000010 00000 n 
0000000059 00000 n 
0000000112 00000 n 
trailer<</Size 4/Root 1 0 R>>
startxref
204
%%EOF"""
    with open(path, "wb") as f:
        f.write(pdf)

def create_test_png():
    """Create a 50x50 red square PNG and return as base64 data URL."""
    width, height = 50, 50
    raw = b""
    for y in range(height):
        raw += b"\x00"
        for x in range(width):
            raw += b"\xff\x00\x00\xff"
    compressed = zlib.compress(raw)

    def chunk(ctype, data):
        c = ctype + data
        return (
            struct.pack(">I", len(data))
            + c
            + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)
        )

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", compressed)
    png += chunk(b"IEND", b"")
    return "data:image/png;base64," + base64.b64encode(png).decode()

def test_upload(pdf_path):
    """Upload a PDF and return the response."""
    result = subprocess.run(
        ["curl", "-s", "-F", f"pdf=@{pdf_path}", f"{BACKEND_URL}/api/upload"],
        capture_output=True,
        text=True,
    )
    data = json.loads(result.stdout)
    print(f"[UPLOAD] id={data['id']} filename={data['filename']} pages={data['pages']}")
    assert data["pages"] >= 1, "Expected at least 1 page"
    return data

def test_pdf_info(pdf_id):
    """Get PDF info and return the response."""
    req = urllib.request.Request(f"{BACKEND_URL}/api/pdf-info/{pdf_id}")
    resp = urllib.request.urlopen(req)
    data = json.loads(resp.read())
    print(f"[PDF-INFO] pages={data['pages']} widths={data['pageWidths']} heights={data['pageHeights']}")
    assert data["pages"] >= 1
    return data

def test_process(pdf_id, img_data):
    """Process PDF with text + image overlays."""
    payload = json.dumps({
        "id": pdf_id,
        "texts": [
            {
                "text": "Hello from PDF Editor!",
                "x": 10,
                "y": 10,
                "page": 1,
                "fontSize": 16,
                "color": "#000000",
            }
        ],
        "images": [
            {
                "imageData": img_data,
                "x": 50,
                "y": 50,
                "width": 20,
                "height": 10,
                "page": 1,
            }
        ],
    }).encode()

    req = urllib.request.Request(
        f"{BACKEND_URL}/api/process",
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    resp = urllib.request.urlopen(req)
    data = json.loads(resp.read())
    print(f"[PROCESS] downloadUrl={data['downloadUrl']} id={data['id']}")
    assert "downloadUrl" in data
    return data

def test_download(download_url, output_path):
    """Download the processed PDF and verify it's valid."""
    urllib.request.urlretrieve(f"{BACKEND_URL}{download_url}", output_path)
    file_info = subprocess.check_output(["file", output_path]).decode().strip()
    file_size = os.path.getsize(output_path)
    print(f"[DOWNLOAD] {file_info}")
    print(f"[DOWNLOAD] size={file_size} bytes")
    assert "PDF" in file_info, "Downloaded file is not a PDF"
    assert file_size > 0, "Downloaded file is empty"

def main():
    print(f"Testing PDF Editor backend at {BACKEND_URL}\n")

    with tempfile.TemporaryDirectory() as tmpdir:
        pdf_path = os.path.join(tmpdir, "test.pdf")
        output_path = os.path.join(tmpdir, "result.pdf")

        # Create test fixtures
        create_test_pdf(pdf_path)
        img_data = create_test_png()

        # Run tests
        upload = test_upload(pdf_path)
        test_pdf_info(upload["id"])
        process = test_process(upload["id"], img_data)
        test_download(process["downloadUrl"], output_path)

    print("\n✅ All tests passed!")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n❌ Test failed: {e}", file=sys.stderr)
        sys.exit(1)
