import { sankeyExportStyles } from "../config/appConfig.jsx";

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function serializeSvg(svgElement) {
  const clone = svgElement.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const [, , width = "1120", height = "520"] = (clone.getAttribute("viewBox") || "").split(/\s+/);
  clone.setAttribute("width", width);
  clone.setAttribute("height", height);
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = sankeyExportStyles;
  clone.insertBefore(style, clone.firstChild);
  return new XMLSerializer().serializeToString(clone);
}

export function downloadSvg(svgElement, filename) {
  if (!svgElement) return;
  downloadBlob(new Blob([serializeSvg(svgElement)], { type: "image/svg+xml;charset=utf-8" }), filename);
}

export function downloadSvgAsPng(svgElement, filename) {
  if (!svgElement) return;
  const [, , rawWidth = "1120", rawHeight = "520"] = (svgElement.getAttribute("viewBox") || "").split(/\s+/);
  const width = Number(rawWidth) || 1120;
  const height = Number(rawHeight) || 520;
  const svgString = serializeSvg(svgElement);
  const svgUrl = URL.createObjectURL(new Blob([svgString], { type: "image/svg+xml;charset=utf-8" }));
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement("canvas");
    const scale = 2;
    canvas.width = width * scale;
    canvas.height = height * scale;
    const context = canvas.getContext("2d");
    if (!context) {
      URL.revokeObjectURL(svgUrl);
      return;
    }
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, filename);
      URL.revokeObjectURL(svgUrl);
    }, "image/png");
  };
  image.onerror = () => URL.revokeObjectURL(svgUrl);
  image.src = svgUrl;
}
