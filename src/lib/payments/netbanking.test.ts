import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { bankTransferDetails, submitBankTransferReference } from "@/lib/payments/service";

const keys = ["BANK_ACCOUNT_NAME", "BANK_ACCOUNT_NUMBER", "BANK_IFSC", "BANK_NAME"] as const;
const snapshot: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of keys) {
    snapshot[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of keys) {
    if (snapshot[key] === undefined) delete process.env[key];
    else process.env[key] = snapshot[key];
  }
});

describe("manual bank transfer (net banking) payments", () => {
  it("stays unavailable until an account number and IFSC are configured", () => {
    expect(bankTransferDetails()).toMatchObject({ available: false, accountName: "Real Education Time" });
    process.env.BANK_ACCOUNT_NUMBER = "000111222333";
    expect(bankTransferDetails().available).toBe(false);
    process.env.BANK_IFSC = "HDFC0000123";
    expect(bankTransferDetails()).toMatchObject({ available: true, accountNumber: "000111222333", ifsc: "HDFC0000123" });
  });

  it("never invents bank details", () => {
    const details = bankTransferDetails();
    expect(details.accountNumber).toBe("");
    expect(details.ifsc).toBe("");
    expect(details.bankName).toBe("");
  });

  it("rejects a bank reference while the destination account is not configured", async () => {
    await expect(submitBankTransferReference("user-1", "SCHOOL_6_12_FULL", "123456789012")).rejects.toThrow(/not configured/i);
  });

  it("discloses a manual review window instead of instant access", () => {
    expect(bankTransferDetails().reviewWindowHours).toBeGreaterThan(0);
  });
});
