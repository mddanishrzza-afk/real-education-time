/**
 * Fail closed when `prisma migrate deploy` did not actually apply every migration.
 *
 * Why this exists: on Vercel the migration step runs before `next build`, but a partial
 * deployment (wrong DATABASE_URL, missing DIRECT_URL, a Neon connection reset) can leave the
 * database one migration behind while the build still succeeds. The running app then throws
 * "PrismaClientKnownRequestError: The column ... does not exist" for real learners.
 *
 * This script runs immediately after `db:migrate:deploy` inside `vercel-build`:
 *   - it compares the migration folders in `prisma/migrations` with the rows in
 *     `_prisma_migrations` and exits 1 if anything is missing, failed or rolled back, so the
 *     deployment stops before it can serve a half-migrated database;
 *   - it exits 0 with a clear message when the database is not a PostgreSQL production
 *     database (plain `npm run build` on a developer machine with the SQLite file), so local
 *     builds are never blocked by it.
 *
 * `--self-test` proves the comparison logic offline (no database, no network).
 */
import { readdirSync, existsSync } from "node:fs";
import path from "node:path";

/** True when a migration row finished and was not rolled back. */
export function isApplied(row) {
  return Boolean(row?.finished_at) && !row?.rolled_back_at;
}

/**
 * Names in `dirNames` that are not applied in `_prisma_migrations`.
 * Anything failed, rolled back or missing from the applied set is reported.
 */
export function listPendingMigrations(dirNames, appliedRows) {
  const applied = new Set((appliedRows ?? []).filter(isApplied).map((row) => row.migration_name));
  const broken = new Set(
    (appliedRows ?? []).filter((row) => !isApplied(row)).map((row) => row.migration_name),
  );
  return dirNames
    .filter((name) => !applied.has(name) || broken.has(name))
    .map((name) => ({ name, reason: broken.has(name) ? "failed-or-rolled-back" : "not-applied" }));
}

function readMigrationFolders(root) {
  const dir = path.join(root, "prisma", "migrations");
  if (!existsSync(dir)) throw new Error(`No migrations folder at ${dir}`);
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{14}_/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

function report(rows, root) {
  console.error(`[migrate-check] ${rows.length} migration(s) are NOT applied to the production database:`);
  for (const row of rows) console.error(`[migrate-check]   - ${row.name} (${row.reason})`);
  console.error("");
  console.error("[migrate-check] What to do:");
  console.error("  1. Open the database this deployment points at (Neon -> your project -> Connect).");
  console.error("  2. Check DATABASE_URL (pooled, -pooler host) AND DIRECT_URL (direct host) in Vercel env vars.");
  console.error("     Both must point at the SAME database, and the password must be URL-encoded.");
  console.error(`  3. Locally, with that DATABASE_URL/DIRECT_URL exported, run: npx prisma migrate deploy --schema ${path.join(root, "prisma", "schema.prisma")}`);
  console.error("  4. Re-run the deployment. This check blocks the build on purpose: a half-migrated");
  console.error("     database would break sign-in and results for real learners.");
  console.error("[migrate-check] Docs: docs/DEPLOYMENT.md section 9, GITHUB_DEPLOY_STEPS.md.");
}

function selfTest() {
  const dirNames = ["20260101000000_first", "20260202000000_second", "20260303000000_third"];
  const allApplied = dirNames.map((migration_name) => ({ migration_name, finished_at: new Date(), rolled_back_at: null }));
  const cases = [
    ["everything applied => nothing pending", listPendingMigrations(dirNames, allApplied).length === 0],
    [
      "last migration missing => reported once",
      JSON.stringify(listPendingMigrations(dirNames, allApplied.slice(0, 2))) ===
        JSON.stringify([{ name: "20260303000000_third", reason: "not-applied" }]),
    ],
    [
      "failed migration => reported even when a row exists",
      JSON.stringify(
        listPendingMigrations(dirNames, [
          ...allApplied.slice(0, 2),
          { migration_name: dirNames[2], finished_at: null, rolled_back_at: null },
        ]),
      ) === JSON.stringify([{ name: "20260303000000_third", reason: "failed-or-rolled-back" }]),
    ],
    [
      "rolled back migration => reported",
      JSON.stringify(
        listPendingMigrations(dirNames, [
          ...allApplied.slice(0, 2),
          { migration_name: dirNames[2], finished_at: new Date(), rolled_back_at: new Date() },
        ]),
      ) === JSON.stringify([{ name: "20260303000000_third", reason: "failed-or-rolled-back" }]),
    ],
    [
      "empty _prisma_migrations => every folder pending",
      listPendingMigrations(dirNames, []).length === dirNames.length,
    ],
    ["no applied rows at all when the table is empty", listPendingMigrations([], allApplied).length === 0],
  ];
  for (const [label, ok] of cases) console.log(`${ok ? "  ok  " : "  FAIL "}${label}`);
  const failed = cases.filter(([, ok]) => !ok).length;
  console.log(failed === 0 ? "MIGRATION_CHECK_SELF_TEST_PASS" : "MIGRATION_CHECK_SELF_TEST_FAIL");
  return failed === 0 ? 0 : 1;
}

/** Self-test against a deliberately broken fixture: the script must exit non-zero. */
function selfTestExpectFail() {
  const rows = listPendingMigrations(["20260101000000_only"], []);
  const ok = rows.length === 1 && rows[0].reason === "not-applied";
  console.log(ok ? "MIGRATION_CHECK_NEGATIVE_PASS" : "MIGRATION_CHECK_NEGATIVE_FAIL");
  return ok ? 1 : 0;
}

async function main() {
  const root = process.cwd();
  const databaseUrl = (process.env.DATABASE_URL || "").trim();

  if (!databaseUrl.startsWith("postgres")) {
    console.log(
      "[migrate-check] DATABASE_URL is not a PostgreSQL production URL — this check only guards deployments, skipping.",
    );
    return 0;
  }

  const dirNames = readMigrationFolders(root);
  if (dirNames.length === 0) {
    console.log("[migrate-check] No migration folders found, nothing to verify.");
    return 0;
  }

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  let rows;
  try {
    rows = await prisma.$queryRaw`SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations`;
  } catch (error) {
    console.error("[migrate-check] Could not read _prisma_migrations, so migration state is unknown.");
    console.error(`[migrate-check] ${error instanceof Error ? error.message : String(error)}`);
    console.error("[migrate-check] The deployment is stopped: verify DATABASE_URL/DIRECT_URL point at the same PostgreSQL database.");
    return 1;
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }

  const pending = listPendingMigrations(dirNames, rows);
  if (pending.length > 0) {
    report(pending, root);
    return 1;
  }
  console.log(`[migrate-check] All ${dirNames.length} migrations are applied on the production database.`);
  return 0;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
const isDirectRun = invokedPath.endsWith(path.join("scripts", "fail-if-migrate-pending.mjs"));

if (isDirectRun) {
  if (process.argv.includes("--expect-fail")) {
    process.exit(selfTestExpectFail());
  } else if (process.argv.includes("--self-test")) {
    process.exit(selfTest());
  } else {
    main()
      .then((code) => process.exit(code))
      .catch((error) => {
        console.error(`[migrate-check] Unexpected failure: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      });
  }
}
