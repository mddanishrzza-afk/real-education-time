/**
 * Where a student's manual (static-QR) payment must actually go.
 *
 * History: the access center used to render a committed PhonePe screenshot whose QR encoded a
 * different recipient than the UPI ID printed next to it. A student scanning that screenshot
 * could have paid a stranger. The destination is therefore never stored as an image in the
 * repository: it is resolved from the deployment environment, validated parameter by parameter,
 * and the QR the student scans is generated from the validated value at request time.
 *
 * Two environment formats are accepted, in this order:
 *   1. `PAYMENT_QR_URI` — the exact `upi://pay?...` string the payment app produced (paste the
 *      string, or scan the owner's QR and copy the decoded payload). This is the preferred,
 *      lossless format and the one the deployment guide asks for.
 *   2. `MANUAL_UPI_ID` / `MANUAL_UPI_NAME` — the older id + name pair. Kept working so an
 *      already-configured deployment does not break.
 *
 * Parsing is deliberately strict and fails closed: an unknown parameter (an injected `am`, `url`
 * or `sign`), a URL that is not a `upi://pay` intent, or a malformed UPI handle makes the whole
 * destination `invalid`, and the UI then shows a "not available" notice instead of a QR. A wrong
 * QR is worse than no QR.
 */

export type PaymentDestination = {
  /** Verified UPI handle, e.g. `9973585883@ybl`. */
  upiId: string;
  /** Payee name as the UPI app will display it (may be empty). */
  payeeName: string;
  /** Validated parameters that were present in the source, in their original order. */
  parameters: ReadonlyArray<readonly [string, string]>;
  /** The exact string this destination came from, before any per-plan amount was added. */
  source: string;
};

export type PaymentDestinationStatus = "ready" | "unconfigured" | "invalid";

export type ResolvedPaymentDestination = {
  status: PaymentDestinationStatus;
  destination: PaymentDestination | null;
  /** Environment variable that supplied the destination — never rendered to students. */
  sourceVariable: "PAYMENT_QR_URI" | "MANUAL_UPI_ID" | null;
  /** Short, operator-facing reason when the status is "invalid". */
  error: string | null;
  /** Optional reassurance line shown under the QR (`PAYMENT_QR_NOTE`). */
  note: string;
};

/** Parameters a static UPI QR may carry. Anything else fails validation. */
const ALLOWED_PARAMETERS = ["pa", "pn", "am", "cu", "mc", "mode", "purpose", "tn"] as const;
const MAX_VALUE_LENGTH = 128;
/** UPI handles look like `name@psp`; this rejects spaces, control characters and URL injection. */
const UPI_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{1,63}@[A-Za-z][A-Za-z0-9.]{1,32}$/;
const AMOUNT_PATTERN = /^(?:0|[1-9]\d{0,6})(?:\.\d{1,2})?$/;

function clean(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, "").trim();
}

/**
 * Parse and validate a `upi://pay?...` intent string.
 * Returns `{ destination: null, error: null }` for an empty value (nothing configured) and
 * `{ destination: null, error: "..." }` for a value that is present but unusable.
 */
export function parsePaymentDestination(value: string | null | undefined): {
  destination: PaymentDestination | null;
  error: string | null;
} {
  const raw = (value ?? "").trim();
  if (!raw) return { destination: null, error: null };

  const match = /^upi:\/\/pay\?(.+)$/i.exec(raw);
  const query = match?.[1];
  if (!query) {
    return { destination: null, error: "the value must be a upi://pay? intent string" };
  }

  const parameters: Array<readonly [string, string]> = [];
  for (const [key, value] of new URLSearchParams(query)) {
    if (!(ALLOWED_PARAMETERS as readonly string[]).includes(key)) {
      return { destination: null, error: `unsupported parameter "${key}" in the payment QR` };
    }
    if (value.length > MAX_VALUE_LENGTH) {
      return { destination: null, error: `parameter "${key}" is longer than ${MAX_VALUE_LENGTH} characters` };
    }
    const cleaned = clean(value);
    if (!cleaned) return { destination: null, error: `parameter "${key}" is empty` };
    parameters.push([key, cleaned]);
  }

  const upiId = parameters.find(([key]) => key === "pa")?.[1] ?? "";
  if (!UPI_ID_PATTERN.test(upiId)) {
    return { destination: null, error: '"pa" must be a valid UPI id such as 9973585883@ybl' };
  }
  const payeeName = parameters.find(([key]) => key === "pn")?.[1] ?? "";
  if (payeeName && !/[A-Za-z\u0900-\u097F0-9]/.test(payeeName)) {
    return { destination: null, error: '"pn" must contain a readable payee name' };
  }
  const amount = parameters.find(([key]) => key === "am")?.[1];
  if (amount && (!AMOUNT_PATTERN.test(amount) || Number(amount) <= 0)) {
    return { destination: null, error: '"am" must be a positive amount with at most 2 decimals' };
  }

  return {
    destination: { upiId, payeeName, parameters, source: raw },
    error: null,
  };
}

