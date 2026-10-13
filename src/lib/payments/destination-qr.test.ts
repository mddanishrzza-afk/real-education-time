import jsQR from "jsqr";
import { describe, expect, it } from "vitest";

import { buildUpiUri, parsePaymentDestination } from "./destination";
import { renderUpiQrSvg, upiQrMatrix, type UpiQrMatrix } from "./destination-qr";

const PHONEPE_QR_URI = "upi://pay?pa=9973585883-2@axl&pn=MOHAMMAD%20DANISH&mc=0000&mode=02&purpose=00";

/**
 * Rasterize the module matrix exactly as `renderUpiQrSvg` lays it out, then hand the bitmap to an
 * independent QR decoder. If the decoder returns the same intent string, the SVG we serve really
 * does make a UPI app pay the validated recipient and amount.
 */
function decodeMatrix(matrix: UpiQrMatrix, scale = 6, quietZone = 4) {
  const total = (matrix.size + quietZone * 2) * scale;
  const data = new Uint8ClampedArray(total * total * 4).fill(255);
  for (let row = 0; row < matrix.size; row += 1) {
    for (let column = 0; column < matrix.size; column += 1) {
      if (!matrix.modules[row][column]) continue;
      for (let y = 0; y < scale; y += 1) {
        for (let x = 0; x < scale; x += 1) {
          const pixelX = (column + quietZone) * scale + x;
          const pixelY = (row + quietZone) * scale + y;
          const index = (pixelY * total + pixelX) * 4;
          data[index] = 0;
          data[index + 1] = 0;
          data[index + 2] = 0;
          data[index + 3] = 255;
        }
      }
    }
  }
  return jsQR(data, total, total, { inversionAttempts: "attemptBoth" });
}

describe("payment QR rendering", () => {
  const destination = parsePaymentDestination(PHONEPE_QR_URI).destination!;

  it("round-trips the validated destination through a real QR decoder", () => {
    const uri = buildUpiUri(destination);
    const decoded = decodeMatrix(upiQrMatrix(uri));
    expect(decoded?.data).toBe(uri);
  });

  it("round-trips the plan amount, so the student cannot pay the wrong price", () => {
    const uri = buildUpiUri(destination, { amountRupees: "7.00", note: "RET SCHOOL_6_12_FULL" });
    const decoded = decodeMatrix(upiQrMatrix(uri));
    expect(decoded?.data).toBe(uri);
    expect(decoded?.data).toContain("am=7.00");
  });

  it("encodes the recipient that was validated, never a different one", () => {
    const decoded = decodeMatrix(upiQrMatrix(buildUpiUri(destination)));
    expect(decoded?.data).toContain("pa=9973585883-2%40axl");
    expect(decoded?.data).toContain("pn=MOHAMMAD%20DANISH");
    expect(decoded?.data).not.toContain("9973585883%40ybl");
  });

  it("refuses to render a QR for a payload that is not a UPI payment intent", () => {
    expect(() => upiQrMatrix("https://evil.example/pay")).toThrow();
    expect(() => renderUpiQrSvg("tel:+919999999999")).toThrow();
  });

  it("produces a self-contained SVG with a proper quiet zone", () => {
    const svg = renderUpiQrSvg(buildUpiUri(destination), { size: 640 });
    expect(svg.startsWith("<svg xmlns=\"http://www.w3.org/2000/svg\"")).toBe(true);
    expect(svg).toContain('shape-rendering="crispEdges"');
    expect(svg).toContain('width="640"');
    expect(svg).not.toContain("<script");
    expect(svg).not.toContain("href=");
    const matrix = upiQrMatrix(buildUpiUri(destination));
    expect(svg).toContain(`viewBox="0 0 ${matrix.size + 8} ${matrix.size + 8}"`);
  });

  it("returns an identical cached SVG for the same payload", () => {
    const uri = buildUpiUri(destination);
    expect(renderUpiQrSvg(uri, { size: 512 })).toBe(renderUpiQrSvg(uri, { size: 512 }));
  });
});
