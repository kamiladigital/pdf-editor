import React, { useRef, useEffect, useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url
).toString();

export default function PDFViewer({
  file,
  currentPage,
  setCurrentPage,
  totalPages,
  overlays,
  selectedOverlay,
  setSelectedOverlay,
  onCanvasClick,
  onMoveOverlay,
  onDeleteOverlay,
  activeTool,
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageRendering, setPageRendering] = useState(false);
  const [canvasDims, setCanvasDims] = useState({ width: 0, height: 0 });
  const [dragging, setDragging] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Load PDF document
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    pdfjsLib.getDocument(url).promise.then((doc) => {
      setPdfDoc(doc);
    });
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Render current page
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    setPageRendering(true);
    pdfDoc.getPage(currentPage).then((page) => {
      const scale = 1.5;
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      canvas.height = viewport.height;
      canvas.width = viewport.width;
      setCanvasDims({ width: viewport.width, height: viewport.height });

      page.render({ canvasContext: ctx, viewport }).promise.then(() => {
        setPageRendering(false);
      });
    });
  }, [pdfDoc, currentPage]);

  const handleOverlayClick = useCallback(
    (e) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
      const yPercent = ((e.clientY - rect.top) / rect.height) * 100;

      if (activeTool) {
        onCanvasClick(xPercent, yPercent);
      } else {
        setSelectedOverlay(null);
      }
    },
    [activeTool, onCanvasClick, setSelectedOverlay]
  );

  const handleMouseDown = useCallback(
    (e, overlayId) => {
      e.stopPropagation();
      setSelectedOverlay(overlayId);

      const rect = containerRef.current.getBoundingClientRect();
      const overlay = overlays.find((o) => o.id === overlayId);
      if (!overlay) return;

      const overlayXPx = (overlay.x / 100) * rect.width;
      const overlayYPx = (overlay.y / 100) * rect.height;

      setDragOffset({
        x: e.clientX - rect.left - overlayXPx,
        y: e.clientY - rect.top - overlayYPx,
      });
      setDragging(overlayId);
    },
    [overlays, setSelectedOverlay]
  );

  const handleMouseMove = useCallback(
    (e) => {
      if (!dragging || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const xPercent =
        ((e.clientX - rect.left - dragOffset.x) / rect.width) * 100;
      const yPercent =
        ((e.clientY - rect.top - dragOffset.y) / rect.height) * 100;

      const clampedX = Math.max(0, Math.min(95, xPercent));
      const clampedY = Math.max(0, Math.min(95, yPercent));

      onMoveOverlay(dragging, clampedX, clampedY);
    },
    [dragging, dragOffset, onMoveOverlay]
  );

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  useEffect(() => {
    if (dragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [dragging, handleMouseMove, handleMouseUp]);

  return (
    <div className="pdf-viewer-container">
      <div className="pdf-viewer-header">
        <div className="page-nav">
          <button
            className="btn btn-sm"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
          >
            ◀ Prev
          </button>
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <button
            className="btn btn-sm"
            onClick={() =>
              setCurrentPage(Math.min(totalPages, currentPage + 1))
            }
            disabled={currentPage >= totalPages}
          >
            Next ▶
          </button>
        </div>
        {activeTool && (
          <span style={{ fontSize: 13, color: "#4a90d9" }}>
            🎯 Click on the page to place {activeTool}
          </span>
        )}
      </div>

      <div className="pdf-canvas-wrapper">
        {pageRendering && (
          <div className="loading">
            <span className="spinner"></span>Rendering...
          </div>
        )}
        <div
          className="pdf-page-container"
          ref={containerRef}
          style={{
            width: canvasDims.width,
            height: canvasDims.height,
            display: pageRendering ? "none" : "block",
          }}
        >
          <canvas ref={canvasRef} />
          <div className="overlay-layer" onClick={handleOverlayClick}>
            {overlays.map((overlay) => (
              <OverlayElement
                key={overlay.id}
                overlay={overlay}
                isSelected={selectedOverlay === overlay.id}
                onMouseDown={(e) => handleMouseDown(e, overlay.id)}
                onDelete={() => onDeleteOverlay(overlay.id)}
                containerWidth={canvasDims.width}
                containerHeight={canvasDims.height}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function OverlayElement({
  overlay,
  isSelected,
  onMouseDown,
  onDelete,
  containerWidth,
  containerHeight,
}) {
  const style = {
    left: `${overlay.x}%`,
    top: `${overlay.y}%`,
  };

  if (overlay.type === "text") {
    return (
      <div
        className={`overlay-element overlay-text ${isSelected ? "selected" : ""}`}
        style={{
          ...style,
          fontSize: `${overlay.fontSize}px`,
          color: overlay.color || "#000000",
        }}
        onMouseDown={onMouseDown}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="delete-btn" onClick={onDelete}>
          ×
        </button>
        {overlay.text}
      </div>
    );
  }

  if (overlay.type === "image") {
    const widthPx = (overlay.width / 100) * containerWidth;
    return (
      <div
        className={`overlay-element overlay-image ${isSelected ? "selected" : ""}`}
        style={style}
        onMouseDown={onMouseDown}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="delete-btn" onClick={onDelete}>
          ×
        </button>
        <img
          src={overlay.imageData}
          alt={overlay.fileName || "Image"}
          style={{ width: `${widthPx}px`, height: "auto" }}
        />
      </div>
    );
  }

  return null;
}
