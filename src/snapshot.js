// A keepsake picture of the garden: the live canvas, pixel for pixel, with a small caption band
// naming your companion and the day. Saved as a PNG through an ordinary download; nothing leaves
// the machine.
export const BAND = 14; // caption band height, in garden pixels (scaled with the canvas)

export function renderSnapshot(source, { nickname = "", form = "", days = 0 } = {}, doc = globalThis.document) {
  if (!source || !Number.isFinite(source.width) || !Number.isFinite(source.height) || source.width <= 0) return null;
  const k = Math.max(1, Math.round(source.width / 160));
  const canvas = doc.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height + BAND * k;
  const c = canvas.getContext("2d");
  c.imageSmoothingEnabled = false;
  c.drawImage(source, 0, 0);
  c.fillStyle = "#2c3a33";
  c.fillRect(0, source.height, canvas.width, BAND * k);
  c.fillStyle = "#fffdf3";
  c.font = `${6 * k}px monospace`;
  c.textBaseline = "middle";
  const label = [nickname || form, form && nickname ? form : null, days > 0 ? `day ${days}` : null].filter(Boolean).join(" · ");
  c.fillText(label, 4 * k, source.height + (BAND * k) / 2);
  return canvas;
}

export function snapshotName(nickname, at = new Date()) {
  const safe = String(nickname || "garden").toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "garden";
  const stamp = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`;
  return `hermes-pokemon-${safe}-${stamp}.png`;
}

// Triggers the download. Returns the file name, or null when nothing could be rendered.
export function saveSnapshot(source, info, doc = globalThis.document) {
  const canvas = renderSnapshot(source, info, doc);
  if (!canvas) return null;
  const name = snapshotName(info?.nickname);
  const finish = (url) => {
    const a = doc.createElement("a");
    a.href = url;
    a.download = name;
    a.rel = "noopener";
    doc.body.append(a);
    a.click();
    a.remove();
  };
  if (typeof canvas.toBlob === "function" && typeof URL?.createObjectURL === "function")
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      finish(url);
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    }, "image/png");
  else finish(canvas.toDataURL("image/png"));
  return name;
}