/**
 * Rebuild the intent string, this time with our own encoding.
 * `amountRupees` and `note` (both optional) lock the payable amount and label the payment for the
 * administrator; the amount replaces any `am` from the source so a stale amount can never win.
 */
export function buildUpiUri(
  destination: PaymentDestination,
  options: { amountRupees?: string | null; note?: string | null } = {},
): string {
  const requested = options.amountRupees?.trim() || null;
  if (requested && (!AMOUNT_PATTERN.test(requested) || Number(requested) <= 0)) {
    throw new Error(`Invalid payment amount: ${requested}`);
  }
  // A plan amount replaces whatever amount the source carried; with no requested amount the
  // source's own amount (if the owner configured a fixed one) is preserved.
  const sourceAmount = destination.parameters.find(([key]) => key === "am")?.[1] ?? null;
  const amount = requested ?? sourceAmount;
  const note = options.note ? clean(options.note).slice(0, 40) : null;

  const pairs: Array<readonly [string, string]> = [];
  for (const [key, value] of destination.parameters) {
    if (key === "am" || key === "tn") continue;
    pairs.push([key, value]);
    if (key === "pn" && amount) pairs.push(["am", amount]);
  }
  if (amount && !pairs.some(([key]) => key === "am")) pairs.push(["am", amount]);
  if (note && !pairs.some(([key]) => key === "tn")) pairs.push(["tn", note]);

  return `upi://pay?${pairs.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join("&")}`;
}

/** `700` -> `"7.00"`; UPI expects a plain decimal string without a currency symbol. */
export function formatUpiAmount(amountPaise: number): string {
  if (!Number.isInteger(amountPaise) || amountPaise <= 0) throw new Error(`Invalid amount in paise: ${amountPaise}`);
  return (amountPaise / 100).toFixed(2);
}

/** Resolve the deployment's payment destination from the environment, failing closed. */
export function resolvePaymentDestination(env: NodeJS.ProcessEnv = process.env): ResolvedPaymentDestination {
  const note = clean(env.PAYMENT_QR_NOTE ?? "").slice(0, 160);
  const qrUri = (env.PAYMENT_QR_URI ?? "").trim();
  if (qrUri) {
    const { destination, error } = parsePaymentDestination(qrUri);
    return {
      status: destination ? "ready" : "invalid",
      destination,
      sourceVariable: "PAYMENT_QR_URI",
      error: error ? `PAYMENT_QR_URI is unusable: ${error}. No QR is shown until this is corrected.` : null,
      note,
    };
  }

  const upiId = clean(env.MANUAL_UPI_ID ?? "");
  const payeeName = clean(env.MANUAL_UPI_NAME ?? "");
  if (!upiId) return { status: "unconfigured", destination: null, sourceVariable: null, error: null, note };
  const legacy = parsePaymentDestination(
    `upi://pay?pa=${encodeURIComponent(upiId)}${payeeName ? `&pn=${encodeURIComponent(payeeName)}` : ""}&cu=INR`,
  );
  return {
    status: legacy.destination ? "ready" : "invalid",
    destination: legacy.destination,
    sourceVariable: "MANUAL_UPI_ID",
    error: legacy.error ? `MANUAL_UPI_ID is unusable: ${legacy.error}. No QR is shown until this is corrected.` : null,
    note,
  };
}
