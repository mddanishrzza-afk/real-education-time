import { describe, expect, it } from "vitest";

import {
  buildUpiUri,
  formatUpiAmount,
  parsePaymentDestination,
  resolvePaymentDestination,
} from "./destination";

/** The exact payload decoded from the PhonePe QR the owner sent (image-1.jpeg, Oct 2026). */
const PHONEPE_QR_URI = "upi://pay?pa=9973585883-2@axl&pn=MOHAMMAD%20DANISH&mc=0000&mode=02&purpose=00";

describe("payment destination parsing", () => {
  it("accepts the owner's live PhonePe QR payload", () => {
    const { destination, error } = parsePaymentDestination(PHONEPE_QR_URI);
    expect(error).toBeNull();
    expect(destination?.upiId).toBe("9973585883-2@axl");
    expect(destination?.payeeName).toBe("MOHAMMAD DANISH");
  });

  it("accepts the older handle@psp pair", () => {
    const { destination, error } = parsePaymentDestination("upi://pay?pa=9973585883@ybl&pn=Vasir%20Miyan");
    expect(error).toBeNull();
    expect(destination?.upiId).toBe("9973585883@ybl");
  });

  it("treats an empty value as 'nothing configured', not as an error", () => {
    expect(parsePaymentDestination("")).toEqual({ destination: null, error: null });
    expect(parsePaymentDestination(undefined)).toEqual({ destination: null, error: null });
  });

  it("refuses anything that is not a upi://pay intent", () => {
    for (const value of [
      "https://pay.phonepe.com/1234",
      "upi://pay/9973585883@ybl",
      "9973585883@ybl",
      "javascript:alert(1)",
      "upi://pay?pn=Somebody",
    ]) {
      const { destination, error } = parsePaymentDestination(value);
      expect(destination, value).toBeNull();
      expect(error, value).toBeTruthy();
    }
  });

  it("refuses malformed UPI handles", () => {
    for (const pa of ["9973585883", "@ybl", "99735 85883@ybl", "9973585883@", "9973585883@ybl/../x"]) {
      const { destination } = parsePaymentDestination(`upi://pay?pa=${encodeURIComponent(pa)}`);
      expect(destination, pa).toBeNull();
    }
  });

  it("refuses unknown parameters and invalid amounts instead of passing them through", () => {
    for (const query of [
      "pa=9973585883@ybl&url=https://evil.example",
      "pa=9973585883@ybl&am=0",
      "pa=9973585883@ybl&am=-5",
      "pa=9973585883@ybl&am=7.005",
      "pa=9973585883@ybl&sign=abc",
      `pa=9973585883@ybl&tn=${"x".repeat(200)}`,
    ]) {
      const { destination, error } = parsePaymentDestination(`upi://pay?${query}`);
      expect(destination, query).toBeNull();
      expect(error, query).toBeTruthy();
    }
  });
});

describe("payment destination building", () => {
  const parsed = parsePaymentDestination(PHONEPE_QR_URI).destination!;

  it("encodes the raw QR payload so every UPI app resolves the same recipient", () => {
    expect(buildUpiUri(parsed)).toBe(
      "upi://pay?pa=9973585883-2%40axl&pn=MOHAMMAD%20DANISH&mc=0000&mode=02&purpose=00",
    );
  });

  it("locks the selected plan amount into the intent right after the payee name", () => {
    expect(buildUpiUri(parsed, { amountRupees: formatUpiAmount(700) })).toBe(
      "upi://pay?pa=9973585883-2%40axl&pn=MOHAMMAD%20DANISH&am=7.00&mc=0000&mode=02&purpose=00",
    );
    expect(buildUpiUri(parsed, { amountRupees: formatUpiAmount(900), note: "RET BOARD_COMPETITIVE_FULL" })).toBe(
      "upi://pay?pa=9973585883-2%40axl&pn=MOHAMMAD%20DANISH&am=9.00&mc=0000&mode=02&purpose=00&tn=RET%20BOARD_COMPETITIVE_FULL",
    );
  });

  it("keeps a fixed amount from the source when no plan amount is requested", () => {
    const fixed = parsePaymentDestination("upi://pay?pa=9973585883@ybl&pn=Shop&am=7.00").destination!;
    expect(buildUpiUri(fixed)).toContain("&am=7.00");
  });

  it("never lets a stale source amount override the requested plan amount", () => {
    const stale = parsePaymentDestination("upi://pay?pa=9973585883@ybl&am=1.00").destination!;
    const built = buildUpiUri(stale, { amountRupees: "9.00" });
    expect(built).toContain("am=9.00");
    expect(built).not.toContain("am=1.00");
    expect(built.match(/am=/g)).toHaveLength(1);
  });

  it("rejects an invalid requested amount instead of encoding it", () => {
    expect(() => buildUpiUri(parsed, { amountRupees: "7,00" })).toThrow();
    expect(() => buildUpiUri(parsed, { amountRupees: "0" })).toThrow();
  });

  it("formats paise the way UPI expects", () => {
    expect(formatUpiAmount(700)).toBe("7.00");
    expect(formatUpiAmount(900)).toBe("9.00");
    expect(formatUpiAmount(12345)).toBe("123.45");
    expect(() => formatUpiAmount(0)).toThrow();
  });
});

describe("payment destination resolution from the environment", () => {
  it("prefers PAYMENT_QR_URI and reports where it came from", () => {
    const resolved = resolvePaymentDestination({
      PAYMENT_QR_URI: PHONEPE_QR_URI,
      MANUAL_UPI_ID: "9973585883@ybl",
      PAYMENT_QR_NOTE: "Scan with any UPI app",
    } as unknown as NodeJS.ProcessEnv);
    expect(resolved.status).toBe("ready");
    expect(resolved.sourceVariable).toBe("PAYMENT_QR_URI");
    expect(resolved.destination?.upiId).toBe("9973585883-2@axl");
    expect(resolved.note).toBe("Scan with any UPI app");
  });

  it("falls back to MANUAL_UPI_ID + MANUAL_UPI_NAME", () => {
    const resolved = resolvePaymentDestination({
      MANUAL_UPI_ID: "9973585883@ybl",
      MANUAL_UPI_NAME: "Vasir Miyan",
    } as unknown as NodeJS.ProcessEnv);
    expect(resolved.status).toBe("ready");
    expect(resolved.sourceVariable).toBe("MANUAL_UPI_ID");
    expect(buildUpiUri(resolved.destination!)).toBe(
      "upi://pay?pa=9973585883%40ybl&pn=Vasir%20Miyan&cu=INR",
    );
  });

  it("fails closed when a configured destination is unusable", () => {
    const resolved = resolvePaymentDestination({ PAYMENT_QR_URI: "https://evil.example/pay" } as unknown as NodeJS.ProcessEnv);
    expect(resolved.status).toBe("invalid");
    expect(resolved.destination).toBeNull();
    expect(resolved.error).toContain("PAYMENT_QR_URI");
  });

  it("reports 'unconfigured' when nothing is set at all", () => {
    const resolved = resolvePaymentDestination({} as unknown as NodeJS.ProcessEnv);
    expect(resolved).toEqual({
      status: "unconfigured",
      destination: null,
      sourceVariable: null,
      error: null,
      note: "",
    });
  });

  it("rejects a fallback id that is not a UPI id", () => {
    const resolved = resolvePaymentDestination({ MANUAL_UPI_ID: "not-a-upi-id" } as unknown as NodeJS.ProcessEnv);
    expect(resolved.status).toBe("invalid");
    expect(resolved.destination).toBeNull();
  });
});
