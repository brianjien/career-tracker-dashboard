import { useEffect, useState } from "react";
import { FiDownload as Download, FiExternalLink as ExternalLink, FiFileText as FileText } from "react-icons/fi";
import { readAuthToken } from "../../lib/auth.js";
import {
  dataUrlToBlobUrl,
  getDocumentDownloadUrl,
  getDocumentPreviewMode,
  getDocumentPreviewSource,
  isPdfDocument,
  safeDocumentFileUrl,
  safeExternalUrl,
} from "../../lib/documents.js";

export function DocumentPreviewPanel({ document, authToken }) {
  const mode = getDocumentPreviewMode(document);
  const rawSource = getDocumentPreviewSource(document);
  const fileUrl = safeDocumentFileUrl(document.fileUrl);
  const downloadUrl = getDocumentDownloadUrl(document);
  const [blobSource, setBlobSource] = useState("");
  const [previewState, setPreviewState] = useState("idle");
  const [previewError, setPreviewError] = useState("");
  const [mobilePreviewFallback, setMobilePreviewFallback] = useState(false);
  const shouldUseBlob = Boolean((document.fileData || fileUrl) && (mode === "frame" || mode === "image"));
  const shouldUseMobilePdfFallback = mobilePreviewFallback && mode === "frame" && isPdfDocument(document);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const mediaQuery = window.matchMedia("(max-width: 760px), (pointer: coarse)");
    const syncPreviewMode = () => setMobilePreviewFallback(Boolean(mediaQuery.matches));
    syncPreviewMode();
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncPreviewMode);
      return () => mediaQuery.removeEventListener("change", syncPreviewMode);
    }
    mediaQuery.addListener?.(syncPreviewMode);
    return () => mediaQuery.removeListener?.(syncPreviewMode);
  }, []);

  useEffect(() => {
    setBlobSource("");
    setPreviewError("");
    if (!shouldUseBlob) return undefined;
    let nextSource = "";
    let cancelled = false;

    async function prepareBlobPreview() {
      setPreviewState("loading");
      try {
        if (document.fileData) {
          nextSource = dataUrlToBlobUrl(document.fileData);
        } else {
          const headers = {};
          const token = authToken || readAuthToken();
          if (token) headers.Authorization = `Bearer ${token}`;
          const response = await fetch(fileUrl, {
            headers,
            credentials: "same-origin",
          });
          if (!response.ok) throw new Error(`Preview failed with ${response.status}`);
          const blob = await response.blob();
          nextSource = URL.createObjectURL(blob);
        }
        if (cancelled) {
          if (nextSource) URL.revokeObjectURL(nextSource);
          return;
        }
        setBlobSource(nextSource);
        setPreviewState("ready");
      } catch {
        if (!cancelled) {
          setBlobSource("");
          setPreviewState("error");
          setPreviewError("Preview could not load in this browser. Download the original file to view it.");
        }
      }
    }

    prepareBlobPreview();
    return () => {
      cancelled = true;
      if (nextSource) URL.revokeObjectURL(nextSource);
    };
  }, [authToken, document.fileData, fileUrl, shouldUseBlob]);

  const source = shouldUseBlob ? blobSource : rawSource;
  const mobileOpenUrl = fileUrl || rawSource || source || safeExternalUrl(document.url);

  if (shouldUseBlob && previewState === "error") {
    return (
      <div className="document-preview-empty">
        <FileText size={32} aria-hidden="true" />
        <strong>Preview blocked</strong>
        <span>{previewError}</span>
      </div>
    );
  }

  if (shouldUseBlob && !source) {
    return (
      <div className="document-preview-empty">
        <FileText size={32} aria-hidden="true" />
        <strong>Preparing preview</strong>
        <span>Loading the protected file through your signed-in session.</span>
      </div>
    );
  }

  if (shouldUseMobilePdfFallback) {
    return (
      <div className="document-preview-mobile-fallback">
        <FileText size={34} aria-hidden="true" />
        <strong>Open PDF preview</strong>
        <span>
          Mobile browsers can block embedded PDF previews. Open the file in the browser viewer, or download the original.
        </span>
        <div className="document-preview-mobile-actions">
          {mobileOpenUrl && (
            <a className="primary-button" href={mobileOpenUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={15} aria-hidden="true" />
              Open Preview
            </a>
          )}
          {(downloadUrl || document.fileData) && (
            <a className="secondary-button" href={downloadUrl || document.fileData} download={document.fileName || `${document.name}.pdf`}>
              <Download size={15} aria-hidden="true" />
              Download
            </a>
          )}
        </div>
      </div>
    );
  }

  if (mode === "image") {
    return (
      <div className="document-preview-canvas">
        <img src={source} alt={`${document.name} preview`} />
      </div>
    );
  }

  if ((mode === "frame" || mode === "link") && source) {
    const frameProps =
      mode === "link"
        ? {
            sandbox: "allow-scripts allow-same-origin allow-popups allow-forms",
            referrerPolicy: "no-referrer",
          }
        : {};
    return (
      <>
        <iframe
          className="document-preview-frame"
          src={source}
          title={`${document.name} preview`}
          {...frameProps}
        />
        {mode === "link" && (
          <p className="document-preview-note">
            Some sources block embedded previews. Use Open Source if this pane stays blank.
          </p>
        )}
      </>
    );
  }

  return (
    <div className="document-preview-empty">
      <FileText size={32} aria-hidden="true" />
      <strong>Preview not available</strong>
      <span>
        {document.fileName
          ? "This file type cannot be rendered in the browser. Download it to view the full document."
          : "Attach a PDF, image, text file, or add a document link to preview it here."}
      </span>
    </div>
  );
}
