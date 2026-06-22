import { readAuthToken } from "./auth.js";

export function normalizeDocument(document = {}) {
  return {
    id: document.id || `document-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: document.name || "Untitled document",
    type: document.type || document.kind || "Resume",
    status: document.status || "Draft",
    target: document.target || document.job || "General",
    sourceJobId: document.sourceJobId || "",
    url: document.url || "",
    version: document.version || "v1",
    owner: document.owner || "",
    notes: document.notes || "",
    fileName: document.fileName || "",
    fileType: document.fileType || "",
    fileSize: Number(document.fileSize || 0),
    fileData: document.fileData || "",
    fileKey: document.fileKey || "",
    fileUrl: document.fileUrl || "",
    storage: document.storage || "",
    updated: document.updated || new Date().toISOString(),
  };
}

export function getJobDocumentLabel(job = {}) {
  return `${job.company || "Company"} · ${job.role || "Role"}`;
}

export function formatBytes(value = 0) {
  const bytes = Number(value || 0);
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function safeExternalUrl(value = "") {
  const raw = String(value || "").trim();
  if (!raw || raw.length > 2048) return "";
  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return "";
    return url.href;
  } catch {
    return "";
  }
}

export function isOpenableUrl(value = "") {
  return Boolean(safeExternalUrl(value));
}

export function safeDocumentFileUrl(value = "") {
  const raw = String(value || "").trim();
  if (raw.startsWith("/api/documents/file?")) {
    try {
      const parsed = new URL(raw, window.location.origin);
      const key = parsed.searchParams.get("key") || "";
      if (parsed.origin !== window.location.origin || parsed.pathname !== "/api/documents/file") return "";
      if (!/^users\/[a-zA-Z0-9_-]+\/documents\/[a-zA-Z0-9_.@+=,/-]+$/.test(key)) return "";
      return `/api/documents/file?key=${encodeURIComponent(key)}`;
    } catch {
      return "";
    }
  }
  return "";
}

export function getDocumentDownloadUrl(document = {}) {
  const fileUrl = safeDocumentFileUrl(document.fileUrl);
  if (!fileUrl) return "";
  return fileUrl.startsWith("/api/documents/file?") ? `${fileUrl}&download=1` : fileUrl;
}

export function getEmbeddableDocumentUrl(value = "") {
  const rawUrl = safeExternalUrl(value);
  if (!rawUrl) return "";
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "drive.google.com") {
      const fileMatch = parsed.pathname.match(/\/file\/d\/([^/]+)/);
      const id = fileMatch?.[1] || parsed.searchParams.get("id");
      if (id) return `https://drive.google.com/file/d/${id}/preview`;
    }
    if (host === "docs.google.com") {
      const docMatch = parsed.pathname.match(/^\/(document|spreadsheets|presentation)\/d\/([^/]+)/);
      if (docMatch) return `https://docs.google.com/${docMatch[1]}/d/${docMatch[2]}/preview`;
    }
    return rawUrl;
  } catch {
    return rawUrl;
  }
}

export function getDocumentPreviewMode(document = {}) {
  const fileType = String(document.fileType || "").toLowerCase();
  const fileName = String(document.fileName || "").toLowerCase();
  const hasStoredFile = Boolean(document.fileData || safeDocumentFileUrl(document.fileUrl));
  const safeTextPreview =
    ["text/plain", "text/csv", "text/markdown", "application/json"].includes(fileType) || /\.(csv|json|md|txt)$/i.test(fileName);
  if (hasStoredFile) {
    if (fileType.startsWith("image/") && fileType !== "image/svg+xml") return "image";
    if (fileType === "application/pdf" || fileName.endsWith(".pdf")) return "frame";
    if (safeTextPreview) return "frame";
    return "unsupported-file";
  }
  if (isOpenableUrl(document.url)) return "link";
  return "empty";
}

export function isPdfDocument(document = {}) {
  const fileType = String(document.fileType || "").toLowerCase();
  const fileName = String(document.fileName || "").toLowerCase();
  return fileType === "application/pdf" || fileName.endsWith(".pdf");
}

export function getDocumentPreviewSource(document = {}) {
  if (document.fileData) return document.fileData;
  const fileUrl = safeDocumentFileUrl(document.fileUrl);
  if (fileUrl) return fileUrl;
  return getEmbeddableDocumentUrl(document.url);
}

export function dataUrlToBlobUrl(dataUrl = "") {
  const match = String(dataUrl).match(/^data:([^;,]+)?((?:;[^,]+)*),(.*)$/s);
  if (!match) return "";
  const mimeType = match[1] || "application/octet-stream";
  const flags = match[2] || "";
  const payload = match[3] || "";
  const binary = flags.includes(";base64") ? window.atob(payload.replace(/\s/g, "")) : decodeURIComponent(payload);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
}

export async function uploadDocumentFile(file, token = readAuthToken()) {
  const formData = new FormData();
  formData.append("file", file);
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch("/api/documents/upload", {
    method: "POST",
    headers,
    credentials: "same-origin",
    body: formData,
  });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : {};
  if (!response.ok) {
    throw new Error(payload.error || `Upload failed with ${response.status}`);
  }
  return payload;
}
