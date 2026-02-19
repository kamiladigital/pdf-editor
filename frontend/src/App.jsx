import React, { useState, useCallback } from "react";
import PDFUploader from "./components/PDFUploader";
import PDFViewer from "./components/PDFViewer";
import Sidebar from "./components/Sidebar";
import { generatePDF } from "./pdfGenerator";

export default function App() {
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfBytes, setPdfBytes] = useState(null); // raw ArrayBuffer
  const [pdfPassword, setPdfPassword] = useState(null); // password for encrypted PDFs
  const [pdfInfo, setPdfInfo] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [overlays, setOverlays] = useState([]);
  const [selectedOverlay, setSelectedOverlay] = useState(null);
  const [activeTool, setActiveTool] = useState(null); // 'text' or 'image'
  const [status, setStatus] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [pendingFile, setPendingFile] = useState(null); // file awaiting password
  const [pendingBytes, setPendingBytes] = useState(null); // bytes awaiting password
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");

  const loadPdfWithPassword = useCallback(async (file, arrayBuffer, password) => {
    const { PDFDocument } = await import("pdf-lib");
    const loadOptions = password ? { password } : {};
    const doc = await PDFDocument.load(arrayBuffer, loadOptions);
    const pages = doc.getPages();

    const info = {
      pages: pages.length,
      pageWidths: pages.map((p) => p.getSize().width),
      pageHeights: pages.map((p) => p.getSize().height),
    };

    setPdfFile(file);
    setPdfBytes(arrayBuffer);
    setPdfPassword(password || null);
    setPdfInfo(info);
    setCurrentPage(1);
    setOverlays([]);
    setSelectedOverlay(null);
    setDownloadUrl(null);
    setActiveTool(null);
    setPendingFile(null);
    setPendingBytes(null);
    setShowPasswordDialog(false);
    setPasswordInput("");

    setStatus({
      type: "success",
      message: `Loaded: ${file.name} (${pages.length} page${pages.length > 1 ? "s" : ""})${password ? " 🔓" : ""}`,
    });
  }, []);

  const handleUpload = useCallback(async (file) => {
    setStatus({ type: "info", message: "Loading PDF..." });

    try {
      const arrayBuffer = await file.arrayBuffer();
      await loadPdfWithPassword(file, arrayBuffer, null);
    } catch (err) {
      // Check if the error is due to encryption
      const msg = err.message || "";
      if (msg.includes("encrypted") || msg.includes("password")) {
        const arrayBuffer = await file.arrayBuffer();
        setPendingFile(file);
        setPendingBytes(arrayBuffer);
        setShowPasswordDialog(true);
        setPasswordInput("");
        setStatus({ type: "info", message: "This PDF is password-protected. Please enter the password." });
      } else {
        setStatus({ type: "error", message: `Failed to load PDF: ${msg}` });
      }
    }
  }, [loadPdfWithPassword]);

  const handlePasswordSubmit = useCallback(async () => {
    if (!pendingFile || !pendingBytes) return;
    setStatus({ type: "info", message: "Unlocking PDF..." });
    try {
      await loadPdfWithPassword(pendingFile, pendingBytes, passwordInput);
    } catch (err) {
      setStatus({ type: "error", message: "Wrong password or unable to decrypt this PDF." });
    }
  }, [pendingFile, pendingBytes, passwordInput, loadPdfWithPassword]);

  const handlePasswordCancel = useCallback(() => {
    setPendingFile(null);
    setPendingBytes(null);
    setShowPasswordDialog(false);
    setPasswordInput("");
    setStatus(null);
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
    if (!pdfBytes || overlays.length === 0) {
      setStatus({ type: "error", message: "Add some text or images before generating" });
      return;
    }

    setProcessing(true);
    setStatus({ type: "info", message: "Generating PDF..." });

    // Revoke previous download URL
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
      setDownloadUrl(null);
    }

    try {
      const resultBytes = await generatePDF(pdfBytes, overlays, pdfPassword);
      const blob = new Blob([resultBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setStatus({ type: "success", message: "PDF generated successfully!" });
    } catch (err) {
      setStatus({ type: "error", message: `Generation failed: ${err.message}` });
    } finally {
      setProcessing(false);
    }
  }, [pdfBytes, overlays, downloadUrl, pdfPassword]);

  const handleReset = useCallback(() => {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    setPdfFile(null);
    setPdfBytes(null);
    setPdfPassword(null);
    setPdfInfo(null);
    setPendingFile(null);
    setPendingBytes(null);
    setShowPasswordDialog(false);
    setPasswordInput("");
    setCurrentPage(1);
    setOverlays([]);
    setSelectedOverlay(null);
    setActiveTool(null);
    setStatus(null);
    setDownloadUrl(null);
    setProcessing(false);
  }, [downloadUrl]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>PDF Editor</h1>
        <p>Upload a PDF, add text and images, then download the result</p>
      </header>

      {status && (
        <div className={`status-bar ${status.type}`}>{status.message}</div>
      )}

      {showPasswordDialog && (
        <div className="password-dialog">
          <div className="password-dialog-inner">
            <h3>🔒 Password Protected PDF</h3>
            <p>This PDF requires a password to open.</p>
            <form onSubmit={(e) => { e.preventDefault(); handlePasswordSubmit(); }}>
              <input
                type="password"
                placeholder="Enter PDF password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                autoFocus
              />
              <div className="password-dialog-actions">
                <button type="submit" className="btn btn-primary">Unlock</button>
                <button type="button" className="btn" onClick={handlePasswordCancel}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {!pdfFile && !showPasswordDialog ? (
        <PDFUploader onUpload={handleUpload} />
      ) : pdfFile ? (
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
                password={pdfPassword}
              />
            </div>
          </div>
      ) : null}
    </div>
  );
}
