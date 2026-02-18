import React, { useState, useCallback } from "react";
import PDFUploader from "./components/PDFUploader";
import PDFViewer from "./components/PDFViewer";
import Sidebar from "./components/Sidebar";

const API_BASE = "/api";

export default function App() {
  const [pdfId, setPdfId] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfInfo, setPdfInfo] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [overlays, setOverlays] = useState([]);
  const [selectedOverlay, setSelectedOverlay] = useState(null);
  const [activeTool, setActiveTool] = useState(null); // 'text' or 'image'
  const [status, setStatus] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [processing, setProcessing] = useState(false);

  const handleUpload = useCallback(async (file) => {
    setStatus({ type: "info", message: "Uploading PDF..." });
    const formData = new FormData();
    formData.append("pdf", file);

    try {
      const res = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      setPdfId(data.id);
      setPdfFile(file);
      setCurrentPage(1);
      setOverlays([]);
      setSelectedOverlay(null);
      setDownloadUrl(null);
      setActiveTool(null);

      // Get PDF info
      const infoRes = await fetch(`${API_BASE}/pdf-info/${data.id}`);
      const info = await infoRes.json();
      setPdfInfo(info);

      setStatus({ type: "success", message: `Uploaded: ${data.filename} (${data.pages} pages)` });
    } catch (err) {
      setStatus({ type: "error", message: err.message });
    }
  }, []);

  const handleCanvasClick = useCallback(
    (xPercent, yPercent) => {
      if (!activeTool) return;

      if (activeTool === "text") {
        const newOverlay = {
          id: Date.now(),
          type: "text",
          text: "Edit me",
          x: xPercent,
          y: yPercent,
          page: currentPage,
          fontSize: 14,
          color: "#000000",
        };
        setOverlays((prev) => [...prev, newOverlay]);
        setSelectedOverlay(newOverlay.id);
        setActiveTool(null);
      }
    },
    [activeTool, currentPage]
  );

  const handleAddImage = useCallback(
    (imageData, fileName) => {
      const newOverlay = {
        id: Date.now(),
        type: "image",
        imageData,
        fileName: fileName || "Image",
        x: 10,
        y: 10,
        width: 20,
        height: 10,
        page: currentPage,
      };
      setOverlays((prev) => [...prev, newOverlay]);
      setSelectedOverlay(newOverlay.id);
      setActiveTool(null);
    },
    [currentPage]
  );

  const handleUpdateOverlay = useCallback((id, updates) => {
    setOverlays((prev) =>
      prev.map((o) => (o.id === id ? { ...o, ...updates } : o))
    );
  }, []);

  const handleDeleteOverlay = useCallback(
    (id) => {
      setOverlays((prev) => prev.filter((o) => o.id !== id));
      if (selectedOverlay === id) setSelectedOverlay(null);
    },
    [selectedOverlay]
  );

  const handleMoveOverlay = useCallback((id, x, y) => {
    setOverlays((prev) =>
      prev.map((o) => (o.id === id ? { ...o, x, y } : o))
    );
  }, []);

  const handleProcess = useCallback(async () => {
    if (!pdfId || overlays.length === 0) {
      setStatus({ type: "error", message: "Add some text or signatures before processing" });
      return;
    }

    setProcessing(true);
    setStatus({ type: "info", message: "Processing PDF..." });
    setDownloadUrl(null);

    const texts = overlays
      .filter((o) => o.type === "text")
      .map((o) => ({
        text: o.text,
        x: o.x,
        y: o.y,
        page: o.page,
        fontSize: o.fontSize,
        color: o.color,
      }));

    const images = overlays
      .filter((o) => o.type === "image")
      .map((o) => ({
        imageData: o.imageData,
        x: o.x,
        y: o.y,
        width: o.width,
        height: o.height,
        page: o.page,
      }));

    try {
      const res = await fetch(`${API_BASE}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pdfId, texts, images }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Processing failed");

      setDownloadUrl(`${API_BASE}/download/${data.id}`);
      setStatus({ type: "success", message: "PDF processed successfully!" });
    } catch (err) {
      setStatus({ type: "error", message: err.message });
    } finally {
      setProcessing(false);
    }
  }, [pdfId, overlays]);

  const handleReset = useCallback(() => {
    setPdfId(null);
    setPdfFile(null);
    setPdfInfo(null);
    setCurrentPage(1);
    setOverlays([]);
    setSelectedOverlay(null);
    setActiveTool(null);
    setStatus(null);
    setDownloadUrl(null);
    setProcessing(false);
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>PDF Editor</h1>
        <p>Upload a PDF, add text and images, then download the result</p>
      </header>

      {status && (
        <div className={`status-bar ${status.type}`}>{status.message}</div>
      )}

      {!pdfFile ? (
        <PDFUploader onUpload={handleUpload} />
      ) : (
        <>
          <div className="editor-layout">
            <div className="editor-sidebar">
              <Sidebar
                activeTool={activeTool}
                setActiveTool={setActiveTool}
                overlays={overlays}
                currentPage={currentPage}
                selectedOverlay={selectedOverlay}
                setSelectedOverlay={setSelectedOverlay}
                onUpdateOverlay={handleUpdateOverlay}
                onDeleteOverlay={handleDeleteOverlay}
                onAddImage={handleAddImage}
                onProcess={handleProcess}
                onReset={handleReset}
                processing={processing}
                downloadUrl={downloadUrl}
              />
            </div>
            <div className="editor-main">
              <PDFViewer
                file={pdfFile}
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
                totalPages={pdfInfo?.pages || 1}
                overlays={overlays.filter((o) => o.page === currentPage)}
                selectedOverlay={selectedOverlay}
                setSelectedOverlay={setSelectedOverlay}
                onCanvasClick={handleCanvasClick}
                onMoveOverlay={handleMoveOverlay}
                onDeleteOverlay={handleDeleteOverlay}
                activeTool={activeTool}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
