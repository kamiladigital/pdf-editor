import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

/**
 * Parse a hex color string (#RRGGBB) into pdf-lib rgb() values.
 */
function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  return rgb(r, g, b);
}

/**
 * Load a data URL into an HTMLImageElement.
 */
function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error("Failed to load image: " + e));
    img.src = dataUrl;
  });
}

/**
 * Normalize any image data URL to a clean PNG via canvas.
 * This handles WebP, GIF, interlaced PNGs, CMYK JPEGs, etc.
 * Returns a Uint8Array of PNG bytes that pdf-lib can always embed.
 */
async function normalizeImageToPng(dataUrl) {
  const img = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * Generate a new PDF with text and image overlays applied client-side.
 *
 * @param {ArrayBuffer} pdfBytes - The original PDF file bytes
 * @param {Array} overlays - Array of overlay objects (type: "text" | "image")
 * @returns {Promise<Uint8Array>} - The modified PDF bytes
 */
export async function generatePDF(pdfBytes, overlays, password) {
  const loadOptions = password ? { password } : {};
  const pdfDoc = await PDFDocument.load(pdfBytes, loadOptions);
  const pages = pdfDoc.getPages();
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (const overlay of overlays) {
    const pageIndex = (overlay.page || 1) - 1;
    if (pageIndex < 0 || pageIndex >= pages.length) continue;
    const page = pages[pageIndex];
    const { width: pageWidth, height: pageHeight } = page.getSize();

    if (overlay.type === "text") {
      const fontSize = overlay.fontSize || 14;
      const color = overlay.color ? hexToRgb(overlay.color) : rgb(0, 0, 0);

      // Frontend coordinates: x%, y% from top-left
      const absX = (overlay.x / 100) * pageWidth;
      const absYFromTop = (overlay.y / 100) * pageHeight;

      // PDF coordinate system: y=0 is bottom-left
      // Place text so its top aligns with the overlay position
      const pdfY = pageHeight - absYFromTop - fontSize;

      page.drawText(overlay.text || "", {
        x: absX,
        y: pdfY,
        size: fontSize,
        font: helveticaFont,
        color,
      });
    } else if (overlay.type === "image" && overlay.imageData) {
      // Normalize image to clean PNG via canvas (handles all formats)
      let pngBytes;
      try {
        pngBytes = await normalizeImageToPng(overlay.imageData);
      } catch (e) {
        console.warn("Failed to normalize image, skipping:", e);
        continue;
      }

      let embeddedImage;
      try {
        embeddedImage = await pdfDoc.embedPng(pngBytes);
      } catch (e) {
        console.warn("Failed to embed image, skipping:", e);
        continue;
      }

      // Calculate dimensions from percentage of page
      const drawWidth = (overlay.width / 100) * pageWidth;
      const drawHeight = (overlay.height / 100) * pageHeight;

      // Frontend: x%, y% from top-left corner of image
      const absX = (overlay.x / 100) * pageWidth;
      const absYFromTop = (overlay.y / 100) * pageHeight;

      // PDF y: bottom-left of the image
      // top-of-image in PDF coords = pageHeight - absYFromTop
      // bottom-of-image = top-of-image - drawHeight
      const pdfY = pageHeight - absYFromTop - drawHeight;

      page.drawImage(embeddedImage, {
        x: absX,
        y: pdfY,
        width: drawWidth,
        height: drawHeight,
      });
    }
  }

  return await pdfDoc.save();
}
