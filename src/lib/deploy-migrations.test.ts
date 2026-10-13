import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const SCRIPT = "scripts/fail-if-migrate-pending.mjs";

function run(args: string[], env: NodeJS.ProcessEnv = process.env) {
  try {
    const stdout = execFileSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8", env });
    return { status: 0, stdout };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string };
    return { status: failure.status ?? 1, stdout: String(failure.stdout ?? "") };
  }
}

describe("deployment migration guard", () => {
  it("reports every pending, failed or rolled back migration", () => {
    const result = run(["--self-test"]);
    expect(result.stdout).toContain("MIGRATION_CHECK_SELF_TEST_PASS");
    expect(result.status).toBe(0);
  });

  it("exits non-zero so the deployment stops when a migration is pending", () => {
    const result = run(["--expect-fail"]);
    expect(result.stdout).toContain("MIGRATION_CHECK_NEGATIVE_PASS");
    expect(result.status).toBe(1);
  });

  it("stays out of the way of local SQLite builds", () => {
    const result = run([], { ...process.env, DATABASE_URL: "" });
    expect(result.stdout).toContain("skipping");
    expect(result.status).toBe(0);
  });
});
