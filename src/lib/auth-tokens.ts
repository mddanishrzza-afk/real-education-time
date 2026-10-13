import { createHash, randomBytes } from "node:crypto";

export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1_000;
export const PASSWORD_RESET_TTL_MS = 30 * 60 * 1_000;
export const GUARDIAN_CONSENT_TTL_MS = 7 * 24 * 60 * 60 * 1_000;

export function hashAuthToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function issueAuthToken(ttlMs: number) {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    tokenHash: hashAuthToken(token),
    expiresAt: new Date(Date.now() + ttlMs),
  };
}
