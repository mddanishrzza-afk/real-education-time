/**
 * QR rendering for the manual UPI payment path.
 *
 * The QR the student scans is generated here, at request time, from the validated destination
 * (see `destination.ts`) plus the selected plan's amount. Nothing is committed as an image, so a
 * screenshot in the repository can never point at an old or foreign recipient again.
 *
 * `qrcode` produces the module matrix; the SVG is written by this module so the marker/quiet-zone
 * behaviour is deterministic and testable: `src/lib/payments/destination-qr.test.ts` decodes the
 * exact matrix this file renders and asserts it equals the intent string.
 */
import QRCode from "qrcode";

export type UpiQrMatrix = { size: number; modules: boolean[][] };

/** Reject anything that is not a UPI payment intent before it reaches the encoder. */
export function assertUpiPayload(uri: string): string {
  const value = uri.trim();
  if (!/^upi:\/\/pay\?pa=/i.test(value)) {
    throw new Error("Refusing to render a QR code for a payload that is not a upi://pay intent");
  }
  return value;
}

/** Build the QR module matrix (no rendering) for a validated UPI intent string. */
export function upiQrMatrix(uri: string, errorCorrectionLevel: "L" | "M" | "Q" | "H" = "M"): UpiQrMatrix {
  const payload = assertUpiPayload(uri);
  const qr = QRCode.create(payload, { errorCorrectionLevel });
  const size = qr.modules.size;
  const modules: boolean[][] = [];
  for (let row = 0; row < size; row += 1) {
    const line: boolean[] = [];
    for (let column = 0; column < size; column += 1) line.push(Boolean(qr.modules.get(row, column)));
    modules.push(line);
  }
  return { size, modules };
}

export type UpiQrSvgOptions = {
  /** Rendered pixel size of the square image. */
  size?: number;
  /** Quiet zone in modules (the UPI/QR spec asks for at least 4). */
  quietZone?: number;
  dark?: string;
  light?: string;
};

const svgCache = new Map<string, string>();
const SVG_CACHE_LIMIT = 40;

/** Render a UPI intent string as a self-contained SVG. Square, sharp-edged, no external assets. */
export function renderUpiQrSvg(uri: string, options: UpiQrSvgOptions = {}): string {
  const payload = assertUpiPayload(uri);
  const size = Math.min(Math.max(Math.round(options.size ?? 512), 128), 1024);
  const quietZone = Math.min(Math.max(Math.round(options.quietZone ?? 4), 0), 8);
  const dark = options.dark ?? "#0b0b0f";
  const light = options.light ?? "#ffffff";

  const cacheKey = `${payload}|${size}|${quietZone}|${dark}|${light}`;
  const cached = svgCache.get(cacheKey);
  if (cached) return cached;

  const matrix = upiQrMatrix(payload);
  const total = matrix.size + quietZone * 2;
  const segments: string[] = [];
  for (let row = 0; row < matrix.size; row += 1) {
    for (let column = 0; column < matrix.size; column += 1) {
      if (matrix.modules[row][column]) segments.push(`M${column + quietZone} ${row + quietZone}h1v1h-1z`);
    }
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${total} ${total}" ` +
    `role="img" aria-label="UPI payment QR code" shape-rendering="crispEdges">` +
    `<rect width="${total}" height="${total}" fill="${light}"/>` +
    `<path d="${segments.join("")}" fill="${dark}"/>` +
    `</svg>`;

  if (svgCache.size >= SVG_CACHE_LIMIT) svgCache.clear();
  svgCache.set(cacheKey, svg);
  return svg;
}
