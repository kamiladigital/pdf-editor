import React, { useRef, useCallback } from "react";

export default function ImageUploader({ onUpload, onCancel }) {
  const inputRef = useRef();

  const handleFile = useCallback(
    (file) => {
      if (!file) return;

      // Validate it's an image
      if (!file.type.startsWith("image/")) {
        alert("Please select an image file (PNG, JPG, GIF, WebP)");
        return;
      }

      // Max 10MB
      if (file.size > 10 * 1024 * 1024) {
        alert("Image must be under 10MB");
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        onUpload(e.target.result, file.name);
      };
      reader.readAsDataURL(file);
    },
    [onUpload]
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      const file = e.dataTransfer.files[0];
      handleFile(file);
    },
    [handleFile]
  );

  return (
    <div style={{ marginTop: 8 }}>
      <div
        style={{
          border: "2px dashed #ccc",
          borderRadius: 8,
          padding: "20px 12px",
          textAlign: "center",
          cursor: "pointer",
          background: "#fafafa",
          transition: "all 0.15s",
          marginBottom: 8,
        }}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          e.currentTarget.style.borderColor = "#4a90d9";
          e.currentTarget.style.background = "#f0f6ff";
        }}
        onDragLeave={(e) => {
          e.currentTarget.style.borderColor = "#ccc";
          e.currentTarget.style.background = "#fafafa";
        }}
        onDrop={handleDrop}
      >
        <div style={{ fontSize: 24, marginBottom: 4 }}>🖼️</div>
        <p style={{ fontSize: 12, color: "#666", margin: 0 }}>
          Click or drag an image here
        </p>
        <p style={{ fontSize: 11, color: "#aaa", margin: "4px 0 0" }}>
          PNG, JPG, GIF, WebP — max 10MB
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => handleFile(e.target.files[0])}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="btn btn-sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
