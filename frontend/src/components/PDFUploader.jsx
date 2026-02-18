import React, { useRef, useCallback } from "react";

export default function PDFUploader({ onUpload }) {
  const inputRef = useRef();
  const [dragging, setDragging] = React.useState(false);

  const handleFile = useCallback(
    (file) => {
      if (file && file.type === "application/pdf") {
        onUpload(file);
      }
    },
    [onUpload]
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      handleFile(file);
    },
    [handleFile]
  );

  return (
    <div
      className={`upload-area ${dragging ? "dragging" : ""}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <h3>📄 Upload a PDF</h3>
      <p>Click to browse or drag and drop a PDF file here</p>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        onChange={(e) => handleFile(e.target.files[0])}
      />
    </div>
  );
}
