import React, { useState } from "react";
import ImageUploader from "./ImageUploader";

export default function Sidebar({
  activeTool,
  setActiveTool,
  overlays,
  currentPage,
  selectedOverlay,
  setSelectedOverlay,
  onUpdateOverlay,
  onDeleteOverlay,
  onAddImage,
  onProcess,
  onReset,
  processing,
  downloadUrl,
}) {
  const [showImageUploader, setShowImageUploader] = useState(false);
  const selected = overlays.find((o) => o.id === selectedOverlay);

  return (
    <>
      {/* Tools Panel */}
      <div className="panel">
        <h3>Tools</h3>
        <div className="toolbar">
          <button
            className={`btn ${activeTool === "text" ? "btn-active" : ""}`}
            onClick={() =>
              setActiveTool(activeTool === "text" ? null : "text")
            }
          >
            ✏️ Add Text
          </button>
          <button
            className={`btn ${showImageUploader ? "btn-active" : ""}`}
            onClick={() => setShowImageUploader(!showImageUploader)}
          >
            🖼️ Add Image
          </button>
        </div>

        {activeTool === "text" && (
          <p style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
            Click anywhere on the PDF to place text
          </p>
        )}

        {showImageUploader && (
          <ImageUploader
            onUpload={(dataUrl, fileName) => {
              onAddImage(dataUrl, fileName);
              setShowImageUploader(false);
            }}
            onCancel={() => setShowImageUploader(false)}
          />
        )}
      </div>

      {/* Properties Panel */}
      {selected && (
        <div className="panel">
          <h3>Properties</h3>
          {selected.type === "text" && (
            <>
              <div className="form-group">
                <label>Text</label>
                <textarea
                  rows={3}
                  value={selected.text}
                  onChange={(e) =>
                    onUpdateOverlay(selected.id, { text: e.target.value })
                  }
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Font Size</label>
                  <input
                    type="number"
                    min={8}
                    max={72}
                    value={selected.fontSize}
                    onChange={(e) =>
                      onUpdateOverlay(selected.id, {
                        fontSize: parseInt(e.target.value) || 14,
                      })
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Color</label>
                  <input
                    type="color"
                    value={selected.color || "#000000"}
                    onChange={(e) =>
                      onUpdateOverlay(selected.id, { color: e.target.value })
                    }
                  />
                </div>
              </div>
            </>
          )}
          {selected.type === "image" && (
            <>
              <div className="form-group">
                <label>Width (%)</label>
                <input
                  type="range"
                  min={5}
                  max={80}
                  value={selected.width}
                  onChange={(e) =>
                    onUpdateOverlay(selected.id, {
                      width: parseInt(e.target.value),
                    })
                  }
                />
                <span style={{ fontSize: 12, color: "#888" }}>
                  {selected.width}%
                </span>
              </div>
              <div className="form-group">
                <label>Height (%)</label>
                <input
                  type="range"
                  min={5}
                  max={80}
                  value={selected.height}
                  onChange={(e) =>
                    onUpdateOverlay(selected.id, {
                      height: parseInt(e.target.value),
                    })
                  }
                />
                <span style={{ fontSize: 12, color: "#888" }}>
                  {selected.height}%
                </span>
              </div>
            </>
          )}
          <button
            className="btn btn-danger btn-sm"
            style={{ marginTop: 8 }}
            onClick={() => onDeleteOverlay(selected.id)}
          >
            🗑️ Delete
          </button>
        </div>
      )}

      {/* Overlays List */}
      <div className="panel">
        <h3>
          Elements on Page {currentPage} ({overlays.filter((o) => o.page === currentPage).length})
        </h3>
        <div className="overlay-list">
          {overlays
            .filter((o) => o.page === currentPage)
            .map((o) => (
              <div
                key={o.id}
                className="overlay-item"
                onClick={() => setSelectedOverlay(o.id)}
                style={{
                  background:
                    selectedOverlay === o.id ? "#e8f0fe" : undefined,
                }}
              >
                <span>
                  <span
                    className={`type-badge ${o.type}`}
                  >
                    {o.type}
                  </span>{" "}
                  {o.type === "text" ? o.text.substring(0, 20) : o.fileName || "Image"}
                </span>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteOverlay(o.id);
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          {overlays.filter((o) => o.page === currentPage).length === 0 && (
            <p style={{ fontSize: 12, color: "#aaa", textAlign: "center", padding: 10 }}>
              No elements on this page
            </p>
          )}
        </div>
      </div>

      {/* Actions Panel */}
      <div className="panel">
        <h3>Actions</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            className="btn btn-primary"
            onClick={onProcess}
            disabled={processing || overlays.length === 0}
          >
            {processing ? (
              <>
                <span className="spinner"></span> Processing...
              </>
            ) : (
              "📥 Generate PDF"
            )}
          </button>

          {downloadUrl && (
            <div className="download-section">
              <a href={downloadUrl} download>
                ⬇️ Download Edited PDF
              </a>
            </div>
          )}

          <button className="btn" onClick={onReset}>
            🔄 Upload New PDF
          </button>
        </div>
      </div>
    </>
  );
}
